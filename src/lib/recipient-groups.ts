import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Static groups share the existing workspace-scoped audience store. This keeps
// membership durable without requiring a production schema migration.
export type GroupDefinition = { kind: "GROUP"; recipientIds: string[] };
export function parseGroupDefinition(value: Prisma.JsonValue): GroupDefinition | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.kind !== "GROUP" ||
      !Array.isArray(value.recipientIds) || value.recipientIds.some(id => typeof id !== "string")) return null;
  return { kind: "GROUP", recipientIds: [...new Set(value.recipientIds as string[])] };
}

export async function getGroupAudience(workspaceId: string, definition: GroupDefinition) {
  const suppressed = await prisma.suppression.findMany({ where: { workspaceId }, select: { email: true } });
  return prisma.recipient.findMany({
    where: {
      workspaceId, id: { in: definition.recipientIds },
      consentStatus: "OPTED_IN", unsubscribedAt: null,
      email: { notIn: suppressed.map(item => item.email) },
    },
  });
}
