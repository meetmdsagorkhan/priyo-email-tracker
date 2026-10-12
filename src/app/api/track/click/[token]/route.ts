import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAutomatedUserAgent } from "@/lib/errors";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  const { token: linkToken } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const recipientToken = searchParams.get("t");

  try {
    const campaignLink = await prisma.campaignLink.findUnique({
      where: { trackingToken: linkToken },
      include: { campaign: true },
    });

    if (!campaignLink)
      return new NextResponse("Tracking link not found", { status: 404 });

    const originalUrl = new URL(campaignLink.originalUrl);
    if (originalUrl.protocol !== "http:" && originalUrl.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    if (campaignLink.campaign.clickTracking) {
      try {
        const forwardedFor = req.headers.get("x-forwarded-for");
        const ip = forwardedFor
          ? forwardedFor.split(",")[0].trim()
          : req.headers.get("x-real-ip") || "unknown";
        const ipHash = crypto
          .createHash("sha256")
          .update(ip)
          .digest("hex")
          .substring(0, 16);
        const userAgent = req.headers.get("user-agent") || "unknown";

        const automatedEstimate = isAutomatedUserAgent(userAgent);

        let recipientId: string | null = null;
        if (
          recipientToken &&
          !recipientToken.includes("PRIYO_TRACKING_TOKEN")
        ) {
          const recipient = await prisma.campaignRecipient.findUnique({
            where: { trackingToken: recipientToken },
          });
          if (recipient?.campaignId === campaignLink.campaignId)
            recipientId = recipient.id;
        }

        await prisma.trackingEvent.create({
          data: {
            campaignId: campaignLink.campaignId,
            campaignRecipientId: recipientId,
            campaignLinkId: campaignLink.id,
            eventType: "CLICK",
            userAgent,
            ipHash,
            metadata: {
              automated_estimate: automatedEstimate,
            },
          },
        });
      } catch (error) {
        console.error("Click Tracking Event Error:", error);
      }
    }

    return NextResponse.redirect(originalUrl, 302);
  } catch (error) {
    console.error("Click Tracking Error:", error);
    return new NextResponse("Unable to resolve tracking link", { status: 500 });
  }
}
