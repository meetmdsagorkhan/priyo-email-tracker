import { trackingOrigin } from "@/lib/site";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import {
  campaignRecipientToken,
  personalizeCampaignHtml,
  rewriteCampaignUnsubscribe,
} from "@/lib/tracker";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiUser("manage");
  if (access.response) return access.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const recipientId =
    typeof body?.recipientId === "string" ? body.recipientId : "";
  if (
    (!recipientId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
    typeof body?.htmlContent !== "string" ||
    !body.htmlContent.trim() ||
    body.htmlContent.length > 2_000_000
  ) {
    return NextResponse.json(
      { error: "Choose a recipient and provide the email HTML." },
      { status: 400 },
    );
  }
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, workspaceId: access.user.workspaceId },
      select: { id: true, openTracking: true, clickTracking: true },
    });
    if (!campaign)
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    const recipient = await prisma.recipient.findFirst({
      where: {
        workspaceId: access.user.workspaceId,
        ...(recipientId ? { id: recipientId } : { email }),
      },
      select: {
        id: true,
        email: true,
        consentStatus: true,
        unsubscribedAt: true,
        unsubscribeToken: true,
      },
    });
    if (!recipient)
      return NextResponse.json(
        { error: "Add this email to your workspace audience first." },
        { status: 404 },
      );
    const suppressed = await prisma.suppression.findUnique({
      where: {
        workspaceId_email: {
          workspaceId: access.user.workspaceId,
          email: recipient.email,
        },
      },
      select: { id: true },
    });
    if (
      recipient.consentStatus !== "OPTED_IN" ||
      recipient.unsubscribedAt ||
      suppressed
    )
      return NextResponse.json(
        {
          error:
            "This recipient is not eligible. Confirm consent and resolve any suppression before exporting.",
        },
        { status: 409 },
      );
    const token = await campaignRecipientToken(campaign.id, recipient.id);
    const tracked = await personalizeCampaignHtml(
      campaign.id,
      body.htmlContent,
      token,
      {
        openTracking: campaign.openTracking,
        clickTracking: campaign.clickTracking,
      },
    );
    const unsubscribe = `${trackingOrigin()}/api/unsubscribe/${encodeURIComponent(recipient.unsubscribeToken)}`;
    const html = rewriteCampaignUnsubscribe(tracked.processedHtml, unsubscribe);
    return NextResponse.json({
      html,
      recipient: { id: recipient.id, email: recipient.email },
      trackingMode: "RECIPIENT",
      message:
        "This HTML identifies this recipient only. Send a separate personalized copy to each person.",
    });
  } catch (error) {
    console.error("Recipient HTML export failed", error);
    return NextResponse.json(
      { error: "Unable to prepare recipient HTML. Please try again." },
      { status: 500 },
    );
  }
}
