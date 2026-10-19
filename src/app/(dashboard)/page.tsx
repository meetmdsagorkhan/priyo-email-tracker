import type { Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Eye,
  Info,
  Mail,
  MousePointerClick,
  Plus,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { OverviewRefresh } from "@/components/dashboard/OverviewRefresh";
import { requirePageUser } from "@/lib/access";
import { liveEventWhere } from "@/lib/analytics";
import { isAutomated } from "@/lib/errors";
import { canManageCampaigns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import styles from "@/components/dashboard/overview.module.css";

export const dynamic = "force-dynamic";

type DailyActivity = { date: Date; opens: number; clicks: number };
const campaignStatus: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
const dayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});
const fullDateLabel = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function DashboardPage() {
  const user = await requirePageUser();
  const canManage = canManageCampaigns(user.role);
  const campaignScope = { workspaceId: user.workspaceId };
  const eventScope: Prisma.TrackingEventWhereInput = {
    AND: [liveEventWhere, { campaign: campaignScope }],
  };
  const rangeStart = new Date();
  rangeStart.setUTCHours(0, 0, 0, 0);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 6);

  const [
    campaigns,
    totalCampaigns,
    totalRecipients,
    eventCounts,
    recentEvents,
    dailyActivity,
    sentCount,
  ] = await Promise.all([
    prisma.campaign.findMany({
      where: campaignScope,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            events: { where: liveEventWhere },
            recipients: { where: { recipientId: { not: null } } },
          },
        },
      },
    }),
    prisma.campaign.count({ where: campaignScope }),
    prisma.recipient.count({ where: { workspaceId: user.workspaceId } }),
    prisma.trackingEvent.groupBy({
      by: ["eventType"],
      where: eventScope,
      _count: { _all: true },
    }),
    prisma.trackingEvent.findMany({
      where: eventScope,
      take: 6,
      orderBy: { timestamp: "desc" },
      include: {
        campaign: { select: { id: true, name: true } },
        campaignRecipient: {
          include: { recipient: { select: { email: true } } },
        },
      },
    }),
    prisma.$queryRaw<DailyActivity[]>`
      SELECT DATE_TRUNC('day', e."timestamp") AS "date",
        (COUNT(*) FILTER (WHERE e."eventType" = 'OPEN'))::int AS "opens",
        (COUNT(*) FILTER (WHERE e."eventType" = 'CLICK'))::int AS "clicks"
      FROM "TrackingEvent" e
      INNER JOIN "Campaign" c ON c."id" = e."campaignId"
      WHERE c."workspaceId" = ${user.workspaceId}
        AND e."timestamp" >= ${rangeStart}
        AND (e."metadata"->'is_test') IS DISTINCT FROM 'true'::jsonb
      GROUP BY 1 ORDER BY 1
    `,
    prisma.campaignDelivery.count({
      where: { workspaceId: user.workspaceId, sentAt: { not: null } },
    }),
  ]).catch(() => {
    console.error("Unable to load workspace overview data.");
    throw new Error("Unable to load workspace data. Please try again.");
  });

  const opens =
    eventCounts.find((item) => item.eventType === "OPEN")?._count._all ?? 0;
  const clicks =
    eventCounts.find((item) => item.eventType === "CLICK")?._count._all ?? 0;
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(rangeStart);
    date.setUTCDate(date.getUTCDate() + index);
    const activity = dailyActivity.find(
      (item) =>
        item.date.toISOString().slice(0, 10) ===
        date.toISOString().slice(0, 10),
    );
    return { date, opens: activity?.opens ?? 0, clicks: activity?.clicks ?? 0 };
  });
  const weekOpens = week.reduce((sum, day) => sum + day.opens, 0);
  const weekClicks = week.reduce((sum, day) => sum + day.clicks, 0);
  const maxActivity = Math.max(
    1,
    ...week.flatMap((day) => [day.opens, day.clicks]),
  );
  const hasActivity = weekOpens + weekClicks > 0;
  const metrics = [
    {
      label: "Campaigns",
      value: totalCampaigns,
      detail: "Across your workspace",
      icon: Mail,
      tone: "violet",
    },
    {
      label: "Audience contacts",
      value: totalRecipients,
      detail: "People in your contact list",
      icon: Users,
      tone: "blue",
    },
    {
      label: "Recorded opens",
      value: opens,
      detail: "Email image loads, including proxies",
      icon: Eye,
      tone: "green",
    },
    {
      label: "Link clicks",
      value: clicks,
      detail: "Total tracked link visits",
      icon: MousePointerClick,
      tone: "amber",
    },
  ];
  const steps = [
    {
      title: "Add your audience",
      description: "Bring your contacts into one place.",
      href: "/recipients",
      complete: totalRecipients > 0,
    },
    {
      title: "Create a campaign",
      description: "Add your email and choose recipients.",
      href: "/campaigns/new",
      complete: totalCampaigns > 0,
    },
    {
      title: "Send with individual tracking",
      description: "Use a unique email for each recipient.",
      href: campaigns[0] ? `/campaigns/${campaigns[0].id}` : "/campaigns/new",
      complete: sentCount > 0,
    },
  ];

  return (
    <div className={styles.overview}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>YOUR WORKSPACE · ALL-TIME TOTALS</p>
          <h1>Workspace overview</h1>
          <p className={styles.subtitle}>
            Your campaigns, your audience, and the activity behind every send.
          </p>
        </div>
        <div className={styles.headerActions}>
          <OverviewRefresh />
          {canManage && (
            <Link href="/campaigns/new" className={styles.primaryButton}>
              <Plus size={16} aria-hidden /> New campaign
            </Link>
          )}
        </div>
      </header>

      <section
        aria-label="All-time workspace metrics"
        className={styles.metrics}
      >
        {metrics.map((metric) => (
          <article key={metric.label} className={styles.metric}>
            <div className={styles.metricTop}>
              <p>{metric.label}</p>
              <span className={`${styles.metricIcon} ${styles[metric.tone]}`}>
                <metric.icon size={18} aria-hidden />
              </span>
            </div>
            <strong className={styles.metricValue}>
              {metric.value.toLocaleString("en-US")}
            </strong>
            <p className={styles.metricDetail}>{metric.detail}</p>
          </article>
        ))}
      </section>

      <div className={styles.middleGrid}>
        <section className={styles.panel} aria-labelledby="engagement-heading">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="engagement-heading">Engagement over time</h2>
              <p>Last 7 days · daily totals in UTC</p>
            </div>
            <Link href="/analytics" className={styles.textLink}>
              Explore analytics <ArrowUpRight size={15} aria-hidden />
            </Link>
          </div>
          <div className={styles.chartSummary}>
            <div>
              <span className={styles.openDot} />{" "}
              <strong>{weekOpens.toLocaleString("en-US")}</strong> opens
            </div>
            <div>
              <span className={styles.clickDot} />{" "}
              <strong>{weekClicks.toLocaleString("en-US")}</strong> clicks
            </div>
          </div>
          <div className={styles.chart}>
            <div className={styles.chartGrid} aria-hidden>
              <span />
              <span />
              <span />
            </div>
            {hasActivity ? (
              <div className={styles.bars} aria-hidden>
                {week.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className={styles.barGroup}
                    title={`${day.date.toISOString().slice(0, 10)} UTC: ${day.opens} opens, ${day.clicks} clicks`}
                  >
                    <span
                      className={styles.openBar}
                      style={{
                        height: day.opens
                          ? `${Math.max(3, (day.opens / maxActivity) * 100)}%`
                          : 0,
                      }}
                    />
                    <span
                      className={styles.clickBar}
                      style={{
                        height: day.clicks
                          ? `${Math.max(3, (day.clicks / maxActivity) * 100)}%`
                          : 0,
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.chartEmpty}>
                <span className={styles.emptyIcon}>
                  <MousePointerClick size={23} aria-hidden />
                </span>
                <h3>Your next send starts the story</h3>
                <p>
                  Recorded opens and clicks will appear here after a tracked
                  email is sent.
                </p>
              </div>
            )}
          </div>
          <div className={styles.chartLabels} aria-hidden>
            {week.map((day) => (
              <span key={day.date.toISOString()}>
                {dayLabel.format(day.date)}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>
              Daily email engagement for the last 7 days, UTC. Test activity is
              excluded.
            </caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Opens</th>
                <th scope="col">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {week.map((day) => (
                <tr key={day.date.toISOString()}>
                  <th scope="row">{day.date.toISOString().slice(0, 10)}</th>
                  <td>{day.opens}</td>
                  <td>{day.clicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {canManage ? (
          <section
            className={styles.guidePanel}
            aria-labelledby="next-send-heading"
          >
            <div className={styles.guideHeader}>
              <span className={styles.guideIcon}>
                <Send size={19} aria-hidden />
              </span>
              <span className={styles.guideEyebrow}>
                {sentCount > 0 ? "YOUR NEXT GREAT SEND" : "A BETTER FIRST SEND"}
              </span>
            </div>
            <h2 id="next-send-heading">Make every recipient count.</h2>
            <p className={styles.guideIntro}>
              Start with the right audience. Send individually. See who engaged.
            </p>
            <ol className={styles.steps}>
              {steps.map((step, index) => (
                <li key={step.title}>
                  <Link href={step.href}>
                    <span
                      className={`${styles.stepNumber} ${step.complete ? styles.stepComplete : ""}`}
                    >
                      {step.complete ? (
                        <>
                          <Check size={13} aria-hidden />
                          <span className="sr-only">Completed: </span>
                        </>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>
                      <strong>{step.title}</strong>
                      <small>{step.description}</small>
                    </span>
                    <ChevronRight size={15} aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/settings" className={styles.guideLink}>
              Read the sending guide <ArrowRight size={15} aria-hidden />
            </Link>
          </section>
        ) : (
          <section
            className={styles.guidePanel}
            aria-labelledby="workspace-guide-heading"
          >
            <div className={styles.guideHeader}>
              <span className={styles.guideIcon}>
                <Eye size={19} aria-hidden />
              </span>
              <span className={styles.guideEyebrow}>YOUR WORKSPACE</span>
            </div>
            <h2 id="workspace-guide-heading">See the whole picture.</h2>
            <p className={styles.guideIntro}>
              Explore campaign results and recipient activity. Your admin or
              campaign manager handles creating and sending campaigns.
            </p>
            <Link href="/analytics" className={styles.guideLink}>
              Explore analytics <ArrowRight size={15} aria-hidden />
            </Link>
          </section>
        )}
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.panel} aria-labelledby="campaigns-heading">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="campaigns-heading">Recent campaigns</h2>
              <p>Your latest work, all in one place</p>
            </div>
            <Link href="/campaigns" className={styles.textLink}>
              View all <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
          {campaigns.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <Mail size={25} aria-hidden />
              </span>
              <h3>A fresh start for your next campaign</h3>
              <p>
                {canManage
                  ? "Create an email campaign, choose your audience, and send with recipient-level tracking."
                  : "Your team’s campaigns will appear here once an admin or campaign manager creates one."}
              </p>
              {canManage && (
                <Link href="/campaigns/new" className={styles.primaryButton}>
                  <Plus size={15} aria-hidden /> Create your first campaign
                </Link>
              )}
            </div>
          ) : (
            <ul className={styles.campaignList}>
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className={styles.campaignRow}
                  >
                    <span className={styles.campaignIcon}>
                      <Mail size={18} aria-hidden />
                    </span>
                    <span className={styles.campaignInfo}>
                      <strong>{campaign.name}</strong>
                      <span>
                        {campaign.recipientMode === "BULK"
                          ? "Shared tracking"
                          : `${campaign._count.recipients.toLocaleString("en-US")} ${campaign._count.recipients === 1 ? "recipient" : "recipients"}`}
                        <span aria-hidden> · </span>
                        {campaign._count.events.toLocaleString("en-US")}{" "}
                        {campaign._count.events === 1 ? "event" : "events"}
                      </span>
                    </span>
                    <span
                      className={`${styles.status} ${styles[`status${campaign.status}`] || ""}`}
                    >
                      {campaignStatus[campaign.status] || campaign.status}
                    </span>
                    <ChevronRight
                      size={16}
                      className={styles.rowArrow}
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="activity-heading">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="activity-heading">Latest activity</h2>
              <p>Recorded opens and link clicks</p>
            </div>
            <span className={styles.snapshot}>At page load</span>
          </div>
          {recentEvents.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>
                <MousePointerClick size={25} aria-hidden />
              </span>
              <h3>Ready when your audience is</h3>
              <p>
                Activity will appear after a tracked image loads or a recipient
                follows a tracked link.
              </p>
            </div>
          ) : (
            <ul className={styles.activityList}>
              {recentEvents.map((event) => {
                const isOpen = event.eventType === "OPEN";
                const automated = isAutomated(event.metadata, event.userAgent);
                const email = event.campaignRecipient?.recipient?.email;
                return (
                  <li key={event.id} className={styles.activityRow}>
                    <span
                      className={`${styles.activityIcon} ${isOpen ? styles.violet : styles.green}`}
                    >
                      {isOpen ? (
                        <Eye size={16} aria-hidden />
                      ) : (
                        <MousePointerClick size={16} aria-hidden />
                      )}
                    </span>
                    <div className={styles.activityDetails}>
                      <div className={styles.activityTitle}>
                        <strong>
                          {isOpen ? "Open recorded" : "Link clicked"}
                        </strong>
                        <time
                          dateTime={event.timestamp.toISOString()}
                          title={`${fullDateLabel.format(event.timestamp)} UTC`}
                        >
                          {formatDistanceToNow(event.timestamp, {
                            addSuffix: true,
                          })}
                        </time>
                      </div>
                      <p
                        title={
                          email ||
                          "This event does not identify an individual recipient."
                        }
                      >
                        {email || "Unattributed activity"}
                      </p>
                      <div className={styles.activityContext}>
                        <Link href={`/campaigns/${event.campaign.id}`}>
                          {event.campaign.name}
                        </Link>
                        {automated && (
                          <span title="Estimated from request information; this may be an email proxy or automated request.">
                            Proxy / automated
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
      <aside
        className={styles.measurementNote}
        aria-label="Understanding tracking data"
      >
        <Info size={16} aria-hidden />
        <p>
          Opens are an estimate: image blocking can hide them, and privacy
          proxies can generate them. Clicks can also include automated requests.
          Test activity is excluded.{" "}
          <Link href="/analytics">
            Understand your activity <ArrowUpRight size={12} aria-hidden />
          </Link>
        </p>
      </aside>
    </div>
  );
}
