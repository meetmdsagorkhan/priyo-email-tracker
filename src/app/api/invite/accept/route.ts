import { NextResponse } from "next/server";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const token = String(body.token || "").trim();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");

  if (!token || !name || !password) {
    return NextResponse.json({ error: "Token, name, and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  const invite = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invite) {
    return NextResponse.json({ error: "This invitation is invalid or expired." }, { status: 404 });
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "This invite has already been used." }, { status: 409 });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    await prisma.invitation.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });

    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existingUser) {
    return NextResponse.json({ error: "This email already has an account." }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      name: name || invite.name,
      password: hashedPassword,
      role: invite.role,
      isActive: true,
    },
  });

  await prisma.invitation.update({
    where: { id: invite.id },
    data: {
      status: "ACCEPTED",
      acceptedUserId: user.id,
      acceptedAt: new Date(),
    },
  });

  return NextResponse.json({
    message: "Account created successfully.",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
