import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
const email = process.env.ADMIN_RESET_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_RESET_PASSWORD;
if (
  !email ||
  !password ||
  password.length < 12 ||
  Buffer.byteLength(password) > 72
) {
  console.error(
    "Set ADMIN_RESET_EMAIL and ADMIN_RESET_PASSWORD securely (at least 12 characters, up to 72 bytes).",
  );
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email } });
    if (!user || user.role !== "ADMIN") throw new Error("NOT_ADMIN");
    await tx.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        isActive: true,
        sessionVersion: { increment: 1 },
      },
    });
    await tx.auditLog.deleteMany({
      where: {
        action: "LOGIN_FAILED",
        details: {
          path: ["emailHash"],
          equals: crypto.createHash("sha256").update(email).digest("hex"),
        },
      },
    });
    await tx.auditLog.create({
      data: { userId: user.id, action: "ADMIN_RECOVERY" },
    });
  });
  console.log(
    "Admin password reset; account activated; old sessions revoked. Remove recovery password variables from your environment.",
  );
} catch (error) {
  console.error(
    error.message === "NOT_ADMIN"
      ? "No existing admin matches that email. This command never promotes a non-admin account."
      : "Admin recovery failed. Verify the database connection and deployed schema.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
