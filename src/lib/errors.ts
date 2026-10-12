export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  return error instanceof Error ? error.message : fallback;
}

export const LEGACY_APPLE_BROWSER_USER_AGENT =
  "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15";

export function isAutomatedUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return false;

  if (userAgent.toLowerCase().includes(LEGACY_APPLE_BROWSER_USER_AGENT)) {
    return false;
  }

  return /(?:bot|crawler|spider|slurp|preview|fetcher|googleimageproxy|applemail|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|safelinks|proofpoint|mimecast|barracuda)/i.test(
    userAgent,
  );
}

export function isAutomated(
  metadata: unknown,
  userAgent?: string | null,
): boolean {
  if (userAgent) return isAutomatedUserAgent(userAgent);

  return (
    typeof metadata === "object" &&
    metadata !== null &&
    "automated_estimate" in metadata &&
    metadata.automated_estimate === true
  );
}
