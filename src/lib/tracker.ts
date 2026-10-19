import * as cheerio from "cheerio";
import crypto from "crypto";
import { prisma } from "./prisma";
import { trackingOrigin } from "./site";

export const TRACKING_TOKEN_PLACEHOLDER = "{{SIGNALPOST_TRACKING_TOKEN}}";

export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function campaignRecipientToken(
  campaignId: string,
  recipientId: string,
): Promise<string> {
  const existing = await prisma.campaignRecipient.findFirst({
    where: { campaignId, recipientId },
  });
  if (existing) return existing.trackingToken;
  const created = await prisma.campaignRecipient.create({
    data: { campaignId, recipientId, trackingToken: generateTrackingToken() },
  });
  return created.trackingToken;
}

function trackingPath(value: string, type: "click" | "open") {
  try {
    const url = new URL(value, "https://tracking.invalid");
    const match = url.pathname.match(
      new RegExp(`^/api/track/${type}/([^/]+)/?$`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Rebuild tracking from the campaign's durable link records every time. An
 * existing pixel or a previously generated URL is not evidence that HTML is
 * ready to send: it may contain another recipient's token or an old hostname.
 */
export async function processCampaignHtml(
  campaignId: string,
  htmlContent: string,
  recipientMode: "BULK" | "SELECTED",
  options: {
    trackingToken?: string;
    openTracking?: boolean;
    clickTracking?: boolean;
    isTest?: boolean;
  } = {},
): Promise<{
  processedHtml: string;
  linkCount: number;
  links: { originalUrl: string; trackingToken: string }[];
}> {
  const $ = cheerio.load(htmlContent);
  const baseUrl = trackingOrigin();
  const openTracking = options.openTracking !== false;
  const clickTracking = options.clickTracking !== false;
  let recipientToken = options.trackingToken || TRACKING_TOKEN_PLACEHOLDER;

  if (
    !options.trackingToken &&
    recipientMode === "BULK" &&
    (openTracking || clickTracking)
  ) {
    const bulk = await prisma.campaignRecipient.findFirst({
      where: {
        campaignId,
        recipientId: null,
        // One-off test tokens must not become the shared manual export token.
        NOT: { trackingToken: { startsWith: "test_" } },
      },
    });
    if (bulk) recipientToken = bulk.trackingToken;
    else {
      recipientToken = generateTrackingToken();
      await prisma.campaignRecipient.create({
        data: { campaignId, trackingToken: recipientToken, recipientId: null },
      });
    }
  }

  const campaignLinks = await prisma.campaignLink.findMany({
    where: { campaignId },
  });
  const byToken = new Map(
    campaignLinks.map((link) => [link.trackingToken, link]),
  );
  const byUrl = new Map(campaignLinks.map((link) => [link.originalUrl, link]));
  let linkCount = 0;
  const extractedLinks: { originalUrl: string; trackingToken: string }[] = [];

  for (const element of $("a").toArray()) {
    const anchor = $(element);
    const href = anchor.attr("href")?.trim();
    if (!href || href.startsWith("#")) continue;

    let originalUrl = href;
    const visitedTokens = new Set<string>();
    let linkToken = trackingPath(originalUrl, "click");
    while (linkToken) {
      const stored = byToken.get(linkToken);
      if (!stored || visitedTokens.has(linkToken)) {
        throw new Error(
          "This HTML contains a tracking link that does not belong to this campaign. Use the original email HTML and generate tracking again.",
        );
      }
      visitedTokens.add(linkToken);
      originalUrl = stored.originalUrl;
      linkToken = trackingPath(originalUrl, "click");
    }

    try {
      const url = new URL(originalUrl);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      // Unsubscribe must remain a direct recipient preference action, without
      // being counted as engagement or wrapped in another tracking redirect.
      if (/^\/api\/unsubscribe\/[^/]+\/?$/.test(url.pathname)) {
        anchor.attr("href", originalUrl);
        continue;
      }
    } catch {
      continue;
    }

    if (!clickTracking) {
      anchor.attr("href", originalUrl);
      continue;
    }

    let link = byUrl.get(originalUrl);
    if (!link) {
      link = await prisma.campaignLink.create({
        data: {
          campaignId,
          originalUrl,
          trackingToken: generateTrackingToken(),
        },
      });
      byUrl.set(originalUrl, link);
      byToken.set(link.trackingToken, link);
    }
    linkCount++;
    extractedLinks.push({ originalUrl, trackingToken: link.trackingToken });
    anchor.attr(
      "href",
      `${baseUrl}/api/track/click/${link.trackingToken}?t=${recipientToken}${options.isTest ? "&test=1" : ""}`,
    );
  }

  // Remove stale pixels before injecting exactly one current-recipient pixel.
  $("img").each((_, element) => {
    if (trackingPath($(element).attr("src") || "", "open")) $(element).remove();
  });
  if (openTracking) {
    const pixel = `<img src="${baseUrl}/api/track/open/${recipientToken}${options.isTest ? "?test=1" : ""}" width="1" height="1" alt="" data-signalpost-tracking="open" style="display:block!important;width:1px!important;height:1px!important;border:0!important;margin:0!important;padding:0!important;" />`;
    $("body").append(pixel);
  }

  return { processedHtml: $.html(), linkCount, links: extractedLinks };
}

// The caller must obtain a persisted token for a recipient in the campaign's
// workspace. Manual exports use the same normalization as SMTP delivery.
export function personalizeCampaignHtml(
  campaignId: string,
  htmlContent: string,
  trackingToken: string,
  options: {
    openTracking?: boolean;
    clickTracking?: boolean;
    isTest?: boolean;
  } = {},
) {
  return processCampaignHtml(campaignId, htmlContent, "SELECTED", {
    ...options,
    trackingToken,
  });
}

/** Replace inherited preference links whenever HTML is assigned to a person. */
export function rewriteCampaignUnsubscribe(
  html: string,
  unsubscribeUrl?: string,
): string {
  const $ = cheerio.load(html);
  let hasUnsubscribe = false;
  $("a[href]").each((_, element) => {
    const anchor = $(element);
    try {
      const url = new URL(
        anchor.attr("href") || "",
        "https://tracking.invalid",
      );
      if (!/^\/api\/unsubscribe\/[^/]+\/?$/.test(url.pathname)) return;
      if (unsubscribeUrl) {
        anchor.attr("href", unsubscribeUrl);
        hasUnsubscribe = true;
      } else anchor.remove(); // An anonymous test must not unsubscribe someone else.
    } catch {
      // Relative non-tracking links remain as supplied.
    }
  });
  if (unsubscribeUrl && !hasUnsubscribe) {
    const footer = $("<p>").attr(
      "style",
      "font:12px Arial,sans-serif;color:#666;margin-top:24px",
    );
    footer.text("You received this email from this sender. ");
    footer.append($("<a>").attr("href", unsubscribeUrl).text("Unsubscribe"));
    $("body").append(footer);
  }
  return $.html();
}
