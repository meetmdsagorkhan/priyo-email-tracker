import { applicationOrigin } from "@/lib/site";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const origin = applicationOrigin(request.url);
  if (
    process.env.VERCEL_ENV === "production" &&
    request.nextUrl.origin !== origin &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    return NextResponse.redirect(
      new URL(path + request.nextUrl.search, origin),
      308,
    );
  }
  // NextAuth validates its own CSRF token. Applying an additional origin guard
  // here breaks sign-in when an old NEXTAUTH_URL points at the Vercel alias.
  if (path === "/api/auth" || path.startsWith("/api/auth/"))
    return NextResponse.next();
  if (path.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      const expected = applicationOrigin(request.url);
      if (origin && origin !== expected)
        return NextResponse.json(
          { error: "Cross-origin requests are not allowed." },
          { status: 403 },
        );
    }
    return NextResponse.next();
  }
  if (path === "/login" || path.startsWith("/invite/"))
    return NextResponse.next();
  const token = await getToken({ req: request });
  if (!token?.id || !token.active) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
// API authorization belongs in each handler. Tracking pixels, invitation links,
// and branding assets must remain available without a session.
export const config = {
  matcher: [
    "/api/:path*",
    "/login",
    "/invite/:path*",
    "/",
    "/campaigns/:path*",
    "/analytics/:path*",
    "/templates/:path*",
    "/recipients/:path*",
    "/settings/:path*",
  ],
};
