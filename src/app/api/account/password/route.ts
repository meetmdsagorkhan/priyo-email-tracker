import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
export async function POST(request: Request) {
  const access = await requireApiUser();
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (
    typeof body?.currentPassword !== "string" ||
    typeof body?.password !== "string" ||
    body.password.length < 12 ||
    Buffer.byteLength(body.password) > 72 ||
    Buffer.byteLength(body.currentPassword) > 72
  )
    return NextResponse.json(
      {
        error:
          "Enter your current password and a new password of 12 characters or more (up to 72 bytes).",
      },
      { status: 400 },
    );
  const user = await prisma.user.findUnique({ where: { id: access.user.id } });
  if (!user || !(await bcrypt.compare(body.currentPassword, user.password)))
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  const result = await prisma.user.updateMany({
    where: { id: user.id, password: user.password, isActive: true },
    data: {
      password: await bcrypt.hash(body.password, 12),
      sessionVersion: { increment: 1 },
    },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Account changed. Sign in again and retry." },
      { status: 409 },
    );
  await prisma.auditLog.create({
    data: { userId: user.id, action: "PASSWORD_CHANGED" },
  });
  return NextResponse.json({ success: true });
}
