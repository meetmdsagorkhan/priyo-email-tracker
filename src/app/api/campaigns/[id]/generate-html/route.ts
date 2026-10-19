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
    if (!["DRAFT", "READY"].includes(campaign.status)) {
      return NextResponse.json(
        {
          error:
            "Tracking HTML can only be generated for a draft or ready campaign. Duplicate this campaign to prepare another send.",
        },
        { status: 409 },
      );
    }

    const { processedHtml, linkCount, links } = await processCampaignHtml(
      campaign.id,
      htmlContent,
      campaign.recipientMode as "BULK" | "SELECTED",
      {
        openTracking: campaign.openTracking,
        clickTracking: campaign.clickTracking,
      },
    );

    // Save as ready status
    const prepared = await prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        workspaceId: access.user.workspaceId,
        status: { in: ["DRAFT", "READY"] },
      },
      data: { status: "READY" },
    });
    if (!prepared.count) {
      return NextResponse.json(
        {
          error:
            "This campaign started sending while HTML was being prepared. Its delivery status has been preserved.",
        },
        { status: 409 },
      );
    }

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
