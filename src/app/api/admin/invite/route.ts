import { applicationOrigin } from "@/lib/site";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/access";
import { isRole } from "@/lib/permissions";
import { invitationEmail } from "@/lib/email-templates";
import { sendEmailDirect } from "@/lib/mailer";

export async function GET() {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  const [users, invitations] = await Promise.all([
    prisma.workspaceMembership.findMany({
      where: { workspaceId: access.user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        role: true,
        isActive: true,
        user: {
          select: { id: true, email: true, name: true, isActive: true },
        },
      },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: access.user.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
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
  return NextResponse.json({
    users: users.map(({ user, role, isActive }) => ({
      ...user,
      isActive: user.isActive && isActive,
      role,
    })),
    invitations: invitations.map((invite) => ({
      ...invite,
      status:
        invite.status === "PENDING" && invite.expiresAt <= new Date()
          ? "EXPIRED"
          : invite.status,
    })),
  });
}
export async function POST(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role;
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !name ||
    name.length > 100 ||
    !isRole(role)
  ) {
    return NextResponse.json(
      { error: "Enter a valid email, full name, and role." },
      { status: 400 },
    );
  }
  if (await prisma.user.findUnique({ where: { email } }))
    return NextResponse.json(
      { error: "An account already exists for this email." },
      { status: 409 },
    );
  const token = crypto.randomBytes(32).toString("hex");
  const invite = await prisma.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: {
        email,
        workspaceId: access.user.workspaceId,
        status: "PENDING",
      },
      data: { status: "REJECTED" },
    });
    await tx.invitation.create({
      data: {
        email,
        name,
        role,
        token: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        invitedById: access.user.id,
        workspaceId: access.user.workspaceId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: access.user.id,
        workspaceId: access.user.workspaceId,
        action: "INVITE_CREATED",
        details: { email, role },
      },
    });
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: access.user.workspaceId },
      select: { name: true },
    });
    return { workspaceName: workspace.name };
  });
  const inviteUrl = `${applicationOrigin(request.url)}/invite/${token}`;
  const emailContent = invitationEmail({
    name,
    workspaceName: invite.workspaceName,
    inviterName: access.user.name || "Your workspace administrator",
    role,
    inviteUrl,
  });
  try {
    await sendEmailDirect({ to: email, ...emailContent });
  } catch (error) {
    console.error("Invitation email delivery failed:", error);
    return NextResponse.json(
      {
        error:
          "The invitation was created, but its email could not be sent. Copy and share the invitation link securely.",
        inviteUrl,
        emailSent: false,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    {
      inviteUrl,
      emailSent: true,
    },
    { status: 201 },
  );
}
export async function DELETE(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string")
    return NextResponse.json(
      { error: "Invitation ID is required." },
      { status: 400 },
    );
  const result = await prisma.invitation.updateMany({
    where: {
      id: body.id,
      workspaceId: access.user.workspaceId,
      status: "PENDING",
    },
    data: { status: "REJECTED" },
  });
  if (!result.count)
    return NextResponse.json(
      { error: "Pending invitation not found." },
      { status: 404 },
    );
  await prisma.auditLog.create({
    data: {
      userId: access.user.id,
      workspaceId: access.user.workspaceId,
      action: "INVITE_REVOKED",
      details: { invitationId: body.id },
    },
  });
  return NextResponse.json({ success: true });
}
