import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processCampaignHtml } from "@/lib/tracker";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const { htmlContent } = await req.json().catch(() => ({}));
    if (
      typeof htmlContent !== "string" ||
      !htmlContent.trim() ||
      htmlContent.length > 2000000
    ) {
      return NextResponse.json(
        { error: "No HTML content provided" },
        { status: 400 },
      );
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: access.user.workspaceId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    const { processedHtml, linkCount, links } = await processCampaignHtml(
      campaign.id,
      htmlContent,
      campaign.recipientMode as "BULK" | "SELECTED",
    );

    // Save as ready status
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "READY" },
    });

    return NextResponse.json({
      processedHtml,
      linkCount,
      links,
      message: "HTML generated successfully",
    });
  } catch (error) {
    console.error("Failed to generate HTML:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
