import { requireApiUser } from "@/lib/access";
import { CampaignType, RecipientMode } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const createdById = access.user.id;

    const data = await req.json().catch(() => null);
    if (
      !data ||
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.length > 200 ||
      !Object.values(CampaignType).includes(data.type) ||
      !Object.values(RecipientMode).includes(data.recipientMode) ||
      [data.subject, data.previewText, data.description].some(
        (value) =>
          value != null && (typeof value !== "string" || value.length > 10000),
      )
    ) {
      return NextResponse.json(
        { error: "Enter a campaign name, valid type, and recipient mode." },
        { status: 400 },
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        subject: data.subject || null,
        previewText: data.previewText || null,
        description: data.description || null,
        recipientMode: data.recipientMode,
        createdById: createdById,
        workspaceId: access.user.workspaceId,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Failed to create campaign:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
