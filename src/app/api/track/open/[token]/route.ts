import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    
    // Determine the IP address (anonymized/hashed for privacy if needed)
    const ip = req.headers.get("x-forwarded-for") || req.ip || "unknown";
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
    
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Basic bot detection logic based on user-agent
    let isAutomated = false;
    const botKeywords = ["bot", "spider", "crawler", "googleimageproxy", "ahc/1.0", "yahoo", "applemail"];
    if (botKeywords.some(b => userAgent.toLowerCase().includes(b))) {
      isAutomated = true;
    }

    // Find the campaign recipient
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { trackingToken: token },
      include: { campaign: true }
    });

    if (recipient && recipient.campaign.openTracking) {
      // Record the tracking event
      await prisma.trackingEvent.create({
        data: {
          campaignId: recipient.campaignId,
          campaignRecipientId: recipient.id,
          eventType: "OPEN",
          userAgent,
          ipHash,
          metadata: {
            automated_estimate: isAutomated,
            headers: Object.fromEntries(req.headers.entries())
          }
        }
      });
    }

  } catch (error) {
    console.error("Open Tracking Error:", error);
    // Even on error, we must return the GIF so the user experience doesn't break
  }

  // Always return the transparent GIF, disable caching
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
