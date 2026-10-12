import * as cheerio from "cheerio";
import crypto from "crypto";
import { prisma } from "./prisma";
import { trackingOrigin } from "./site";

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function processCampaignHtml(
  campaignId: string,
  htmlContent: string,
  recipientMode: "BULK" | "SELECTED"
): Promise<{ processedHtml: string; linkCount: number; links: { originalUrl: string; trackingToken: string }[] }> {
  // Use Cheerio to parse HTML safely
  const $ = cheerio.load(htmlContent);
  
  let linkCount = 0;
  const baseUrl = trackingOrigin();

  let defaultTrackingToken = "";
  if (recipientMode === "BULK") {
    // Upsert a default bulk recipient record
    const bulkRecipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId, recipientId: null },
    });
    
    if (bulkRecipient) {
      defaultTrackingToken = bulkRecipient.trackingToken;
    } else {
      defaultTrackingToken = generateTrackingToken();
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          trackingToken: defaultTrackingToken,
          recipientId: null, // Represents bulk default
        },
      });
    }
  }

  // 1. Process Links
  const links = $("a");
  const extractedLinks: { originalUrl: string; trackingToken: string }[] = [];
  
  // Collect unique valid URLs first
  const elements = links.toArray();
  for (const el of elements) {
    const $el = $(el);
    const originalHref = $el.attr("href");
    
    // Ignore empty links, anchors, mailto, tel, javascript, etc.
    if (
      !originalHref ||
      originalHref.startsWith("#") ||
      originalHref.startsWith("mailto:") ||
      originalHref.startsWith("tel:") ||
      originalHref.startsWith("javascript:")
    ) {
      continue;
    }
    
    // Ensure valid HTTP/HTTPS URL
    try {
      const parsedUrl = new URL(originalHref);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        continue;
      }
    } catch {
      continue;
    }

    linkCount++;
    
    // Find or create link in DB
    let campaignLink = await prisma.campaignLink.findFirst({
      where: { campaignId, originalUrl: originalHref },
    });
    
    if (!campaignLink) {
      campaignLink = await prisma.campaignLink.create({
        data: {
          campaignId,
          originalUrl: originalHref,
          trackingToken: generateTrackingToken(),
        },
      });
    }

    extractedLinks.push({
      originalUrl: originalHref,
      trackingToken: campaignLink.trackingToken,
    });

    let trackingUrl = `${baseUrl}/api/track/click/${campaignLink.trackingToken}`;
    if (recipientMode === "BULK") {
      trackingUrl += `?t=${defaultTrackingToken}`;
    } else {
      trackingUrl += `?t={{SIGNALPOST_TRACKING_TOKEN}}`;
    }
    
    $el.attr("href", trackingUrl);
  }

  // 2. Inject Open Tracking Pixel
  let pixelUrl = `${baseUrl}/api/track/open`;
  if (recipientMode === "BULK") {
    pixelUrl += `/${defaultTrackingToken}`;
  } else {
    pixelUrl += `/{{SIGNALPOST_TRACKING_TOKEN}}`;
  }
  
  const pixelHtml = `\n<!-- Signalpost Tracking Pixel -->\n<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block!important;width:1px!important;height:1px!important;border:0!important;margin:0!important;padding:0!important;opacity:0!important;" />\n`;
  
  if ($("body").length > 0) {
    $("body").append(pixelHtml);
  } else {
    $.root().append(pixelHtml);
  }

  return {
    processedHtml: $.html(),
    linkCount,
    links: extractedLinks,
  };
}
