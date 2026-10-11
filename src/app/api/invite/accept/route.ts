import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (
    !/^[a-f0-9]{64}$/.test(token) ||
    !name ||
    name.length > 100 ||
    password.length < 12 ||
    Buffer.byteLength(password) > 72
  ) {
    return NextResponse.json(
      {
        error:
          "A valid invitation, name, and password of at least 12 characters (up to 72 bytes) are required.",
      },
      { status: 400 },
    );
  }
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const invite = await prisma.invitation.findUnique({
    where: { token: hashedToken },
  });
  if (!invite || invite.status !== "PENDING" || invite.expiresAt <= new Date())
    return NextResponse.json(
      {
        error:
          "This invitation is invalid, expired, or already used. Ask an admin for a new link.",
      },
      { status: 410 },
    );
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invite.id,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (!claimed.count) throw new Error("USED");
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name,
          password: passwordHash,
          role: invite.role,
          isActive: true,
        },
      });
      await tx.invitation.update({
        where: { id: invite.id },
        data: { acceptedUserId: user.id },
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: "INVITE_ACCEPTED" },
      });
    });
    return NextResponse.json(
      { message: "Account created. You can now sign in." },
      { status: 201 },
    );
  } catch (error) {
    if (
      (error instanceof Error && error.message === "USED") ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002")
    )
      return NextResponse.json(
        { error: "Invitation already used or account already exists." },
        { status: 409 },
      );
    console.error("Invitation acceptance failed", error);
    return NextResponse.json(
      { error: "Unable to activate your account. Try again later." },
      { status: 500 },
    );
  }
}
