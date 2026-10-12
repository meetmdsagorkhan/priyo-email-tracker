import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAutomatedUserAgent } from "@/lib/errors";
import crypto from "crypto";

// 1x1 transparent GIF buffer
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;

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
            automated_estimate: automatedEstimate,
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
      "Cache-Control":
        "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
