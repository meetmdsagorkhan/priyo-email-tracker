import { requireApiUser } from "@/lib/access";
import { LEGACY_APPLE_BROWSER_USER_AGENT } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PAGE_SIZE = 50;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireApiUser("read");
  if (access.response) return access.response;

  const { id: campaignId } = await context.params;
  const url = new URL(request.url);
  const requestedPage = Number(url.searchParams.get("page") || "1");
  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json({ error: "Invalid page number." }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId, workspaceId: access.user.workspaceId },
      select: { id: true },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }

    const where = {
      campaignId,
      workspaceId: access.user.workspaceId,
    };
    const [total, deliveries] = await Promise.all([
      prisma.campaignDelivery.count({ where }),
      prisma.campaignDelivery.findMany({
        where,
        orderBy: [{ queuedAt: "desc" }, { id: "desc" }],
        skip: (requestedPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          status: true,
          sentAt: true,
          recipient: { select: { email: true } },
          campaignRecipientId: true,
        },
      }),
    ]);

    const [events, automatedEvents] = deliveries.length
      ? await Promise.all([
          prisma.trackingEvent.groupBy({
            by: ["campaignRecipientId", "eventType"],
            where: {
              campaignId,
              campaignRecipientId: {
                in: deliveries.map((delivery) => delivery.campaignRecipientId),
              },
              eventType: { in: ["OPEN", "CLICK"] },
              OR: [
                {
                  NOT: {
                    metadata: {
                      path: ["automated_estimate"],
                      equals: true,
                    },
                  },
                },
                {
                  userAgent: {
                    contains: LEGACY_APPLE_BROWSER_USER_AGENT,
                    mode: "insensitive",
                  },
                },
              ],
            },
            _max: { timestamp: true },
          }),
          prisma.trackingEvent.groupBy({
            by: ["campaignRecipientId", "eventType"],
            where: {
              campaignId,
              campaignRecipientId: {
                in: deliveries.map((delivery) => delivery.campaignRecipientId),
              },
              eventType: { in: ["OPEN", "CLICK"] },
              metadata: {
                path: ["automated_estimate"],
                equals: true,
              },
              NOT: {
                userAgent: {
                  contains: LEGACY_APPLE_BROWSER_USER_AGENT,
                  mode: "insensitive",
                },
              },
            },
            _max: { timestamp: true },
          }),
        ])
      : [[], []];

    const eventTimes = new Map<
      string,
      {
        openedAt: Date | null;
        clickedAt: Date | null;
        automatedOpenAt: Date | null;
        automatedClickAt: Date | null;
      }
    >();
    for (const [eventGroup, automated] of [
      [events, false],
      [automatedEvents, true],
    ] as const) {
      for (const event of eventGroup) {
        if (!event.campaignRecipientId) continue;
        const times = eventTimes.get(event.campaignRecipientId) ?? {
          openedAt: null,
          clickedAt: null,
          automatedOpenAt: null,
          automatedClickAt: null,
        };
        if (event.eventType === "OPEN") {
          if (automated) times.automatedOpenAt = event._max.timestamp;
          else times.openedAt = event._max.timestamp;
        }
        if (event.eventType === "CLICK") {
          if (automated) times.automatedClickAt = event._max.timestamp;
          else times.clickedAt = event._max.timestamp;
        }
        eventTimes.set(event.campaignRecipientId, times);
      }
    }

    return NextResponse.json({
      page: requestedPage,
      pageSize: PAGE_SIZE,
      total,
      recipients: deliveries.map((delivery) => ({
        id: delivery.id,
        email: delivery.recipient.email,
        deliveryStatus: delivery.status,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        openedAt:
          eventTimes.get(delivery.campaignRecipientId)?.openedAt?.toISOString() ??
          null,
        clickedAt:
          eventTimes.get(delivery.campaignRecipientId)?.clickedAt?.toISOString() ??
          null,
        automatedOpenAt:
          eventTimes
            .get(delivery.campaignRecipientId)
            ?.automatedOpenAt?.toISOString() ?? null,
        automatedClickAt:
          eventTimes
            .get(delivery.campaignRecipientId)
            ?.automatedClickAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Campaign recipient analytics error:", error);
    return NextResponse.json(
      { error: "Unable to load recipient activity." },
      { status: 500 },
    );
  }
}
