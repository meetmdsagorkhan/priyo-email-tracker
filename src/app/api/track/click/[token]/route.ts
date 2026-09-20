import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const linkToken = params.token;
  const searchParams = req.nextUrl.searchParams;
  const recipientToken = searchParams.get("t");
  
  try {
    const campaignLink = await prisma.campaignLink.findUnique({
      where: { trackingToken: linkToken },
      include: { campaign: true }
    });

    if (!campaignLink) {
      // If we don't know this link, fallback to home or a safe place
      return NextResponse.redirect(process.env.TRACKING_BASE_URL || "http://localhost:3000");
    }

    if (campaignLink.campaign.clickTracking) {
      // Determine the IP address
      const ip = req.headers.get("x-forwarded-for") || req.ip || "unknown";
      const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
      const userAgent = req.headers.get("user-agent") || "unknown";

      let isAutomated = false;
      const botKeywords = ["bot", "spider", "crawler", "googleimageproxy", "ahc/1.0", "yahoo"];
      if (botKeywords.some(b => userAgent.toLowerCase().includes(b))) {
        isAutomated = true;
      }

      // Try to find recipient if token is provided
      let recipientId = null;
      if (recipientToken) {
        // If it's the "{{PRIYO_TRACKING_TOKEN}}" literal, the user's bulk script failed to replace it
        // Or it's a real token
        if (!recipientToken.includes("PRIYO_TRACKING_TOKEN")) {
          const recipient = await prisma.campaignRecipient.findUnique({
            where: { trackingToken: recipientToken }
          });
          if (recipient) recipientId = recipient.id;
        }
      }

      // Record the click
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
            headers: Object.fromEntries(req.headers.entries())
          }
        }
      });
    }

    // Redirect to the original URL securely
    // Validate protocol (already validated during insertion, but double check)
    const url = new URL(campaignLink.originalUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new NextResponse("Invalid protocol", { status: 400 });
    }

    return NextResponse.redirect(campaignLink.originalUrl, 302);

  } catch (error) {
    console.error("Click Tracking Error:", error);
    // If we fail for any reason, try to redirect to the base URL
    return NextResponse.redirect(process.env.TRACKING_BASE_URL || "http://localhost:3000");
  }
}
