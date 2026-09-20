import * as cheerio from "cheerio";
import crypto from "crypto";
import { prisma } from "./prisma";

export function generateTrackingToken(): string {
  // cryptographically random token
  return crypto.randomBytes(16).toString("hex");
}

export async function processCampaignHtml(
  campaignId: string,
  htmlContent: string,
  recipientMode: "BULK" | "SELECTED"
): Promise<{ processedHtml: string; linkCount: number }> {
  // Use Cheerio to parse HTML safely
  const $ = cheerio.load(htmlContent, { decodeEntities: false });
  
  let linkCount = 0;
  const baseUrl = process.env.TRACKING_BASE_URL || "http://localhost:3000";

  // If BULK mode, we create ONE generic campaign-level tracking token.
  // We'll create a dummy Recipient mapping representing the "Campaign Default".
  // Wait, for BULK mode, we just need a single recipient mapping or we can just pass the campaign ID.
  // Actually, we can just use a single campaignRecipient record for the entire bulk blast.
  let defaultTrackingToken = "";
  if (recipientMode === "BULK") {
    // Upsert a default bulk recipient record
    const bulkRecipient = await prisma.campaignRecipient.findFirst({
      where: { campaignId, recipientId: null }
    });
    
    if (bulkRecipient) {
      defaultTrackingToken = bulkRecipient.trackingToken;
    } else {
      defaultTrackingToken = generateTrackingToken();
      await prisma.campaignRecipient.create({
        data: {
          campaignId,
          trackingToken: defaultTrackingToken,
          recipientId: null // Represents bulk
        }
      });
    }
  }

  // 1. Process Links
  const links = $("a");
  
  // Create an array of promises for link processing
  const linkPromises = links.map(async (_, el) => {
    const $el = $(el);
    const originalHref = $el.attr("href");
    
    // Ignore empty links, anchors, mailto, tel, etc.
    if (!originalHref || originalHref.startsWith("#") || originalHref.startsWith("mailto:") || originalHref.startsWith("tel:")) {
      return;
    }
    
    // Ensure it's a valid HTTP/HTTPS URL
    try {
      const parsedUrl = new URL(originalHref);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return;
      }
    } catch (e) {
      return; // Invalid URL
    }

    linkCount++;
    
    // Check if we already have this link registered for this campaign
    let campaignLink = await prisma.campaignLink.findFirst({
      where: { campaignId, originalUrl: originalHref }
    });
    
    if (!campaignLink) {
      campaignLink = await prisma.campaignLink.create({
        data: {
          campaignId,
          originalUrl: originalHref,
          trackingToken: generateTrackingToken(),
        }
      });
    }

    // Replace the href.
    // If BULK, append ?t=defaultTrackingToken
    // If SELECTED, use a template variable like ?t={{PRIYO_TRACKING_TOKEN}}
    let trackingUrl = `${baseUrl}/api/track/click/${campaignLink.trackingToken}`;
    if (recipientMode === "BULK") {
      trackingUrl += `?t=${defaultTrackingToken}`;
    } else {
      trackingUrl += `?t={{PRIYO_TRACKING_TOKEN}}`;
    }
    
    $el.attr("href", trackingUrl);
  }).get();
  
  await Promise.all(linkPromises);

  // 2. Inject Open Tracking Pixel
  let pixelUrl = `${baseUrl}/api/track/open`;
  if (recipientMode === "BULK") {
    pixelUrl += `/${defaultTrackingToken}`;
  } else {
    pixelUrl += `/{{PRIYO_TRACKING_TOKEN}}`;
  }
  
  const pixelHtml = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`;
  
  // Insert pixel before closing body, or at the end if no body exists
  if ($('body').length > 0) {
    $('body').append(pixelHtml);
  } else {
    $.root().append(pixelHtml);
  }

  return {
    processedHtml: $.html(),
    linkCount
  };
}
