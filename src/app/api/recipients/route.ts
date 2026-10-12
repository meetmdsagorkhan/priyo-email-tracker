import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planLimits } from "@/lib/plans";

export async function GET() {
  try {
    const access = await requireApiUser("read");
    if (access.response) return access.response;
    const recipients = await prisma.recipient.findMany({
      where: { workspaceId: access.user.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
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

    const uniqueEmails = [...new Set(items.map((item) => item.email.trim().toLowerCase()))];
    const [workspace, existingRecipients] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: access.user.workspaceId },
        select: { plan: true },
      }),
      prisma.recipient.count({
        where: {
          workspaceId: access.user.workspaceId,
          email: { in: uniqueEmails },
        },
      }),
    ]);
    if (!workspace)
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    const recipientCount = await prisma.recipient.count({
      where: { workspaceId: access.user.workspaceId },
    });
    if (
      recipientCount +
        uniqueEmails.length -
        existingRecipients >
      planLimits[workspace.plan].recipients
    )
      return NextResponse.json(
        {
          error: `This workspace has reached the ${workspace.plan} recipient limit. Upgrade your plan to add more contacts.`,
        },
        { status: 402 },
      );

    // Check if single or bulk array
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        if (!item.email || !item.email.includes("@")) continue;
        const email = item.email.toLowerCase().trim();
        const existing = await prisma.recipient.findUnique({
          where: {
            workspaceId_email: {
              workspaceId: access.user.workspaceId,
              email,
            },
          },
          select: { consentStatus: true },
        });
        const suppressed = await prisma.suppression.findUnique({
          where: {
            workspaceId_email: {
              workspaceId: access.user.workspaceId,
              email,
            },
          },
          select: { id: true },
        });
        const recipient = await prisma.recipient.upsert({
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
            ...(existing?.consentStatus === "OPTED_OUT" || suppressed
              ? {}
              : item.consentStatus === "OPTED_IN"
                ? {
                    consentStatus: "OPTED_IN",
                    consentedAt: new Date(),
                    consentSource: item.consentSource || "CSV_IMPORT",
                  }
                : {}),
          },
          create: {
            email,
            firstName: item.firstName || null,
            lastName: item.lastName || null,
            customerId: item.customerId || null,
            workspaceId: access.user.workspaceId,
            consentStatus: item.consentStatus === "OPTED_IN" ? "OPTED_IN" : "UNKNOWN",
            consentedAt:
              item.consentStatus === "OPTED_IN" ? new Date() : null,
            consentSource:
              item.consentStatus === "OPTED_IN"
                ? item.consentSource || "CSV_IMPORT"
                : null,
          },
        });
        results.push(recipient);
      }
      return NextResponse.json({ success: true, count: results.length });
    } else {
      const { email, firstName, lastName, customerId, consentStatus, consentSource } = body;
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "Valid email is required" },
          { status: 400 },
        );
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.recipient.findUnique({
        where: {
          workspaceId_email: {
            workspaceId: access.user.workspaceId,
            email: normalizedEmail,
          },
        },
        select: { consentStatus: true },
      });
      const suppressed = await prisma.suppression.findUnique({
        where: {
          workspaceId_email: {
            workspaceId: access.user.workspaceId,
            email: normalizedEmail,
          },
        },
        select: { id: true },
      });
      const recipient = await prisma.recipient.upsert({
        where: {
          workspaceId_email: {
            workspaceId: access.user.workspaceId,
            email: normalizedEmail,
          },
        },
        update: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          customerId: customerId || undefined,
          ...(existing?.consentStatus === "OPTED_OUT" || suppressed
            ? {}
            : consentStatus === "OPTED_IN"
              ? {
                  consentStatus: "OPTED_IN",
                  consentedAt: new Date(),
                  consentSource: consentSource || "MANUAL_ENTRY",
                }
              : {}),
        },
        create: {
          email: normalizedEmail,
          firstName: firstName || null,
          lastName: lastName || null,
          customerId: customerId || null,
          workspaceId: access.user.workspaceId,
          consentStatus: consentStatus === "OPTED_IN" ? "OPTED_IN" : "UNKNOWN",
          consentedAt: consentStatus === "OPTED_IN" ? new Date() : null,
          consentSource:
            consentStatus === "OPTED_IN"
              ? consentSource || "MANUAL_ENTRY"
              : null,
        },
      });

      return NextResponse.json(recipient);
    }
  } catch (error) {
    console.error("Failed to create recipient:", error);
    return NextResponse.json(
      { error: errorMessage(error) || "Failed to create recipient" },
      { status: 500 },
    );
  }
}
