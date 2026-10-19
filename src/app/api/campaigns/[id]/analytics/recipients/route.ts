import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

const PAGE_SIZE = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiUser("read");
  if (access.response) return access.response;
  const { id: campaignId } = await context.params;
  const requestedPage = Number(
    new URL(request.url).searchParams.get("page") || "1",
  );
  if (
    !Number.isSafeInteger(requestedPage) ||
    requestedPage < 1 ||
    requestedPage > 1_000_000
  )
    return NextResponse.json(
      { error: "Invalid page number." },
      { status: 400 },
    );
  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: access.user.workspaceId },
      select: { id: true },
    });
    if (!campaign)
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    // Attribution exists independently of our SMTP queue: copied/exported
    // messages have a recipient token, but correctly have no delivery claim.
    const where = {
      campaignId,
      recipient: { is: { workspaceId: access.user.workspaceId } },
    };
    const [total, recipients] = await Promise.all([
      prisma.campaignRecipient.count({ where }),
      prisma.campaignRecipient.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (requestedPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          recipient: { select: { email: true } },
          delivery: { select: { status: true, sentAt: true } },
        },
      }),
    ]);
    // Only bounded aggregate timestamps are returned; event history is not
    // transferred to the browser and email addresses stay tenant scoped.
    type Times = {
      campaignRecipientId: string;
      openedAt: Date | null;
      clickedAt: Date | null;
      automatedOpenAt: Date | null;
      automatedClickAt: Date | null;
      testOpenedAt: Date | null;
      testClickedAt: Date | null;
    };
    const automated = Prisma.sql`(COALESCE("userAgent", '') ~* '(bot|crawler|spider|slurp|preview|fetcher|googleimageproxy|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|safelinks|proofpoint|mimecast|barracuda)' OR (NULLIF("userAgent", '') IS NULL AND ("metadata"->>'automated_estimate') = 'true'))`;
    const grouped = recipients.length
      ? await prisma.$queryRaw<Times[]>`
      SELECT "campaignRecipientId",
        MAX("timestamp") FILTER (WHERE "eventType" = 'OPEN' AND ("metadata"->'is_test') IS DISTINCT FROM 'true'::jsonb AND NOT COALESCE(${automated}, false)) AS "openedAt",
        MAX("timestamp") FILTER (WHERE "eventType" = 'CLICK' AND ("metadata"->'is_test') IS DISTINCT FROM 'true'::jsonb AND NOT COALESCE(${automated}, false)) AS "clickedAt",
        MAX("timestamp") FILTER (WHERE "eventType" = 'OPEN' AND ("metadata"->'is_test') IS DISTINCT FROM 'true'::jsonb AND ${automated}) AS "automatedOpenAt",
        MAX("timestamp") FILTER (WHERE "eventType" = 'CLICK' AND ("metadata"->'is_test') IS DISTINCT FROM 'true'::jsonb AND ${automated}) AS "automatedClickAt",
        MAX("timestamp") FILTER (WHERE "eventType" = 'OPEN' AND ("metadata"->'is_test') = 'true'::jsonb) AS "testOpenedAt",
        MAX("timestamp") FILTER (WHERE "eventType" = 'CLICK' AND ("metadata"->'is_test') = 'true'::jsonb) AS "testClickedAt"
      FROM "TrackingEvent" WHERE "campaignId" = ${campaignId} AND "campaignRecipientId" IN (${Prisma.join(recipients.map((recipient) => recipient.id))})
      GROUP BY "campaignRecipientId"
    `
      : [];
    const eventTimes = new Map(
      grouped.map((event) => [event.campaignRecipientId, event]),
    );
    return NextResponse.json({
      page: requestedPage,
      pageSize: PAGE_SIZE,
      total,
      recipients: recipients.map((recipient) => {
        const times = eventTimes.get(recipient.id);
        return {
          id: recipient.id,
          email: recipient.recipient!.email,
          deliveryStatus: recipient.delivery?.status ?? "EXTERNAL",
          sentAt: recipient.delivery?.sentAt?.toISOString() ?? null,
          openedAt: times?.openedAt?.toISOString() ?? null,
          clickedAt: times?.clickedAt?.toISOString() ?? null,
          automatedOpenAt: times?.automatedOpenAt?.toISOString() ?? null,
          automatedClickAt: times?.automatedClickAt?.toISOString() ?? null,
          testOpenedAt: times?.testOpenedAt?.toISOString() ?? null,
          testClickedAt: times?.testClickedAt?.toISOString() ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("Campaign recipient analytics error:", error);
    return NextResponse.json(
      { error: "Unable to load recipient activity." },
      { status: 500 },
    );
  }
}
