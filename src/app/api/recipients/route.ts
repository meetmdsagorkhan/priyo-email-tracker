import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectivePlan, planLimits } from "@/lib/plans";

export async function GET(request: Request) {
  try {
    const access = await requireApiUser("read");
    if (access.response) return access.response;
    const cursor = new URL(request.url).searchParams.get("cursor");
    if (cursor && !(await prisma.recipient.findFirst({ where: { id: cursor, workspaceId: access.user.workspaceId }, select: { id: true } })))
      return NextResponse.json({ error: "Recipient cursor not found." }, { status: 404 });
    const recipients = await prisma.recipient.findMany({
      where: { workspaceId: access.user.workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 100,
      include: { _count: { select: { campaigns: true } } },
    });
    return NextResponse.json(recipients);
  } catch (error) {
    console.error("Failed to fetch recipients:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const body = await req.json().catch(() => null);
    const items = Array.isArray(body) ? body : [body];
    if (
      !items.length ||
      items.length > 1000 ||
      items.some(
        (item) =>
          !item ||
          typeof item.email !== "string" ||
          item.email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim()) ||
          [item.firstName, item.lastName, item.customerId].some(
            (value) =>
              value != null &&
              (typeof value !== "string" || value.length > 200),
          ) ||
          (item.consentStatus != null &&
            item.consentStatus !== "OPTED_IN" &&
            item.consentStatus !== "UNKNOWN") ||
          (item.consentSource != null &&
            (typeof item.consentSource !== "string" ||
              item.consentSource.length > 200)),
      )
    )
      return NextResponse.json(
        { error: "Provide up to 1000 recipients with valid email addresses." },
        { status: 400 },
      );

    const uniqueEmails = [
      ...new Set<string>(items.map((item) => item.email.trim().toLowerCase())),
    ];
    return await prisma.$transaction(
      async (tx) => {
        // Queue admission takes the same workspace lock, so concurrent imports
        // cannot each reserve the same remaining contact allowance.
        await tx.$queryRaw`
        SELECT "id" FROM "Workspace"
        WHERE "id" = ${access.user.workspaceId}
        FOR UPDATE
      `;
        const [workspace, existingRecipients, recipientCount, suppressions] =
          await Promise.all([
            tx.workspace.findUnique({
              where: { id: access.user.workspaceId },
              select: { plan: true, billingStatus: true },
            }),
            tx.recipient.findMany({
              where: {
                workspaceId: access.user.workspaceId,
                email: { in: uniqueEmails },
              },
              select: { email: true, consentStatus: true },
            }),
            tx.recipient.count({
              where: { workspaceId: access.user.workspaceId },
            }),
            tx.suppression.findMany({
              where: {
                workspaceId: access.user.workspaceId,
                email: { in: uniqueEmails },
              },
              select: { email: true },
            }),
          ]);
        if (!workspace)
          return NextResponse.json(
            { error: "Workspace not found." },
            { status: 404 },
          );
        const availablePlan = effectivePlan(
          workspace.plan,
          workspace.billingStatus,
        );
        if (
          recipientCount + uniqueEmails.length - existingRecipients.length >
          planLimits[availablePlan].recipients
        )
          return NextResponse.json(
            {
              error: `This workspace has reached the ${availablePlan} recipient limit. An active subscription is required for higher limits.`,
            },
            { status: 402 },
          );

        const existingByEmail = new Map(
          existingRecipients.map((recipient) => [recipient.email, recipient]),
        );
        const suppressedEmails = new Set(
          suppressions.map((suppression) => suppression.email),
        );
        const results = [];
        for (const item of items) {
          const email = item.email.trim().toLowerCase();
          const existing = existingByEmail.get(email);
          const optedIn =
            item.consentStatus === "OPTED_IN" && !suppressedEmails.has(email);
          // A contact import cannot undo an opt-out or move the original consent
          // timestamp merely because the same subscribed address is reimported.
          const recordConsent =
            optedIn &&
            existing?.consentStatus !== "OPTED_OUT" &&
            existing?.consentStatus !== "OPTED_IN";
          const consentSource =
            item.consentSource ||
            (Array.isArray(body) ? "CSV_IMPORT" : "MANUAL_ENTRY");
          const recipient = await tx.recipient.upsert({
            where: {
              workspaceId_email: {
                workspaceId: access.user.workspaceId,
                email,
              },
            },
            update: {
              firstName: item.firstName || undefined,
              lastName: item.lastName || undefined,
              customerId: item.customerId || undefined,
              ...(recordConsent
                ? {
                    consentStatus: "OPTED_IN",
                    consentedAt: new Date(),
                    consentSource,
                  }
                : {}),
            },
            create: {
              email,
              firstName: item.firstName || null,
              lastName: item.lastName || null,
              customerId: item.customerId || null,
              workspaceId: access.user.workspaceId,
              consentStatus: optedIn ? "OPTED_IN" : "UNKNOWN",
              consentedAt: optedIn ? new Date() : null,
              consentSource: optedIn ? consentSource : null,
            },
          });
          existingByEmail.set(email, recipient);
          results.push(recipient);
        }
        return NextResponse.json(
          Array.isArray(body)
            ? { success: true, count: results.length }
            : results[0],
        );
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } catch (error) {
    console.error("Failed to create recipient:", error);
    return NextResponse.json(
      { error: errorMessage(error) || "Failed to create recipient" },
      { status: 500 },
    );
  }
}
