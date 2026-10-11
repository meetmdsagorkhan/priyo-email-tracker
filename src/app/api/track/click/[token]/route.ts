import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token: linkToken } = await context.params;
  const searchParams = req.nextUrl.searchParams;
  const recipientToken = searchParams.get("t");
  
  try {
    const campaignLink = await prisma.campaignLink.findUnique({
      where: { trackingToken: linkToken },
      include: { campaign: true },
    });

    if (!campaignLink) {
      return NextResponse.redirect(process.env.TRACKING_BASE_URL || "http://localhost:3000");
    }

    if (campaignLink.campaign.clickTracking) {
      const forwardedFor = req.headers.get("x-forwarded-for");
      const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : (req.headers.get("x-real-ip") || "unknown");
      const ipHash = crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);
      const userAgent = req.headers.get("user-agent") || "unknown";

      let isAutomated = false;
      const botKeywords = ["bot", "spider", "crawler", "googleimageproxy", "ahc/1.0", "yahoo"];
      if (botKeywords.some((b) => userAgent.toLowerCase().includes(b))) {
        isAutomated = true;
      }

      let recipientId: string | null = null;
      if (recipientToken) {
        if (!recipientToken.includes("PRIYO_TRACKING_TOKEN")) {
          const recipient = await prisma.campaignRecipient.findUnique({
            where: { trackingToken: recipientToken },
          });
          if (recipient) recipientId = recipient.id;
        }
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
            automated_estimate: isAutomated,
            headers: Object.fromEntries(req.headers.entries()),
          },
        },
      });
    }

    const url = new URL(campaignLink.originalUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    return NextResponse.redirect(campaignLink.originalUrl, 302);
  } catch (error) {
    console.error("Click Tracking Error:", error);
    return NextResponse.redirect(process.env.TRACKING_BASE_URL || "http://localhost:3000");
  }
}
