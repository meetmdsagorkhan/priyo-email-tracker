import { resolveWorkspaceSmtp, smtpFailureMessage, SmtpSettingsError } from "./smtp-settings";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import {
  generateTrackingToken,
  processCampaignHtml,
  rewriteCampaignUnsubscribe,
} from "./tracker";
import { trackingOrigin } from "./site";
import { effectivePlan, monthlyEmailUsageWhere, planLimits } from "./plans";

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  replyTo?: string;
}

export function createTransporter(customConfig?: SmtpConfig) {
  const host = customConfig ? customConfig.host || "smtp.gmail.com" : process.env.SMTP_HOST || "smtp.gmail.com";
  const port = customConfig ? customConfig.port || 587 : Number(process.env.SMTP_PORT) || 587;
  const secure = customConfig
    ? customConfig.secure ?? port === 465
    : process.env.SMTP_SECURE === "true" || port === 465;
  const user = customConfig ? customConfig.user || "" : process.env.SMTP_USER || "";
  const pass = customConfig ? customConfig.pass || "" : process.env.SMTP_PASS || "";

  if (!user || !pass) {
    // If no credentials configured yet, we can throw a descriptive error
    throw new SmtpSettingsError("SMTP credentials are not configured. Ask an admin to save sending settings in Settings → Email sending.", 503);
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && !["localhost", "127.0.0.1"].includes(host),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: {
      user,
      pass,
    },
  });
}

export async function verifySmtp(customConfig?: SmtpConfig): Promise<boolean> {
  const transporter = createTransporter(customConfig);
  try { await transporter.verify(); return true; } finally { transporter.close(); }
}

export class EmailConfirmationError extends Error {}

export async function sendEmailDirect({
  to, subject, html, text, from, replyTo, headers, customConfig,
  workspaceId, campaignId, campaignName, deliveryId, kind = "TEST",
}: {
  to: string; subject: string; html: string; text?: string; from?: string;
  replyTo?: string; headers?: Record<string, string>; customConfig?: SmtpConfig;
  workspaceId?: string; campaignId?: string; campaignName?: string;
  deliveryId?: string; kind?: "TEST" | "CAMPAIGN" | "INVITATION" | "VERIFICATION";
}) {
  // Persist intent before opening a connection. A failed log write must never
  // produce an unlogged send. Campaign logs already exist from atomic admission.
  const log = workspaceId ? deliveryId
    ? await prisma.emailLog.findUniqueOrThrow({ where: { deliveryId, workspaceId } })
    : await prisma.emailLog.create({ data: { workspaceId, campaignId, campaignName,
        kind, toEmail: to, subject, status: "SENDING" } }) : null;
  let transporter: ReturnType<typeof createTransporter> | undefined;
  let accepted = false;
  try {
    const config = customConfig || (workspaceId ? await resolveWorkspaceSmtp(workspaceId) : undefined);
    const fromAddress = from || config?.from || (!config ? process.env.SMTP_FROM : undefined) ||
      `Signalpost <${config?.user || process.env.SMTP_USER || "no-reply@example.com"}>`;
    const effectiveReplyTo = replyTo || config?.replyTo || (!config ? process.env.SMTP_REPLY_TO : undefined);
    if (log) await prisma.emailLog.update({ where: { id: log.id }, data: {
      status: "SENDING", attempts: { increment: 1 }, lastError: null,
      fromAddress, replyTo: effectiveReplyTo || null,
    } });
    transporter = createTransporter(config);
    const info = await transporter.sendMail({ from: fromAddress, replyTo: effectiveReplyTo,
      to, subject, html, text, headers });
    if (Array.isArray(info.accepted) && !info.accepted.length) {
      throw Object.assign(new Error("Recipient not accepted"), { code: "EENVELOPE" });
    }
    accepted = true;
    if (log) await prisma.emailLog.update({ where: { id: log.id }, data: {
      status: "SENT", sentAt: new Date(), messageId: info.messageId || null, lastError: null,
    } });
    return info;
  } catch (error) {
    const message = accepted
      ? "SMTP accepted the email, but saving its confirmation failed. Check provider logs before retrying to avoid duplicates."
      : smtpFailureMessage(error);
    if (log) {
      try { await prisma.emailLog.update({ where: { id: log.id }, data: { status: "FAILED", lastError: message } }); }
      catch { /* Original failure is returned; never print connection credentials. */ }
    }
    if (accepted) throw new EmailConfirmationError(message);
    throw new SmtpSettingsError(message, error instanceof SmtpSettingsError ? error.status : 502);
  } finally { transporter?.close(); }
}

function retryAt(attempts: number) {
  const delays = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
  return attempts >= 5
    ? null
    : new Date(Date.now() + delays[Math.min(attempts - 1, delays.length - 1)]);
}

export async function refreshCampaignStatus(
  campaignId: string,
  workspaceId: string,
) {
  const pending = await prisma.campaignDelivery.count({
    where: {
      campaignId,
      workspaceId,
      OR: [
        { status: { in: ["QUEUED", "SENDING"] } },
        { status: "FAILED", attempts: { lt: 5 }, nextAttemptAt: { not: null } },
      ],
    },
  });
  await prisma.campaign.update({
    where: { id: campaignId, workspaceId },
    data:
      pending > 0
        ? { status: "ACTIVE", sendCompletedAt: null }
        : { status: "COMPLETED", sendCompletedAt: new Date() },
  });
}

export class CampaignAdmissionError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "CampaignAdmissionError";
  }
}

export async function blastCampaignToAudience({
  campaignId,
  workspaceId,
  recipientList,
  htmlContent,
  subject,
  replyTo,
}: {
  campaignId: string;
  workspaceId: string;
  recipientList: { email: string; firstName?: string; customerId?: string }[];
  htmlContent: string;
  subject?: string;
  replyTo?: string;
}) {
  // The campaign ID is the admission key. One workspace lock serializes quota
  // reservation across campaigns and recipient imports, including app replicas.
  // A request failure rolls back the entire admission; SMTP only runs later.
  const emails = [
    ...new Set(recipientList.map((item) => item.email.toLowerCase().trim())),
  ];
  if (!emails.length || emails.length > 1000) {
    throw new CampaignAdmissionError(
      "Provide between 1 and 1000 recipients.",
      400,
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`
      SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE
    `;
      const workspace = await transaction.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true, billingStatus: true },
      });
      if (!workspace)
        throw new CampaignAdmissionError("Workspace not found.", 404);

      const campaign = await transaction.campaign.findUnique({
        where: { id: campaignId, workspaceId },
      });
      if (!campaign)
        throw new CampaignAdmissionError("Campaign not found.", 404);
      if (campaign.status !== "DRAFT" && campaign.status !== "READY") {
        throw new CampaignAdmissionError(
          "This campaign has already started or is not sendable.",
          409,
        );
      }
      // An old partial queue is never presented as a new, successful admission.
      // It needs explicit operator recovery rather than silently resending rows.
      if (
        await transaction.campaignDelivery.count({
          where: { campaignId, workspaceId },
        })
      ) {
        throw new CampaignAdmissionError(
          "This campaign already has delivery records. Duplicate it to prepare a new send.",
          409,
        );
      }

      const recipients = await transaction.recipient.findMany({
        where: { workspaceId, email: { in: emails } },
      });
      const suppressions = await transaction.suppression.findMany({
        where: { workspaceId, email: { in: emails } },
        select: { email: true },
      });
      const byEmail = new Map(
        recipients.map((recipient) => [recipient.email, recipient]),
      );
      const suppressed = new Set(suppressions.map((item) => item.email));
      const eligible = recipients.filter(
        (recipient) =>
          recipient.consentStatus === "OPTED_IN" &&
          !recipient.unsubscribedAt &&
          !suppressed.has(recipient.email),
      );
      const eligibleIds = new Set(eligible.map((recipient) => recipient.id));
      const results = emails.map((email) => {
        const recipient = byEmail.get(email);
        return !recipient
          ? {
              email,
              success: false,
              error: "Recipient is not in this workspace audience.",
            }
          : !eligibleIds.has(recipient.id)
            ? {
                email,
                success: false,
                error:
                  "Recipient is not eligible: consent is missing or address is suppressed.",
              }
            : { email, success: true };
      });

      // Count only eligible recipients. Exclusions must not consume quota or
      // incorrectly reject a send which fits its actual remaining reservation.
      const admittedAt = new Date();
      const plan = effectivePlan(workspace.plan, workspace.billingStatus);
      const monthlyReserved = await transaction.campaignDelivery.count({
        where: monthlyEmailUsageWhere(workspaceId, admittedAt),
      });
      if (monthlyReserved + eligible.length > planLimits[plan].monthlyEmails) {
        throw new CampaignAdmissionError(
          `This send would exceed the ${plan} monthly email limit. Upgrade your plan to continue.`,
          402,
        );
      }
      const claim = await transaction.campaign.updateMany({
        where: {
          id: campaignId,
          workspaceId,
          status: { in: ["DRAFT", "READY"] },
        },
        data: {
          status: eligible.length ? "ACTIVE" : "COMPLETED",
          sendStartedAt: admittedAt,
          sendCompletedAt: eligible.length ? null : admittedAt,
          htmlContent,
          subject: subject || campaign.subject || campaign.name,
        },
      });
      if (!claim.count) {
        throw new CampaignAdmissionError(
          "This campaign has already started or is not sendable.",
          409,
        );
      }

      if (eligible.length) {
        const existingMappings = await transaction.campaignRecipient.findMany({
          where: {
            campaignId,
            recipientId: { in: eligible.map((recipient) => recipient.id) },
          },
          select: { id: true, recipientId: true },
        });
        const mappedIds = new Set(
          existingMappings.map((mapping) => mapping.recipientId),
        );
        const missing = eligible.filter(
          (recipient) => !mappedIds.has(recipient.id),
        );
        if (missing.length) {
          await transaction.campaignRecipient.createMany({
            data: missing.map((recipient) => ({
              campaignId,
              recipientId: recipient.id,
              trackingToken: generateTrackingToken(),
            })),
          });
        }
        const mappings = await transaction.campaignRecipient.findMany({
          where: {
            campaignId,
            recipientId: { in: eligible.map((recipient) => recipient.id) },
          },
          select: { id: true, recipientId: true },
        });
        const byRecipientId = new Map(
          mappings.map((mapping) => [mapping.recipientId, mapping.id]),
        );
        await transaction.campaignDelivery.createMany({
          data: eligible.map((recipient) => ({
            campaignId,
            workspaceId,
            recipientId: recipient.id,
            campaignRecipientId: byRecipientId.get(recipient.id)!,
            status: "QUEUED",
            attempts: 0,
            queuedAt: admittedAt,
          })),
        });
        const deliveries = await transaction.campaignDelivery.findMany({
          where: { campaignId, workspaceId }, include: { recipient: { select: { email: true } } },
        });
        await transaction.emailLog.createMany({ data: deliveries.map(delivery => ({
          workspaceId, campaignId, campaignName: campaign.name, deliveryId: delivery.id,
          kind: "CAMPAIGN", toEmail: delivery.recipient.email,
          subject: subject || campaign.subject || campaign.name,
          replyTo: replyTo || null, queuedAt: admittedAt,
        })) });
      }
      return results;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

export async function retryFailedDeliveries(
  limit = 25,
  customConfig?: SmtpConfig,
  campaignScope?: { campaignId: string; workspaceId: string },
) {
  const deliveries = await prisma.campaignDelivery.findMany({
    where: {
      ...(campaignScope
        ? {
            campaignId: campaignScope.campaignId,
            workspaceId: campaignScope.workspaceId,
          }
        : {}),
      status: { in: ["QUEUED", "FAILED"] },
      attempts: { lt: 5 },
      OR: [
        { status: "QUEUED" },
        { status: "FAILED", nextAttemptAt: { lte: new Date() } },
      ],
      campaign: { is: { htmlContent: { not: null } } },
    },
    orderBy: [{ queuedAt: "asc" }, { nextAttemptAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      campaign: true,
      recipient: true,
      campaignRecipient: true,
      emailLog: true,
    },
  });

  let processed = 0;
  const processDelivery = async (delivery: (typeof deliveries)[number]) => {
    const claimableStatus = delivery.status;
    const claim = await prisma.campaignDelivery.updateMany({
      where: {
        id: delivery.id,
        workspaceId: delivery.workspaceId,
        status: claimableStatus,
        attempts: { lt: 5 },
        ...(claimableStatus === "FAILED"
          ? { nextAttemptAt: { lte: new Date() } }
          : {}),
      },
      data: {
        status: "SENDING",
        attempts: { increment: 1 },
        nextAttemptAt: null,
      },
    });
    if (!claim.count) return false;
    processed++;

    let acceptedBySmtp = false;
    try {
      const [suppression, campaign] = await Promise.all([
        prisma.suppression.findUnique({
          where: {
            workspaceId_email: {
              workspaceId: delivery.workspaceId,
              email: delivery.recipient.email,
            },
          },
          select: { id: true },
        }),
        prisma.campaign.findUnique({
          where: { id: delivery.campaignId, workspaceId: delivery.workspaceId },
          select: {
            htmlContent: true,
            subject: true,
            name: true,
            openTracking: true,
            clickTracking: true,
          },
        }),
      ]);
      if (
        !campaign?.htmlContent ||
        delivery.recipient.consentStatus !== "OPTED_IN" ||
        delivery.recipient.unsubscribedAt ||
        suppression
      ) {
        await prisma.campaignDelivery.update({
          where: { id: delivery.id, workspaceId: delivery.workspaceId },
          data: {
            status: "CANCELED",
            lastError:
              "Canceled because content is unavailable or recipient consent/suppression changed.",
          },
        });
        await syncEmailLogFromDelivery(delivery.id);
        await refreshCampaignStatus(delivery.campaignId, delivery.workspaceId);
        return true;
      }
      const { processedHtml: html } = await processCampaignHtml(
        delivery.campaignId,
        campaign.htmlContent,
        "SELECTED",
        {
          trackingToken: delivery.campaignRecipient.trackingToken,
          openTracking: campaign.openTracking,
          clickTracking: campaign.clickTracking,
        },
      );
      const unsubscribeLink = `${trackingOrigin()}/api/unsubscribe/${delivery.recipient.unsubscribeToken}`;
      const info = await sendEmailDirect({
        to: delivery.recipient.email,
        subject: campaign.subject || campaign.name,
        html: rewriteCampaignUnsubscribe(html, unsubscribeLink),
        headers: {
          "List-Unsubscribe": `<${unsubscribeLink}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        customConfig,
        workspaceId: delivery.workspaceId, campaignId: delivery.campaignId,
        campaignName: campaign.name, deliveryId: delivery.id, kind: "CAMPAIGN",
        replyTo: delivery.emailLog?.replyTo || undefined,
      });
      acceptedBySmtp = true;
      await prisma.campaignDelivery.update({
        where: { id: delivery.id, workspaceId: delivery.workspaceId },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: info.messageId || null,
          lastError: null,
        },
      });
    } catch (error) {
      const attempts = delivery.attempts + 1;
      await prisma.campaignDelivery.update({
        where: { id: delivery.id, workspaceId: delivery.workspaceId },
        data: {
          status: "FAILED",
          lastError: acceptedBySmtp ? "SMTP accepted the email, but saving its confirmation failed. Check provider logs before retrying to avoid duplicates."
            : error instanceof SmtpSettingsError || error instanceof EmailConfirmationError ? error.message : smtpFailureMessage(error),
          nextAttemptAt: acceptedBySmtp || error instanceof EmailConfirmationError ? null : retryAt(attempts),
        },
      });
    }
    await syncEmailLogFromDelivery(delivery.id);
    await refreshCampaignStatus(delivery.campaignId, delivery.workspaceId);
    return true;
  };
  for (let offset = 0; offset < deliveries.length; offset += 5)
    await Promise.all(
      deliveries.slice(offset, offset + 5).map(processDelivery),
    );
  return processed;
}

async function syncEmailLogFromDelivery(deliveryId: string) {
  const delivery = await prisma.campaignDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
  await prisma.emailLog.updateMany({ where: { deliveryId, workspaceId: delivery.workspaceId }, data: {
    status: delivery.status, attempts: delivery.attempts, lastError: delivery.lastError,
    messageId: delivery.providerMessageId, sentAt: delivery.sentAt,
  } });
}
