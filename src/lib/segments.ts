import { liveEventWhere, observedEventWhere } from "./analytics";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ENGAGEMENT_FILTERS = [
  "OPENED",
  "UNOPENED",
  "CLICKED",
  "NOT_CLICKED",
] as const;
export type EngagementFilter = (typeof ENGAGEMENT_FILTERS)[number];

export type SegmentDefinition = {
  campaignId: string;
  engagement: EngagementFilter;
};

export async function getSegmentAudience(
  workspaceId: string,
  definition: SegmentDefinition,
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: definition.campaignId, workspaceId },
    select: { id: true },
  });
  if (!campaign) throw new Error("Segment campaign not found");

  const tracking = await prisma.campaignRecipient.findMany({
    where: {
      campaignId: campaign.id,
      recipientId: { not: null },
      delivery: { is: { status: { in: ["SENT", "DELIVERED"] } } },
      recipient: {
        is: {
          workspaceId,
          consentStatus: "OPTED_IN",
          unsubscribedAt: null,
        },
      },
    },
    select: {
      recipientId: true,
      events: {
        where: {
          AND: [liveEventWhere, observedEventWhere],
          eventType:
            definition.engagement === "OPENED" ||
            definition.engagement === "UNOPENED"
              ? "OPEN"
              : "CLICK",
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  const matchingRecipientIds = [
    ...new Set(
      tracking
        .filter((item) => {
          const engaged = item.events.length > 0;
          return definition.engagement === "OPENED" ||
            definition.engagement === "CLICKED"
            ? engaged
            : !engaged;
        })
        .flatMap((item) => (item.recipientId ? [item.recipientId] : [])),
    ),
  ];
  if (!matchingRecipientIds.length) return [];

  const suppressed = await prisma.suppression.findMany({
    where: { workspaceId },
    select: { email: true },
  });
  const suppressedEmails = new Set(suppressed.map((item) => item.email));
  const audience = await prisma.recipient.findMany({
    where: {
      id: { in: matchingRecipientIds },
      workspaceId,
      consentStatus: "OPTED_IN",
      unsubscribedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      customerId: true,
    },
  });
  return audience.filter((recipient) => !suppressedEmails.has(recipient.email));
}

export function parseSegmentDefinition(
  value: Prisma.JsonValue,
): SegmentDefinition | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof value.campaignId !== "string" ||
    !ENGAGEMENT_FILTERS.includes(value.engagement as EngagementFilter)
  )
    return null;
  return {
    campaignId: value.campaignId,
    engagement: value.engagement as EngagementFilter,
  };
}
