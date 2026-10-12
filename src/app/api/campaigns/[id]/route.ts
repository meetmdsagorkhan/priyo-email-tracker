import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

class CampaignBecameActiveError extends Error {}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;

    const result = await prisma.$transaction(async (transaction) => {
      const campaign = await transaction.campaign.findFirst({
        where: { id, workspaceId: access.user.workspaceId },
        select: { status: true },
      });

      if (!campaign) return "NOT_FOUND" as const;
      if (campaign.status === "ACTIVE") return "ACTIVE" as const;

      await transaction.trackingEvent.deleteMany({ where: { campaignId: id } });
      await transaction.campaignLink.deleteMany({ where: { campaignId: id } });
      await transaction.campaignRecipient.deleteMany({
        where: { campaignId: id },
      });

      const deleted = await transaction.campaign.deleteMany({
        where: {
          id,
          workspaceId: access.user.workspaceId,
          status: { not: "ACTIVE" },
        },
      });

      if (!deleted.count) throw new CampaignBecameActiveError();
      return "DELETED" as const;
    });

    if (result === "NOT_FOUND")
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (result === "ACTIVE")
      return NextResponse.json(
        { error: "A campaign cannot be deleted while it is sending." },
        { status: 409 },
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CampaignBecameActiveError)
      return NextResponse.json(
        { error: "A campaign cannot be deleted while it is sending." },
        { status: 409 },
      );

    console.error("Failed to delete campaign:", error);
    return NextResponse.json(
      { error: "Unable to delete campaign. Please try again." },
      { status: 500 },
    );
  }
}
