import { PrismaClient } from "@prisma/client";
// Only presence and status are reported. No configuration values or passwords.
let failed = false;
for (const name of ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"]) {
  console.log(`${name}: ${process.env[name] ? "configured" : "MISSING"}`);
  if (!process.env[name]) failed = true;
}
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.NEXTAUTH_URL !== "https://track.drdoom.world"
) {
  console.error(
    "Set the production NEXTAUTH_URL to https://track.drdoom.world and redeploy.",
  );
  failed = true;
}
const prisma = new PrismaClient();
try {
  const users = await prisma.user.count();
  const admins = await prisma.user.count({
    where: { isActive: true, role: "ADMIN" },
  });
  // Check that the schema used by JWT session revocation has been deployed.
  await prisma.user.findFirst({ select: { sessionVersion: true } });
  console.log(
    `Database reachable; schema verified; accounts: ${users}; active admins: ${admins}.`,
  );
  if (!admins) {
    console.error(
      "No active admin. Configure DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD securely, then run npm run admin:create.",
    );
    failed = true;
  }
} catch (error) {
  console.error(
    "Database/schema check failed:",
    error.code || "CONNECTION_ERROR",
    "Apply the Prisma schema to the production database before deploying the app.",
  );
  failed = true;
} finally {
  await prisma.$disconnect();
}
process.exitCode = failed ? 1 : 0;
