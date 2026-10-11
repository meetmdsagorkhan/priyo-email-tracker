import { errorMessage } from "@/lib/errors";
import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { generateTrackingToken } from "./tracker";

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
      "SMTP credentials not configured. Please provide SMTP user & password in Settings or in the send modal.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
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
  customConfig,
}: {
  to: string;
  subject: string;
  html: string;
  from?: string;
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
  });

  return info;
}

export async function blastCampaignToAudience({
  campaignId,
  htmlContent,
  subject,
  recipientList,
  customConfig,
}: {
  campaignId: string;
  htmlContent: string;
  subject: string;
  recipientList: { email: string; firstName?: string; customerId?: string }[];
  customConfig?: SmtpConfig;
}) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const item of recipientList) {
    try {
      const email = item.email.toLowerCase().trim();
      let token = generateTrackingToken();

      // Find or create recipient in database
      const recipient = await prisma.recipient.upsert({
        where: { email },
        update: {
          firstName: item.firstName || undefined,
          customerId: item.customerId || undefined,
        },
        create: {
          email,
          firstName: item.firstName || null,
          customerId: item.customerId || null,
        },
      });

      // Register or find campaign recipient token
      let campRecipient = await prisma.campaignRecipient.findFirst({
        where: { campaignId, recipientId: recipient.id },
      });

      if (campRecipient) {
        token = campRecipient.trackingToken;
      } else {
        campRecipient = await prisma.campaignRecipient.create({
          data: {
            campaignId,
            recipientId: recipient.id,
            trackingToken: token,
          },
        });
      }

      // Replace tracking token placeholder if present, or bulk token
      const personalizedHtml = htmlContent.replace(
        /\{\{PRIYO_TRACKING_TOKEN\}\}/g,
        token,
      );

      await sendEmailDirect({
        to: email,
        subject,
        html: personalizedHtml,
        customConfig,
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

  // Update campaign status to ACTIVE
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "ACTIVE" },
  });

  return results;
}
