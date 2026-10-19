import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { parseGroupDefinition } from "@/lib/recipient-groups";

class GroupError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
function failure(error: unknown) {
  if (error instanceof GroupError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error && typeof error === "object" && "code" in error && error.code === "P2002")
    return NextResponse.json({ error: "An audience group or segment already uses this name." }, { status: 409 });
  console.error("Recipient group operation failed:", error);
  return NextResponse.json({ error: "Unable to update recipient groups. Please try again." }, { status: 500 });
}

export async function GET() {
  const access = await requireApiUser("read");
  if (access.response) return access.response;
  try {
    const workspaceId = access.user.workspaceId;
    const [groups, recipients, suppressions] = await Promise.all([
      prisma.segment.findMany({ where: { workspaceId }, orderBy: { name: "asc" } }),
      prisma.recipient.findMany({ where: { workspaceId }, select: { id: true, email: true, consentStatus: true, unsubscribedAt: true } }),
      prisma.suppression.findMany({ where: { workspaceId }, select: { email: true } }),
    ]);
    const contacts = new Map(recipients.map(r => [r.id, r]));
    const suppressed = new Set(suppressions.map(s => s.email));
    return NextResponse.json(groups.flatMap(group => {
      const definition = parseGroupDefinition(group.definition);
      if (!definition) return [];
      const recipientIds = definition.recipientIds.filter(id => contacts.has(id));
      return [{ id: group.id, name: group.name, recipientIds, memberCount: recipientIds.length,
        audienceCount: recipientIds.filter(id => {
          const r = contacts.get(id)!;
          return r.consentStatus === "OPTED_IN" && !r.unsubscribedAt && !suppressed.has(r.email);
        }).length }];
    }));
  } catch (error) { return failure(error); }
}

// All membership changes hold the same workspace lock, avoiding lost JSON
// updates when two managers add/remove contacts concurrently.
export async function POST(request: Request) { return mutate(request, "create"); }
export async function PATCH(request: Request) { return mutate(request, "update"); }
export async function DELETE(request: Request) { return mutate(request, "delete"); }

async function mutate(request: Request, method: "create" | "update" | "delete") {
  const access = await requireApiUser("manage");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ids = body?.recipientIds ?? [];
  if (!body || !Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== "string" || !id || id.length > 200) ||
      (method === "create" && (!name || name.length > 100)) ||
      (method !== "create" && (typeof body.id !== "string" || !body.id)) ||
      (method === "update" && !["add", "remove", "rename"].includes(body.action)) ||
      (method === "update" && body.action === "rename" && (!name || name.length > 100)))
    return NextResponse.json({ error: "Provide a group name and up to 1000 recipient IDs per action." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async tx => {
      const workspaceId = access.user.workspaceId;
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      const recipientIds = [...new Set<string>(ids)];
      if (recipientIds.length) {
        const count = await tx.recipient.count({ where: { workspaceId, id: { in: recipientIds } } });
        if (count !== recipientIds.length) throw new GroupError("One or more recipients are not in this workspace. No changes were made.", 404);
      }
      if (method === "create") {
        const group = await tx.segment.create({ data: { workspaceId, name, definition: { kind: "GROUP", recipientIds } } });
        return { id: group.id, name: group.name };
      }
      const group = await tx.segment.findFirst({ where: { id: body.id, workspaceId } });
      const definition = group && parseGroupDefinition(group.definition);
      if (!group || !definition) throw new GroupError("Recipient group not found.", 404);
      if (method === "delete") {
        await tx.segment.delete({ where: { id: group.id } });
        return { success: true };
      }
      const members = new Set(definition.recipientIds);
      if (body.action === "add") recipientIds.forEach(id => members.add(id));
      if (body.action === "remove") recipientIds.forEach(id => members.delete(id));
      await tx.segment.update({ where: { id: group.id }, data: body.action === "rename"
        ? { name } : { definition: { kind: "GROUP", recipientIds: [...members] } } });
      return { success: true, memberCount: members.size };
    });
    return NextResponse.json(result, { status: method === "create" ? 201 : 200 });
  } catch (error) { return failure(error); }
}
