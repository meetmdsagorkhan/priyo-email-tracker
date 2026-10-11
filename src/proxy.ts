import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.get("origin");
      const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
      if (origin && origin !== expected) return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
    }
    return NextResponse.next();
  }
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
    "/",
    "/campaigns/:path*",
    "/analytics/:path*",
    "/templates/:path*",
    "/recipients/:path*",
    "/settings/:path*",
  ],
};
