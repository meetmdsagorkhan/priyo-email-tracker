import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmailDirect } from "@/lib/mailer";
import { applicationOrigin } from "@/lib/site";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const workspaceName =
    typeof body?.workspaceName === "string" ? body.workspaceName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 100 ||
    !workspaceName ||
    workspaceName.length > 100 ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  )
    return NextResponse.json(
      {
        error:
          "Enter a valid email, name, workspace name, and password with at least 12 characters (up to 72 bytes).",
      },
      { status: 400 },
    );

  const emailHash = crypto.createHash("sha256").update(email).digest("hex");
  const recentAttempts = await prisma.auditLog.count({
    where: {
      action: "SIGNUP_REQUEST",
      createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
      details: { path: ["emailHash"], equals: emailHash },
    },
  });
  if (recentAttempts >= 5)
    return NextResponse.json(
      { error: "Too many signup attempts. Wait 15 minutes and try again." },
      { status: 429 },
    );
  await prisma.auditLog.create({
    data: { action: "SIGNUP_REQUEST", details: { emailHash } },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const origin = applicationOrigin(request.url);
  const verificationUrl = `${origin}/api/signup/verify/${token}`;
  let userId: string;
  let workspaceId: string;
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          isActive: true,
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: `${crypto.randomBytes(12).toString("hex")}`,
          ownerId: user.id,
        },
      });
      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "ADMIN",
          isActive: false,
        },
      });
      await tx.emailVerification.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return { userId: user.id, workspaceId: workspace.id };
    });
    userId = result.userId;
    workspaceId = result.workspaceId;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      return NextResponse.json(
        { error: "An account already exists for this email." },
        { status: 409 },
      );
    console.error("Signup account creation failed:", error);
    return NextResponse.json(
      { error: "Unable to create your account right now." },
      { status: 500 },
    );
  }

  try {
    await sendEmailDirect({
      to: email,
      workspaceId, kind: "VERIFICATION",
      subject: "Verify your Signalpost account",
      html: `<p>Hello ${name.replace(/[&<>"']/g, "")},</p><p>Confirm your email address to activate your workspace:</p><p><a href="${verificationUrl}">Verify email address</a></p><p>This link expires in 24 hours. If you did not request an account, you can ignore this email.</p>`,
    });
  } catch (error) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.workspace.deleteMany({ where: { id: workspaceId } });
        await tx.user.deleteMany({ where: { id: userId } });
      });
    } catch (cleanupError) {
      console.error("Signup cleanup failed after mail delivery error:", cleanupError);
    }
    console.error("Signup verification email failed:", error);
    return NextResponse.json(
      {
        error:
          "Account verification email could not be sent. Check the mail server configuration and try again.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { message: "Check your email for a verification link." },
    { status: 201 },
  );
}
