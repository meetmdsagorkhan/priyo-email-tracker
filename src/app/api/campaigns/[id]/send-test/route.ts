import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailDirect, SmtpConfig } from "@/lib/mailer";
import {
  processCampaignHtml,
  generateTrackingToken,
  campaignRecipientToken,
  rewriteCampaignUnsubscribe,
} from "@/lib/tracker";
import { trackingOrigin } from "@/lib/site";

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

    const email = toEmail.toLowerCase().trim();
    const [recipient, suppression] = await Promise.all([
      prisma.recipient.findUnique({
        where: {
          workspaceId_email: { workspaceId: access.user.workspaceId, email },
        },
      }),
      prisma.suppression.findUnique({
        where: {
          workspaceId_email: { workspaceId: access.user.workspaceId, email },
        },
        select: { id: true },
      }),
    ]);
    if (
      suppression ||
      recipient?.consentStatus === "OPTED_OUT" ||
      recipient?.unsubscribedAt
    ) {
      return NextResponse.json(
        {
          error:
            "This address has unsubscribed or is suppressed. A test email cannot bypass that preference.",
        },
        { status: 400 },
      );
    }
    // A test must never add a recipient, grant consent, or re-enable a suppressed
    // address. Known, eligible recipients can verify their own attribution.
    const attributable =
      recipient?.consentStatus === "OPTED_IN" &&
      !recipient.unsubscribedAt &&
      !suppression;
    let testToken: string;
    if (attributable) {
      testToken = await campaignRecipientToken(campaign.id, recipient.id);
    } else {
      testToken = `test_${generateTrackingToken()}`;
      await prisma.campaignRecipient.create({
        data: {
          campaignId: campaign.id,
          trackingToken: testToken,
          recipientId: null,
        },
      });
    }
    const { processedHtml } = await processCampaignHtml(
      campaign.id,
      htmlContent,
      "SELECTED",
      {
        trackingToken: testToken,
        openTracking: campaign.openTracking,
        clickTracking: campaign.clickTracking,
        isTest: true,
      },
    );
    const finalHtml = rewriteCampaignUnsubscribe(
      processedHtml,
      attributable
        ? `${trackingOrigin()}/api/unsubscribe/${recipient.unsubscribeToken}`
        : undefined,
    );

    const emailSubject = `[TEST] ${subject || campaign.subject || campaign.name}`;

    const info = await sendEmailDirect({
      to: email,
      subject: emailSubject,
      html: finalHtml,
      customConfig: smtpConfig as SmtpConfig | undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      trackingMode: attributable ? "RECIPIENT" : "ANONYMOUS_TEST",
      message: attributable
        ? `Test email sent to ${email}. Test activity is linked to this recipient and kept separate from campaign results.`
        : `Test email sent to ${email}. Test activity is anonymous because this address is not an eligible opted-in recipient in this workspace.`,
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
