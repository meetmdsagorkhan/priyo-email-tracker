import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function renderPage(token: string, message?: string, status = 200) {
  const content = message
    ? `<h1>Email verification</h1><p>${message}</p><p><a href="/login">Go to sign in</a></p>`
    : `<h1>Verify your email</h1><p>Confirm your email address to activate your workspace.</p><form method="post"><button type="submit">Verify email</button></form>`;
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Verify email</title><body style="font:16px system-ui;max-width:36rem;margin:10vh auto;padding:1rem">${content}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function findToken(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  return prisma.emailVerification.findUnique({ where: { tokenHash } });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const verification = await findToken(token);
  if (!verification || verification.expiresAt <= new Date())
    return renderPage("", "This verification link is invalid or expired.", 410);
  return renderPage(token);
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const verification = await findToken(token);
  if (!verification || verification.expiresAt <= new Date())
    return renderPage("", "This verification link is invalid or expired.", 410);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerification.deleteMany({
        where: {
          id: verification.id,
          expiresAt: { gt: new Date() },
        },
      });
      if (!claimed.count) throw new Error("VERIFICATION_USED");
      await tx.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await tx.workspaceMembership.updateMany({
        where: { userId: verification.userId },
        data: { isActive: true },
      });
    });
    return renderPage("", "Your account is verified. You can now sign in.");
  } catch (error) {
    if (error instanceof Error && error.message === "VERIFICATION_USED")
      return renderPage("", "This verification link has already been used.", 410);
    console.error("Email verification failed:", error);
    return renderPage("", "Verification could not be completed. Please retry.", 500);
  }
}
