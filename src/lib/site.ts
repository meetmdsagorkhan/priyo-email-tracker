// The production hostname belongs to the project owner, independently of
// the company whose email campaigns are managed in this workspace.
export const PRODUCTION_ORIGIN = "https://track.drdoom.world";

export function applicationOrigin(fallback = "http://localhost:3000") {
  const configured = process.env.APP_URL;
  if (configured) return new URL(configured).origin;
  if (process.env.VERCEL_ENV === "production") return PRODUCTION_ORIGIN;
  return new URL(process.env.NEXTAUTH_URL || fallback).origin;
}

export function authenticationRedirect(url: string, baseUrl: string) {
  const origin = applicationOrigin(baseUrl);
  try {
    const target = new URL(url, origin);
    // Map callbacks from the old deployment hostname to the owner's domain,
    // while rejecting arbitrary external destinations.
    if (target.origin === origin || target.origin === new URL(baseUrl).origin) {
      return origin + target.pathname + target.search + target.hash;
    }
  } catch {
    /* An invalid callback should go to the workspace home. */
  }
  return origin;
}
