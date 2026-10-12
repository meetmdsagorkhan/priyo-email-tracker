import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailDirect, SmtpConfig } from "@/lib/mailer";
import { processCampaignHtml, generateTrackingToken } from "@/lib/tracker";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const { toEmail, subject, htmlContent, smtpConfig } = await req
      .json()
      .catch(() => ({}));

    if (
      typeof toEmail !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)
    ) {
      return NextResponse.json(
        { error: "A valid recipient email address is required" },
        { status: 400 },
      );
    }

    if (
      typeof htmlContent !== "string" ||
      !htmlContent.trim() ||
      htmlContent.length > 2000000
    ) {
      return NextResponse.json(
        { error: "HTML content is required to send test email" },
        { status: 400 },
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: access.user.workspaceId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    // Process HTML if not already tracked
    let processedHtml = htmlContent;
    const testToken = generateTrackingToken();

    if (!htmlContent.includes("/api/track/")) {
      const result = await processCampaignHtml(
        campaign.id,
        htmlContent,
        "BULK",
      );
      processedHtml = result.processedHtml;
    }

    // Replace test token placeholder if exists
    const finalHtml = processedHtml.replace(
      /\{\{[A-Z]+_TRACKING_TOKEN\}\}/g,
      testToken,
    );

    const emailSubject =
      subject || campaign.subject || `[TEST] ${campaign.name}`;

    const info = await sendEmailDirect({
      to: toEmail,
      subject: emailSubject,
      html: finalHtml,
      customConfig: smtpConfig as SmtpConfig | undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `Test email sent successfully to ${toEmail}`,
    });
  } catch (error) {
    console.error("Test Email Send Error:", error);
    return NextResponse.json(
      {
        error:
          errorMessage(error) ||
          "Failed to send test email. Please check your SMTP settings.",
      },
      { status: 500 },
    );
  }
}
