import { NextResponse } from "next/server";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { emailStorageNeedsMigration, EMAIL_MIGRATION_MESSAGE } from "@/lib/smtp-settings";

const statuses: DeliveryStatus[] = ["QUEUED", "SENDING", "SENT", "DELIVERED", "BOUNCED", "COMPLAINED", "FAILED", "CANCELED"];
function statusWhere(status: DeliveryStatus, workspaceId: string): Prisma.EmailLogWhereInput {
  return { OR: [ { delivery: { is: { workspaceId, status } } }, { deliveryId: null, status } ] };
}
function publicError(error: string | null) {
  if (!error) return null;
  // Historical providers could echo credentials. Only display our own fixed
  // error vocabulary; do not expose old/raw SMTP responses in a browser.
  const prefixes = ["SMTP authentication failed", "SMTP rejected the sender", "Unable to connect to SMTP.", "Email was not confirmed as accepted by SMTP",
    "SMTP accepted the email, but saving its confirmation failed.", "SMTP credentials are not configured.", "Saved SMTP credentials cannot be decrypted.",
    "Canceled because content is unavailable or recipient consent/suppression changed.", "Delivery worker lease expired."];
  return prefixes.some(prefix => error.startsWith(prefix)) ? error : "Sending could not be confirmed. Check your SMTP provider logs and sending settings.";
}
export async function GET(request: Request) {
  const access = await requireApiUser("read");
  if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  const search = (params.get("search") || "").trim();
  const status = params.get("status") || "";
  const kind = params.get("kind") || "";
  const campaignId = params.get("campaignId") || "";
  const cursor = params.get("cursor") || "";
  if (search.length > 200 || (status && !statuses.includes(status as DeliveryStatus)) ||
      (kind && !["CAMPAIGN", "TEST", "INVITATION", "VERIFICATION"].includes(kind)) || campaignId.length > 200 || cursor.length > 200)
    return NextResponse.json({ error: "Invalid email log filters." }, { status: 400 });
  try {
    const workspaceId = access.user.workspaceId;
    if (cursor && !(await prisma.emailLog.findFirst({ where: { id: cursor, workspaceId }, select: { id: true } })))
      return NextResponse.json({ error: "Email log cursor not found. Refresh the list." }, { status: 404 });
    const base: Prisma.EmailLogWhereInput = { workspaceId, ...(kind ? { kind } : {}), ...(campaignId ? { campaignId } : {}),
      ...(search ? { OR: [{ toEmail: { contains: search, mode: "insensitive" } }, { subject: { contains: search, mode: "insensitive" } }, { campaignName: { contains: search, mode: "insensitive" } }] } : {}) };
    const where: Prisma.EmailLogWhereInput = { AND: [base, ...(status ? [statusWhere(status as DeliveryStatus, workspaceId)] : [])] };
    const [rows, total, ...counts] = await Promise.all([
      prisma.emailLog.findMany({ where, orderBy: [{ queuedAt: "desc" }, { id: "desc" }], take: 51,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, campaignId: true, campaignName: true, kind: true, toEmail: true, subject: true,
          fromAddress: true, replyTo: true, status: true, attempts: true, messageId: true, lastError: true, queuedAt: true, sentAt: true,
          delivery: { select: { workspaceId: true, status: true, attempts: true, nextAttemptAt: true, lastError: true, providerMessageId: true,
            sentAt: true, deliveredAt: true, bouncedAt: true, complainedAt: true } } },
      }),
      prisma.emailLog.count({ where }),
      ...statuses.map(status => prisma.emailLog.count({ where: { AND: [base, statusWhere(status, workspaceId)] } })),
    ]);
    const items = rows.slice(0, 50).map(row => {
      const { delivery: relatedDelivery, ...log } = row;
      const delivery = relatedDelivery?.workspaceId === workspaceId ? relatedDelivery : null;
      return { ...log, status: delivery?.status || log.status, attempts: delivery?.attempts ?? log.attempts,
        messageId: delivery?.providerMessageId || log.messageId,
        lastError: publicError(delivery?.lastError || log.lastError), sentAt: delivery?.sentAt || log.sentAt,
        nextAttemptAt: delivery?.nextAttemptAt || null,
        deliveredAt: delivery?.deliveredAt || null, bouncedAt: delivery?.bouncedAt || null, complainedAt: delivery?.complainedAt || null };
    });
    return NextResponse.json({ items, total, counts: Object.fromEntries(statuses.map((status, index) => [status, counts[index]])),
      nextCursor: rows.length > 50 ? items.at(-1)?.id : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: emailStorageNeedsMigration(error) ? EMAIL_MIGRATION_MESSAGE : "Unable to load email logs. Please try again." }, { status: emailStorageNeedsMigration(error) ? 503 : 500 }); }
}
