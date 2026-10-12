import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { blastCampaignToAudience, createTransporter } from "@/lib/mailer";
import { processCampaignHtml } from "@/lib/tracker";
import { getSegmentAudience, parseSegmentDefinition } from "@/lib/segments";
import { getUtcMonthStart, planLimits } from "@/lib/plans";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const { htmlContent, subject, recipients, segmentId } = await req
      .json()
      .catch(() => ({}));

    if (
      typeof htmlContent !== "string" ||
      !htmlContent.trim() ||
      htmlContent.length > 2000000
    )
      return NextResponse.json(
        { error: "Valid HTML content is required." },
        { status: 400 },
      );
    if (
      recipients !== undefined &&
      (!Array.isArray(recipients) ||
        recipients.length > 1000 ||
        recipients.some(
          (item) =>
            !item ||
            typeof item.email !== "string" ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email),
        ))
    )
      return NextResponse.json(
        { error: "Provide up to 1000 valid recipients." },
        { status: 400 },
      );
    if (segmentId !== undefined && typeof segmentId !== "string")
      return NextResponse.json(
        { error: "Invalid audience segment." },
        { status: 400 },
      );
    const campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: access.user.workspaceId },
      include: {
        recipients: {
          where: {
            recipientId: { not: null },
            recipient: { is: { workspaceId: access.user.workspaceId } },
          },
          include: { recipient: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }

    // Determine target recipient list
    let targetRecipients: {
      email: string;
      firstName?: string;
      customerId?: string;
    }[] = [];

    if (segmentId) {
      const segment = await prisma.segment.findFirst({
        where: { id: segmentId, workspaceId: access.user.workspaceId },
      });
      const definition = segment
        ? parseSegmentDefinition(segment.definition)
        : null;
      if (!definition)
        return NextResponse.json(
          { error: "Audience segment not found or invalid." },
          { status: 404 },
        );
      targetRecipients = (
        await getSegmentAudience(access.user.workspaceId, definition)
      ).map((recipient) => ({
        email: recipient.email,
        firstName: recipient.firstName || undefined,
        customerId: recipient.customerId || undefined,
      }));
    } else if (Array.isArray(recipients) && recipients.length > 0) {
      targetRecipients = recipients;
    } else if (campaign.recipients.length > 0) {
      targetRecipients = campaign.recipients
        .filter((r) => r.recipient && r.recipient.email)
        .map((r) => ({
          email: r.recipient!.email,
          firstName: r.recipient!.firstName || undefined,
          customerId: r.recipient!.customerId || undefined,
        }));
    } else {
      // If no recipients passed, query from global Recipient directory
      const allRecipients = await prisma.recipient.findMany({
        where: { workspaceId: access.user.workspaceId },
        take: 500,
        orderBy: { createdAt: "desc" },
      });
      targetRecipients = allRecipients.map((r) => ({
        email: r.email,
        firstName: r.firstName || undefined,
        customerId: r.customerId || undefined,
      }));
    }

    if (targetRecipients.length === 0) {
      return NextResponse.json(
        {
          error: "No recipients found to send to. Please add recipients first.",
        },
        { status: 400 },
      );
    }
    targetRecipients = [
      ...new Map(
        targetRecipients.map((recipient) => [
          recipient.email.toLowerCase().trim(),
          recipient,
        ]),
      ).values(),
    ];
    const workspace = await prisma.workspace.findUnique({
      where: { id: access.user.workspaceId },
      select: { plan: true },
    });
    if (!workspace)
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    const monthlyReserved = await prisma.campaignDelivery.count({
      where: {
        workspaceId: access.user.workspaceId,
        status: { not: "CANCELED" },
        queuedAt: { gte: getUtcMonthStart() },
      },
    });
    if (
      monthlyReserved + targetRecipients.length >
      planLimits[workspace.plan].monthlyEmails
    )
      return NextResponse.json(
        {
          error: `This send would exceed the ${workspace.plan} monthly email limit. Upgrade your plan to continue.`,
        },
        { status: 402 },
      );

    // Ensure HTML is tracked
    let processedHtml = htmlContent;
    if (!htmlContent.includes("/api/track/")) {
      const result = await processCampaignHtml(
        campaign.id,
        htmlContent,
        campaign.recipientMode as "BULK" | "SELECTED",
      );
      processedHtml = result.processedHtml;
    }

    try {
      createTransporter().close();
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Server SMTP is not configured.",
        },
        { status: 503 },
      );
    }
    const emailSubject = subject || campaign.subject || campaign.name;
    const claim = await prisma.campaign.updateMany({
      where: {
        id: campaign.id,
        workspaceId: access.user.workspaceId,
        status: { in: ["DRAFT", "READY"] },
      },
      data: {
        status: "ACTIVE",
        sendStartedAt: new Date(),
        sendCompletedAt: null,
        htmlContent: processedHtml,
        subject: emailSubject,
      },
    });
    if (!claim.count)
      return NextResponse.json(
        { error: "This campaign has already started or is not sendable." },
        { status: 409 },
      );

    const results = await blastCampaignToAudience({
      campaignId: campaign.id,
      workspaceId: access.user.workspaceId,
      recipientList: targetRecipients,
    });

    const queuedCount = results.filter((r) => r.success).length;
    const skippedCount = results.length - queuedCount;

    return NextResponse.json({
      success: true,
      total: targetRecipients.length,
      queued: queuedCount,
      skipped: skippedCount,
      message: `Campaign queued: ${queuedCount} emails are scheduled for delivery; ${skippedCount} recipients were excluded.`,
    }, { status: 202 });
  } catch (error) {
    console.error("Direct Blast Error:", error);
    return NextResponse.json(
      {
        error:
          errorMessage(error) ||
          "Failed to dispatch campaign. Please check your SMTP settings.",
      },
      { status: 500 },
    );
  }
}
