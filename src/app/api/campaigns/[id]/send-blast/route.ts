import { emailStorageNeedsMigration, EMAIL_MIGRATION_MESSAGE, parseReplyTo, resolveWorkspaceSmtp, SmtpSettingsError } from "@/lib/smtp-settings";
import { getGroupAudience, parseGroupDefinition } from "@/lib/recipient-groups";
import { errorMessage } from "@/lib/errors";
import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  blastCampaignToAudience,
  CampaignAdmissionError,
  createTransporter,
} from "@/lib/mailer";
import { processCampaignHtml } from "@/lib/tracker";
import { getSegmentAudience, parseSegmentDefinition } from "@/lib/segments";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const { htmlContent, subject, recipients, segmentId, groupId, replyTo: requestedReplyTo } = await req
      .json()
      .catch(() => ({}));

    const replyTo = parseReplyTo(requestedReplyTo);
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
    if (
      subject !== undefined &&
      (typeof subject !== "string" ||
        subject.length > 500 ||
        /[\r\n]/.test(subject))
    )
      return NextResponse.json(
        { error: "Provide a subject of up to 500 characters on one line." },
        { status: 400 },
      );
    if (segmentId !== undefined && typeof segmentId !== "string")
      return NextResponse.json(
        { error: "Invalid audience segment." },
        { status: 400 },
      );
    if ((groupId !== undefined && (typeof groupId !== "string" || !groupId)) || (groupId && segmentId))
      return NextResponse.json({ error: "Choose one audience group or segment." }, { status: 400 });
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

    if (groupId) {
      const group = await prisma.segment.findFirst({ where: { id: groupId, workspaceId: access.user.workspaceId } });
      const definition = group && parseGroupDefinition(group.definition);
      if (!definition) return NextResponse.json({ error: "Recipient group not found." }, { status: 404 });
      targetRecipients = (await getGroupAudience(access.user.workspaceId, definition)).map(r => ({
        email: r.email, firstName: r.firstName || undefined, customerId: r.customerId || undefined,
      }));
    } else if (segmentId) {
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
    if (targetRecipients.length > 1000)
      return NextResponse.json(
        { error: "Provide up to 1000 recipients per campaign send." },
        { status: 400 },
      );
    if (!["DRAFT", "READY"].includes(campaign.status))
      return NextResponse.json(
        { error: "This campaign has already started or is not sendable." },
        { status: 409 },
      );

    // App sends always use one durable token per recipient, even when the
    // campaign also offers an anonymous BULK export for external senders.
    const { processedHtml } = await processCampaignHtml(
      campaign.id,
      htmlContent,
      "SELECTED",
      {
        openTracking: campaign.openTracking,
        clickTracking: campaign.clickTracking,
      },
    );

    try {
      createTransporter(await resolveWorkspaceSmtp(access.user.workspaceId)).close();
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof SmtpSettingsError ? error.message : emailStorageNeedsMigration(error) ? EMAIL_MIGRATION_MESSAGE : "Unable to load sending settings. Check your saved SMTP configuration.",
        },
        { status: 503 },
      );
    }
    const results = await blastCampaignToAudience({
      campaignId: campaign.id,
      workspaceId: access.user.workspaceId,
      recipientList: targetRecipients,
      htmlContent: processedHtml,
      subject,
      replyTo,
    });

    const queuedCount = results.filter((r) => r.success).length;
    const skippedCount = results.length - queuedCount;

    return NextResponse.json(
      {
        success: true,
        total: targetRecipients.length,
        queued: queuedCount,
        skipped: skippedCount,
        message: `Campaign queued: ${queuedCount} emails are scheduled for delivery; ${skippedCount} recipients were excluded.`,
      },
      { status: 202 },
    );
  } catch (error) {
    if (emailStorageNeedsMigration(error)) return NextResponse.json({ error: EMAIL_MIGRATION_MESSAGE }, { status: 503 });
    if (error instanceof SmtpSettingsError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof CampaignAdmissionError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
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
