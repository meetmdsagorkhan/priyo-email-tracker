import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const access = await requireApiUser("read");
    if (access.response) return access.response;
    const recipients = await prisma.recipient.findMany({
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
          ),
      )
    )
      return NextResponse.json(
        { error: "Provide up to 1000 recipients with valid email addresses." },
        { status: 400 },
      );

    // Check if single or bulk array
    if (Array.isArray(body)) {
      const results = [];
      for (const item of body) {
        if (!item.email || !item.email.includes("@")) continue;
        const recipient = await prisma.recipient.upsert({
          where: { email: item.email.toLowerCase().trim() },
          update: {
            firstName: item.firstName || undefined,
            lastName: item.lastName || undefined,
            customerId: item.customerId || undefined,
          },
          create: {
            email: item.email.toLowerCase().trim(),
            firstName: item.firstName || null,
            lastName: item.lastName || null,
            customerId: item.customerId || null,
          },
        });
        results.push(recipient);
      }
      return NextResponse.json({ success: true, count: results.length });
    } else {
      const { email, firstName, lastName, customerId } = body;
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "Valid email is required" },
          { status: 400 },
        );
      }

      const recipient = await prisma.recipient.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          customerId: customerId || undefined,
        },
        create: {
          email: email.toLowerCase().trim(),
          firstName: firstName || null,
          lastName: lastName || null,
          customerId: customerId || null,
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
