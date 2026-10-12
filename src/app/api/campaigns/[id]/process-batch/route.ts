import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retryFailedDeliveries } from "@/lib/mailer";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const batchSize = body?.batchSize;
    if (
      typeof batchSize !== "number" ||
      !Number.isInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 100
    )
      return NextResponse.json(
        { error: "Batch size must be a whole number from 1 to 100." },
        { status: 400 },
      );

    const campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: access.user.workspaceId },
      select: { id: true, status: true },
    });
    if (!campaign)
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    if (campaign.status !== "ACTIVE")
      return NextResponse.json(
        { error: "This campaign has no active queued delivery to process." },
        { status: 409 },
      );

    const processed = await retryFailedDeliveries(batchSize, undefined, {
      campaignId: id,
      workspaceId: access.user.workspaceId,
    });
    const deliveryScope = { campaignId: id, workspaceId: access.user.workspaceId };
    const [queued, sending, retrying, sent, failed] = await Promise.all([
      prisma.campaignDelivery.count({
        where: { ...deliveryScope, status: "QUEUED" },
      }),
      prisma.campaignDelivery.count({
        where: { ...deliveryScope, status: "SENDING" },
      }),
      prisma.campaignDelivery.count({
        where: {
          ...deliveryScope,
          status: "FAILED",
          attempts: { lt: 5 },
          nextAttemptAt: { not: null },
        },
      }),
      prisma.campaignDelivery.count({
        where: { ...deliveryScope, status: { in: ["SENT", "DELIVERED"] } },
      }),
      prisma.campaignDelivery.count({
        where: { ...deliveryScope, status: "FAILED", attempts: { gte: 5 } },
      }),
    ]);

    return NextResponse.json({
      processed,
      queued,
      sending,
      retrying,
      sent,
      failed,
    });
  } catch (error) {
    console.error("Campaign batch processing error:", error);
    return NextResponse.json(
      { error: errorMessage(error) || "Unable to process this delivery batch." },
      { status: 500 },
    );
  }
}
