import { errorMessage } from "@/lib/errors";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { generateTrackingToken } from "./tracker";
import { trackingOrigin } from "./site";

export interface SmtpConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

export function createTransporter(customConfig?: SmtpConfig) {
  const host = customConfig?.host || process.env.SMTP_HOST || "smtp.gmail.com";
  const port = customConfig?.port || Number(process.env.SMTP_PORT) || 587;
  const secure =
    customConfig?.secure !== undefined
      ? customConfig.secure
      : process.env.SMTP_SECURE === "true" || port === 465;
  const user = customConfig?.user || process.env.SMTP_USER || "";
  const pass = customConfig?.pass || process.env.SMTP_PASS || "";

  if (!user || !pass) {
    // If no credentials configured yet, we can throw a descriptive error
    throw new Error(
      "SMTP credentials are not configured. Set SMTP_USER and SMTP_PASS on the server, or provide SMTP settings for a one-off test email.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
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
  await transporter.verify();
  return true;
}

export async function sendEmailDirect({
  to,
  subject,
  html,
  from,
  headers,
  customConfig,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
  headers?: Record<string, string>;
  customConfig?: SmtpConfig;
}) {
  const transporter = createTransporter(customConfig);
  const fromAddress =
    from ||
    customConfig?.from ||
    process.env.SMTP_FROM ||
    `Priyo Pay <${customConfig?.user || process.env.SMTP_USER || "no-reply@priyo.com"}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html,
    headers,
  });

  return info;
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

export async function blastCampaignToAudience({
  campaignId,
  workspaceId,
  recipientList,
}: {
  campaignId: string;
  workspaceId: string;
  recipientList: { email: string; firstName?: string; customerId?: string }[];
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId, workspaceId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const results: { email: string; success: boolean; error?: string }[] = [];
  for (const item of recipientList) {
    try {
      const email = item.email.toLowerCase().trim();
      const existingRecipient = await prisma.recipient.findUnique({
        where: { workspaceId_email: { workspaceId, email } },
      });
      if (!existingRecipient) {
        results.push({
          email,
          success: false,
          error: "Recipient is not in this workspace audience.",
        });
        continue;
      }
      const suppression = await prisma.suppression.findUnique({
        where: { workspaceId_email: { workspaceId, email } },
        select: { id: true },
      });
      if (
        existingRecipient.consentStatus !== "OPTED_IN" ||
        existingRecipient.unsubscribedAt ||
        suppression
      ) {
        results.push({
          email,
          success: false,
          error: "Recipient is not eligible: consent is missing or address is suppressed.",
        });
        continue;
      }
      const token = generateTrackingToken();
      const recipient = existingRecipient;

      // Register or find campaign recipient token
      let campRecipient = await prisma.campaignRecipient.findFirst({
        where: { campaignId, recipientId: recipient.id },
      });

      if (!campRecipient) {
        campRecipient = await prisma.campaignRecipient.create({
          data: {
            campaignId,
            recipientId: recipient.id,
            trackingToken: token,
          },
        });
      }

      await prisma.campaignDelivery.upsert({
        where: {
          campaignId_recipientId: {
            campaignId,
            recipientId: recipient.id,
          },
        },
        create: {
          campaignId,
          workspaceId,
          recipientId: recipient.id,
          campaignRecipientId: campRecipient.id,
          status: "QUEUED",
          attempts: 0,
        },
        update: {},
      });
      results.push({ email, success: true });
    } catch (err) {
      results.push({
        email: item.email,
        success: false,
        error: errorMessage(err),
      });
    }
  }

  await refreshCampaignStatus(campaignId, workspaceId);
  return results;
}

export async function retryFailedDeliveries(
  limit = 25,
  customConfig?: SmtpConfig,
) {
  const deliveries = await prisma.campaignDelivery.findMany({
    where: {
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
          select: { htmlContent: true, subject: true, name: true },
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
            lastError: "Canceled because content is unavailable or recipient consent/suppression changed.",
          },
        });
        await refreshCampaignStatus(
          delivery.campaignId,
          delivery.workspaceId,
        );
        return true;
      }
      let html = campaign.htmlContent.replaceAll(
        "{{PRIYO_TRACKING_TOKEN}}",
        delivery.campaignRecipient.trackingToken,
      );
      const bulkTracking = await prisma.campaignRecipient.findFirst({
        where: { campaignId: delivery.campaignId, recipientId: null },
        select: { trackingToken: true },
      });
      if (bulkTracking)
        html = html.replaceAll(
          bulkTracking.trackingToken,
          delivery.campaignRecipient.trackingToken,
        );
      const unsubscribeLink = `${trackingOrigin()}/api/unsubscribe/${delivery.recipient.unsubscribeToken}`;
      const info = await sendEmailDirect({
        to: delivery.recipient.email,
        subject: campaign.subject || campaign.name,
        html: `${html}<hr style="margin-top:32px;border:0;border-top:1px solid #ddd"><p style="font:12px Arial,sans-serif;color:#666">You received this email from this sender. <a href="${unsubscribeLink}">Unsubscribe</a></p>`,
        headers: {
          "List-Unsubscribe": `<${unsubscribeLink}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        customConfig,
      });
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
          lastError: errorMessage(error).slice(0, 2000),
          nextAttemptAt: retryAt(attempts),
        },
      });
    }
    await refreshCampaignStatus(delivery.campaignId, delivery.workspaceId);
    return true;
  };
  for (let offset = 0; offset < deliveries.length; offset += 5)
    await Promise.all(deliveries.slice(offset, offset + 5).map(processDelivery));
  return processed;
}
