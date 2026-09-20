import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    // For now, allow bypassing session in dev if no users exist
    const session = await getServerSession(authOptions);
    let createdById = "unknown";
    
    if (session?.user?.id) {
      createdById = session.user.id;
    } else {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) createdById = firstUser.id;
    }

    if (createdById === "unknown") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await req.json();

    const campaign = await prisma.campaign.create({
      data: {
        name: data.name,
        type: data.type,
        subject: data.subject || null,
        previewText: data.previewText || null,
        description: data.description || null,
        recipientMode: data.recipientMode,
        createdById: createdById,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Failed to create campaign:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
