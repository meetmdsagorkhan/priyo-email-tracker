import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const access = await requireApiUser("read");
  if (access.response) return access.response;

  try {
    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 29);
    const [subscribed, unsubscribed, unknown, changes] = await Promise.all([
      prisma.recipient.count({
        where: {
          workspaceId: access.user.workspaceId,
          consentStatus: "OPTED_IN",
          unsubscribedAt: null,
        },
      }),
      prisma.recipient.count({
        where: {
          workspaceId: access.user.workspaceId,
          consentStatus: "OPTED_OUT",
        },
      }),
      prisma.recipient.count({
        where: {
          workspaceId: access.user.workspaceId,
          consentStatus: "UNKNOWN",
        },
      }),
      prisma.$queryRaw<
        { day: string; changeType: "SUBSCRIBED" | "UNSUBSCRIBED"; count: number }[]
      >`
        SELECT TO_CHAR(DATE_TRUNC('day', "consentedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               'SUBSCRIBED' AS "changeType",
               COUNT(*)::int AS count
        FROM "Recipient"
        WHERE "workspaceId" = ${access.user.workspaceId}
          AND "consentedAt" >= ${trendStart}
        GROUP BY day
        UNION ALL
        SELECT TO_CHAR(DATE_TRUNC('day', "unsubscribedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
               'UNSUBSCRIBED' AS "changeType",
               COUNT(*)::int AS count
        FROM "Recipient"
        WHERE "workspaceId" = ${access.user.workspaceId}
          AND "unsubscribedAt" >= ${trendStart}
        GROUP BY day
      `,
    ]);
    const changeCounts = new Map(
      changes.map((change) => [
        `${change.day}:${change.changeType}`,
        change.count,
      ]),
    );
    const trend = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(trendStart);
      day.setUTCDate(day.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return {
        label: new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(day),
        subscribed: changeCounts.get(`${key}:SUBSCRIBED`) ?? 0,
        unsubscribed: changeCounts.get(`${key}:UNSUBSCRIBED`) ?? 0,
      };
    });

    return NextResponse.json({ subscribed, unsubscribed, unknown, trend });
  } catch (error) {
    console.error("Subscription analytics error:", error);
    return NextResponse.json(
      { error: "Unable to load subscription analytics." },
      { status: 500 },
    );
  }
}
