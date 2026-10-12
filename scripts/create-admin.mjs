import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const {
  DEFAULT_ADMIN_EMAIL: email,
  DEFAULT_ADMIN_PASSWORD: password,
  DEFAULT_ADMIN_NAME: name,
} = process.env;
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !password ||
  password.length < 12 ||
  Buffer.byteLength(password) > 72
) {
  console.error(
    "Set DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD (12–72 bytes) securely before running this command.",
  );
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: email.trim().toLowerCase(),
        password: await bcrypt.hash(password, 12),
        name: name || "Administrator",
        role: "ADMIN",
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: `${name || "Administrator"}'s workspace`,
        slug: `workspace-${user.id}`,
        ownerId: user.id,
      },
    });
    await tx.workspaceMembership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: "ADMIN",
      },
    });
  });
  console.log(
    "Administrator created. Existing accounts are never overwritten.",
  );
} catch (error) {
  console.error(
    error.code === "P2002"
      ? "An account with that email already exists."
      : "Unable to create administrator. Check the database configuration.",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
