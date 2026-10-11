import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/access";
import { isRole } from "@/lib/permissions";

export async function PATCH(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (
    typeof body?.id !== "string" ||
    !isRole(body.role) ||
    typeof body.isActive !== "boolean"
  )
    return NextResponse.json(
      { error: "User, valid role, and account status are required." },
      { status: 400 },
    );
  if (body.id === access.user.id && (body.role !== "ADMIN" || !body.isActive))
    return NextResponse.json(
      { error: "You cannot disable or demote your own account." },
      { status: 409 },
    );
  if (
    body.password !== undefined &&
    (typeof body.password !== "string" ||
      body.password.length < 12 ||
      Buffer.byteLength(body.password) > 72)
  )
    return NextResponse.json(
      {
        error:
          "Passwords must have at least 12 characters and at most 72 bytes.",
      },
      { status: 400 },
    );
  const passwordHash = body.password
    ? await bcrypt.hash(body.password, 12)
    : undefined;
  try {
    const user = await prisma.$transaction(
      async (tx) => {
        // Recheck authorization inside the transaction to avoid concurrent demotions.
        const actor = await tx.user.findUnique({
          where: { id: access.user.id },
        });
        if (!actor?.isActive || actor.role !== "ADMIN")
          throw new Error("FORBIDDEN");
        const target = await tx.user.findUnique({ where: { id: body.id } });
        if (!target) throw new Error("NOT_FOUND");
        if (
          target.role === "ADMIN" &&
          target.isActive &&
          (body.role !== "ADMIN" || !body.isActive)
        ) {
          if (
            (await tx.user.count({
              where: { role: "ADMIN", isActive: true },
            })) <= 1
          )
            throw new Error("LAST_ADMIN");
        }
        const updated = await tx.user.update({
          where: { id: body.id },
          data: {
            role: body.role,
            isActive: body.isActive,
            ...(passwordHash ? { password: passwordHash } : {}),
            ...(passwordHash || target.isActive !== body.isActive
              ? { sessionVersion: { increment: 1 } }
              : {}),
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "USER_ACCESS_UPDATED",
            details: {
              targetId: target.id,
              role: body.role,
              isActive: body.isActive,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND")
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (message === "FORBIDDEN")
      return NextResponse.json(
        { error: "Admin access is required." },
        { status: 403 },
      );
    if (message === "LAST_ADMIN")
      return NextResponse.json(
        { error: "Keep at least one active administrator." },
        { status: 409 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return NextResponse.json(
        { error: "Access changed concurrently. Refresh and try again." },
        { status: 409 },
      );
    console.error("User access update failed", error);
    return NextResponse.json(
      { error: "Unable to update access." },
      { status: 500 },
    );
  }
}
