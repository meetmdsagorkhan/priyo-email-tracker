import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : (req.headers.get("x-real-ip") || "unknown");
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex").substring(0, 16);
    
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Apple Mail Privacy Protection (MPP), Google Image Proxy, Bots
    let isAutomated = false;
    const botKeywords = [
      "bot",
      "spider",
      "crawler",
      "googleimageproxy",
      "ahc/1.0",
      "yahoo",
      "applemail",
      "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15",
    ];
    if (botKeywords.some((b) => userAgent.toLowerCase().includes(b))) {
      isAutomated = true;
    }

    const recipient = await prisma.campaignRecipient.findUnique({
      where: { trackingToken: token },
      include: { campaign: true },
    });

    if (recipient && recipient.campaign.openTracking) {
      await prisma.trackingEvent.create({
        data: {
          campaignId: recipient.campaignId,
          campaignRecipientId: recipient.id,
          eventType: "OPEN",
          userAgent,
          ipHash,
          metadata: {
            automated_estimate: isAutomated,
            headers: Object.fromEntries(req.headers.entries()),
          },
        },
      });
    }
  } catch (error) {
    console.error("Open Tracking Error:", error);
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
