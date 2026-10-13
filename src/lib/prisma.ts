import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  const url = new URL(databaseUrl);
  url.searchParams.set("connection_limit", "1");
  return url.toString();
}

const datasourceUrl = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
