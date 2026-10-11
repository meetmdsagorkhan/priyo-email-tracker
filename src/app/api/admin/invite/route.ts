import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [users, invitations] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    }),
    prisma.invitation.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        OR: [{ status: "PENDING" }, { status: "ACCEPTED" }],
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    }),
  ]);

  return NextResponse.json({ users, invitations });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const role = String(body.role || "MEMBER");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  const normalizedRole = role === "ADMIN" ? "ADMIN" : "MEMBER";

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  const existingInvite = await prisma.invitation.findFirst({
    where: {
      email,
      status: "PENDING",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingInvite) {
    return NextResponse.json(
      { error: "A pending invitation already exists for this email.", inviteUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${existingInvite.token}` },
      { status: 409 },
    );
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const invite = await prisma.invitation.create({
    data: {
      email,
      name,
      role: normalizedRole,
      token,
      expiresAt: expiry,
      invitedById: session.user.id,
      status: "PENDING",
    },
  });

  const inviteUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invite/${invite.token}`;

  return NextResponse.json({ message: "Invitation created successfully.", inviteUrl });
}
