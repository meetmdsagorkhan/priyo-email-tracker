import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blastCampaignToAudience, SmtpConfig } from "@/lib/mailer";
import { processCampaignHtml } from "@/lib/tracker";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const { htmlContent, subject, recipients, smtpConfig } = await req
      .json()
      .catch(() => ({}));

    if (
      typeof htmlContent !== "string" ||
      !htmlContent.trim() ||
      htmlContent.length > 2000000
    )
      return NextResponse.json(
        { error: "Valid HTML content is required." },
        { status: 400 },
      );
    if (
      recipients !== undefined &&
      (!Array.isArray(recipients) ||
        recipients.length > 1000 ||
        recipients.some(
          (item) =>
            !item ||
            typeof item.email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email),
        ))
    )
      return NextResponse.json(
        { error: "Provide up to 1000 valid recipients." },
        { status: 400 },
      );
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        recipients: {
          include: { recipient: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    // Determine target recipient list
    let targetRecipients: {
      email: string;
      firstName?: string;
      customerId?: string;
    }[] = [];

    if (Array.isArray(recipients) && recipients.length > 0) {
      targetRecipients = recipients;
    } else if (campaign.recipients.length > 0) {
      targetRecipients = campaign.recipients
        .filter((r) => r.recipient && r.recipient.email)
        .map((r) => ({
          email: r.recipient!.email,
          firstName: r.recipient!.firstName || undefined,
          customerId: r.recipient!.customerId || undefined,
        }));
    } else {
      // If no recipients passed, query from global Recipient directory
      const allRecipients = await prisma.recipient.findMany({
        take: 500,
        orderBy: { createdAt: "desc" },
      });
      targetRecipients = allRecipients.map((r) => ({
        email: r.email,
        firstName: r.firstName || undefined,
        customerId: r.customerId || undefined,
      }));
    }

    if (targetRecipients.length === 0) {
      return NextResponse.json(
        {
          error: "No recipients found to send to. Please add recipients first.",
        },
        { status: 400 },
      );
    }

    // Ensure HTML is tracked
    let processedHtml = htmlContent;
    if (!htmlContent.includes("/api/track/")) {
      const result = await processCampaignHtml(
        campaign.id,
        htmlContent,
        campaign.recipientMode as "BULK" | "SELECTED",
      );
      processedHtml = result.processedHtml;
    }

    const emailSubject = subject || campaign.subject || campaign.name;

    const results = await blastCampaignToAudience({
      campaignId: campaign.id,
      htmlContent: processedHtml,
      subject: emailSubject,
      recipientList: targetRecipients,
      customConfig: smtpConfig as SmtpConfig | undefined,
    });

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      total: targetRecipients.length,
      sent: successCount,
      failed: failureCount,
      details: results,
      message: `Direct blast finished: ${successCount} sent, ${failureCount} failed.`,
    });
  } catch (error) {
    console.error("Direct Blast Error:", error);
    return NextResponse.json(
      {
        error:
          errorMessage(error) ||
          "Failed to dispatch campaign. Please check your SMTP settings.",
      },
      { status: 500 },
    );
  }
}
