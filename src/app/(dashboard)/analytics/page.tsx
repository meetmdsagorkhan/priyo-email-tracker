import {
  isAutomated,
  LEGACY_APPLE_BROWSER_USER_AGENT,
} from "@/lib/errors";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";
import { AnalyticsRefreshButton } from "@/components/analytics/AnalyticsRefreshButton";
import { CampaignAnalyticsCharts } from "@/components/analytics/CampaignAnalyticsCharts";
import { EmailAnalyticsTabs } from "@/components/analytics/EmailAnalyticsTabs";
import { RecipientActivity } from "@/components/analytics/RecipientActivity";
import { SubscriptionTrendChart } from "@/components/analytics/SubscriptionTrendChart";
import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  ArrowLeft,
  MousePointerClick,
  Eye,
  ShieldCheck,
  TrendingUp,
  Mail,
  Laptop,
  Smartphone,
  Bot,
  ExternalLink,
  BarChart2,
} from "lucide-react";

export const dynamic = "force-dynamic";
const ACTIVITY_PAGE_SIZE = 100;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; tab?: string }>;
}) {
  const { campaign: campaignId, tab: requestedTab } = await searchParams;
  const activeTab = [
    "overview",
    "conversions",
    "engagement",
    "subscriptions",
  ].includes(requestedTab || "")
    ? (requestedTab as "overview" | "conversions" | "engagement" | "subscriptions")
    : "overview";

  const user = await requirePageUser();
  const canManage = canManageCampaigns(user.role);
  let campaigns: { id: string; name: string }[] = [];
  try {
    campaigns = await prisma.campaign.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    });
  } catch (e) {
    console.error("DB connection error in AnalyticsPage:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  // If no campaign selected, show selector or first campaign
  const activeCampaignId =
    campaignId || (campaigns.length > 0 ? campaigns[0].id : null);

  if (activeTab === "subscriptions") {
    const trendStart = new Date();
    trendStart.setUTCHours(0, 0, 0, 0);
    trendStart.setUTCDate(trendStart.getUTCDate() - 29);
    const [subscribedCount, unsubscribedCount, unknownCount, trendRows] =
      await Promise.all([
        prisma.recipient.count({
          where: {
            workspaceId: user.workspaceId,
            consentStatus: "OPTED_IN",
            unsubscribedAt: null,
          },
        }),
        prisma.recipient.count({
          where: {
            workspaceId: user.workspaceId,
            consentStatus: "OPTED_OUT",
          },
        }),
        prisma.recipient.count({
          where: {
            workspaceId: user.workspaceId,
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
          WHERE "workspaceId" = ${user.workspaceId}
            AND "consentedAt" >= ${trendStart}
          GROUP BY day
          UNION ALL
          SELECT TO_CHAR(DATE_TRUNC('day', "unsubscribedAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
                 'UNSUBSCRIBED' AS "changeType",
                 COUNT(*)::int AS count
          FROM "Recipient"
          WHERE "workspaceId" = ${user.workspaceId}
            AND "unsubscribedAt" >= ${trendStart}
          GROUP BY day
        `,
      ]);
    const subscriptionChanges = new Map(
      trendRows.map((row) => [`${row.day}:${row.changeType}`, row.count]),
    );
    const subscriptionTrend = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(trendStart);
      day.setUTCDate(day.getUTCDate() + index);
      const key = day.toISOString().slice(0, 10);
      return {
        label: new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        }).format(day),
        subscribed: subscriptionChanges.get(`${key}:SUBSCRIBED`) ?? 0,
        unsubscribed: subscriptionChanges.get(`${key}:UNSUBSCRIBED`) ?? 0,
      };
    });

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Email Analytics
          </h1>
          <p className="text-sm text-[#86868b]">
            Workspace audience consent and subscription activity.
          </p>
        </div>
        <EmailAnalyticsTabs
          campaignId={activeCampaignId || undefined}
          activeTab={activeTab}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Subscribed",
              value: subscribedCount,
              note: "Eligible opted-in recipients",
              color: "text-[#16a36a]",
            },
            {
              label: "Unsubscribed",
              value: unsubscribedCount,
              note: "Opted out of email",
              color: "text-[#f79009]",
            },
            {
              label: "Consent not recorded",
              value: unknownCount,
              note: "Not eligible for campaign sends",
              color: "text-[#667085]",
            },
          ].map((metric) => (
            <div key={metric.label} className="bento-card p-5">
              <p className="text-xs font-medium text-[#667085]">
                {metric.label}
              </p>
              <p className={`mt-3 text-3xl font-semibold ${metric.color}`}>
                {metric.value.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[#86868b]">{metric.note}</p>
            </div>
          ))}
        </div>
        <SubscriptionTrendChart trend={subscriptionTrend} />
        <p className="text-[11px] text-[#667085]">
          Subscription trends use recorded consent and unsubscribe timestamps.
          Changes made before those timestamps were captured are not included.
        </p>
      </div>
    );
  }

  if (!activeCampaignId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Email Analytics
          </h1>
          <p className="text-sm text-[#86868b] mt-0.5">
            Monitor real-time open rates, click distributions, and bot
            filtering.
          </p>
        </div>
        <EmailAnalyticsTabs activeTab={activeTab} />

        <div className="apple-glass-card rounded-2xl p-12 text-center border border-black/[0.06]">
          <BarChart2 className="h-10 w-10 text-[#86868b] mx-auto mb-3 opacity-40" />
          <h3 className="text-sm font-semibold text-[#1d1d1f]">
            No campaigns found
          </h3>
          <p className="text-xs text-[#86868b] mt-1 mb-4">
            Create an email campaign and generate tracked links to view
            telemetry.
          </p>
          {canManage && (
            <Link href="/campaigns/new" className="apple-btn-primary text-xs">
              Create Campaign
            </Link>
          )}
        </div>
      </div>
    );
  }

  // Load analytics for the selected campaign
  let campaign = null;
  try {
    campaign = await prisma.campaign.findUnique({
      where: { id: activeCampaignId, workspaceId: user.workspaceId },
      select: {
        id: true,
        name: true,
        status: true,
        recipientMode: true,
        openTracking: true,
        clickTracking: true,
        links: {
          select: { id: true, originalUrl: true },
        },
      },
    });
  } catch (e) {
    console.error("DB error loading campaign analytics:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  if (!campaign) {
    return (
      <div className="apple-glass-card rounded-2xl p-8 text-center">
        <p className="text-sm text-[#86868b]">Campaign not found.</p>
        <Link href="/campaigns" className="apple-btn-primary text-xs mt-4">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const trendStart = new Date();
  trendStart.setUTCHours(0, 0, 0, 0);
  trendStart.setUTCDate(trendStart.getUTCDate() - 29);
  const eventWhere = {
    campaignId: campaign.id,
    timestamp: { gte: trendStart },
  };
  const analytics = await Promise.all([
    prisma.trackingEvent.groupBy({
      by: ["eventType"],
      where: eventWhere,
      _count: { _all: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["campaignRecipientId", "eventType"],
      where: {
        ...eventWhere,
        campaignRecipientId: { not: null },
        campaignRecipient: { is: { recipientId: { not: null } } },
        OR: [
          { NOT: { metadata: { path: ["automated_estimate"], equals: true } } },
          {
            userAgent: {
              contains: LEGACY_APPLE_BROWSER_USER_AGENT,
              mode: "insensitive",
            },
          },
        ],
      },
    }),
    prisma.trackingEvent.count({
      where: {
        ...eventWhere,
        metadata: { path: ["automated_estimate"], equals: true },
        NOT: {
          userAgent: {
            contains: LEGACY_APPLE_BROWSER_USER_AGENT,
            mode: "insensitive",
          },
        },
      },
    }),
    prisma.trackingEvent.groupBy({
      by: ["campaignLinkId", "campaignRecipientId"],
      where: {
        ...eventWhere,
        eventType: "CLICK",
        campaignLinkId: { not: null },
        campaignRecipientId: { not: null },
        campaignRecipient: { is: { recipientId: { not: null } } },
        OR: [
          { NOT: { metadata: { path: ["automated_estimate"], equals: true } } },
          {
            userAgent: {
              contains: LEGACY_APPLE_BROWSER_USER_AGENT,
              mode: "insensitive",
            },
          },
        ],
      },
    }),
    prisma.trackingEvent.groupBy({
      by: ["campaignLinkId"],
      where: { ...eventWhere, eventType: "CLICK" },
      _count: { _all: true },
    }),
    prisma.trackingEvent.findMany({
      where: eventWhere,
      take: ACTIVITY_PAGE_SIZE,
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        eventType: true,
        timestamp: true,
        userAgent: true,
        metadata: true,
        campaignRecipient: {
          select: { recipient: { select: { email: true } } },
        },
        campaignLink: { select: { originalUrl: true } },
      },
    }),
    prisma.$queryRaw<
      { day: string; eventType: "OPEN" | "CLICK"; count: number }[]
    >`
      SELECT
        TO_CHAR("timestamp" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
        "eventType"::text AS "eventType",
        COUNT(*)::int AS count
      FROM "TrackingEvent"
      WHERE "campaignId" = ${campaign.id}
        AND "timestamp" >= ${trendStart}
      GROUP BY day, "eventType"
      ORDER BY day
    `,
  ]).catch((error: unknown) => {
    console.error("DB error loading campaign analytics:", error);
    throw new Error("Unable to load campaign analytics. Please try again.");
  });
  const [
    eventCounts,
    uniqueRecipientEvents,
    automatedEventCount,
    uniqueLinkClicks,
    linkClickCounts,
    recentEvents,
    trendRows,
  ] = analytics;

  const countFor = (eventType: "OPEN" | "CLICK") =>
    eventCounts.find((event) => event.eventType === eventType)?._count._all ?? 0;
  const totalOpens = countFor("OPEN");
  const totalClicks = countFor("CLICK");
  const totalEvents = totalOpens + totalClicks;
  const uniqueOpeners = new Set(
    uniqueRecipientEvents
      .filter((event) => event.eventType === "OPEN")
      .map((event) => event.campaignRecipientId),
  ).size;
  const uniqueClickers = new Set(
    uniqueRecipientEvents
      .filter((event) => event.eventType === "CLICK")
      .map((event) => event.campaignRecipientId),
  ).size;
  const botPercentage =
    totalEvents > 0
      ? ((automatedEventCount / totalEvents) * 100).toFixed(1) + "%"
      : "0%";

  const isBotEvent = (event: (typeof recentEvents)[number]) =>
    isAutomated(event.metadata, event.userAgent);
  let mobileCount = 0;
  let desktopCount = 0;
  let proxyCount = 0;
  for (const event of recentEvents) {
    const ua = (event.userAgent || "").toLowerCase();
    if (isBotEvent(event)) proxyCount++;
    else if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android"))
      mobileCount++;
    else desktopCount++;
  }
  const recentEventsCount = recentEvents.length;

  const linkTotalById = new Map(
    linkClickCounts
      .filter((link) => link.campaignLinkId !== null)
      .map((link) => [link.campaignLinkId!, link._count._all]),
  );
  const uniqueClickersByLink = new Map<string, Set<string>>();
  for (const click of uniqueLinkClicks) {
    if (!click.campaignLinkId || !click.campaignRecipientId) continue;
    const recipientIds =
      uniqueClickersByLink.get(click.campaignLinkId) ?? new Set<string>();
    recipientIds.add(click.campaignRecipientId);
    uniqueClickersByLink.set(click.campaignLinkId, recipientIds);
  }
  const linkStats = campaign.links
    .map((link) => ({
      url: link.originalUrl,
      total: linkTotalById.get(link.id) ?? 0,
      unique: uniqueClickersByLink.get(link.id)?.size ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
  const trendCounts = new Map(
    trendRows.map((row) => [`${row.day}:${row.eventType}`, row.count]),
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
      opens: trendCounts.get(`${key}:OPEN`) ?? 0,
      clicks: trendCounts.get(`${key}:CLICK`) ?? 0,
    };
  });
  const refreshKey = new Date().toISOString();

  const sentCount = await prisma.campaignDelivery.count({
    where: {
      campaignId: campaign.id,
      workspaceId: user.workspaceId,
      status: { in: ["SENT", "DELIVERED"] },
      sentAt: { gte: trendStart },
    },
  });
  const uniqueClickThroughRate =
    sentCount > 0 ? ((uniqueClickers / sentCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with Campaign Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/campaigns"
            className="text-xs text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1.5 mb-2 transition-colors inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Campaigns
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
              {campaign.name}
            </h1>
            <span
              className={`apple-badge text-[11px] ${
                campaign.status === "ACTIVE"
                  ? "bg-[#34c759]/10 text-[#34c759]"
                  : "bg-black/[0.05] text-[#86868b]"
              }`}
            >
              {campaign.status}
            </span>
          </div>
          <p className="text-xs text-[#86868b] mt-0.5">
            Campaign performance, opens, and link engagement · last 30 days.
          </p>
        </div>

        {/* Campaign Switcher Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          <CampaignSelector value={campaign.id} campaigns={campaigns} />
          <AnalyticsRefreshButton />
        </div>
      </div>

      <EmailAnalyticsTabs campaignId={campaign.id} activeTab={activeTab} />

      {/* Apple KPI Metric Cards */}
      {(activeTab === "overview" || activeTab === "engagement") && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Opens Card */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868b]">
              Estimated Opens
            </span>
            <div className="h-8 w-8 rounded-full bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {totalOpens.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#86868b]">
              <span className="text-[#34c759] font-medium">
                {uniqueOpeners} unique
              </span>
              <span>identified recipients</span>
            </div>
          </div>
        </div>

        {/* Clicks Card */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868b]">
              Total Link Clicks
            </span>
            <div className="h-8 w-8 rounded-full bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center">
              <MousePointerClick className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {totalClicks.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#86868b]">
              <span className="text-[#ff9500] font-medium">
                {uniqueClickers} unique
              </span>
              <span>identified recipients · total includes scanner hits</span>
            </div>
          </div>
        </div>

        {/* Click-to-Open (CTOR) */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868b]">
              Click-to-Open (CTOR)
            </span>
            <div className="h-8 w-8 rounded-full bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {uniqueOpeners > 0
                ? `${((uniqueClickers / uniqueOpeners) * 100).toFixed(1)}%`
                : "0.0%"}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#86868b]">
              <span>Efficiency of message</span>
            </div>
          </div>
        </div>

        {/* Bot & Privacy Proxy Rate */}
        <div className="bento-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#86868b]">
              {activeTab === "overview"
                ? "Sent emails"
                : "MPP & Security Scanners"}
            </span>
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                activeTab === "overview"
                  ? "bg-[#0071e3]/10 text-[#0071e3]"
                  : "bg-[#af52de]/10 text-[#af52de]"
              }`}
            >
              {activeTab === "overview" ? (
                <Mail className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {activeTab === "overview"
                ? sentCount.toLocaleString()
                : botPercentage}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#86868b]">
              {activeTab === "overview" ? (
                <span>Mailer accepted for delivery · last 30 days</span>
              ) : (
                <>
                  <span className="text-[#af52de] font-medium">
                    {automatedEventCount} flagged
                  </span>
                  <span>automated events</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {(activeTab === "overview" || activeTab === "engagement") && (
        <CampaignAnalyticsCharts trend={trend} links={linkStats} />
      )}

      {activeTab === "conversions" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Sent",
                value: sentCount,
                note: "Messages accepted by the configured mailer",
              },
              {
                label: "Unique clickers",
                value: uniqueClickers,
                note: "Identified recipients with at least one click",
              },
              {
                label: "Unique click-through rate",
                value: `${uniqueClickThroughRate}%`,
                note: "Unique clickers divided by sent messages",
              },
            ].map((metric) => (
              <div key={metric.label} className="bento-card p-5">
                <p className="text-xs font-medium text-[#667085]">
                  {metric.label}
                </p>
                <p className="mt-3 text-3xl font-semibold text-[#1d1d1f]">
                  {typeof metric.value === "number"
                    ? metric.value.toLocaleString()
                    : metric.value}
                </p>
                <p className="mt-1 text-[11px] text-[#86868b]">{metric.note}</p>
              </div>
            ))}
          </div>
          <CampaignAnalyticsCharts trend={trend} links={linkStats} />
          <p className="text-[11px] text-[#667085]">
            Email clicks are the available conversion signal. Purchases and
            other business outcomes are not tracked unless a recipient clicks
            a tracked link.
          </p>
        </div>
      )}

      {/* Middle Section: Device Distribution + Link Leaderboard */}
      {activeTab === "engagement" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device & Client Breakdown (1 col) */}
        <div className="bento-card p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Client Breakdown
            </h3>
            <p className="text-xs text-[#86868b]">
              Latest {recentEventsCount} events classified by user agent. Mail
              privacy proxies can hide the recipient&apos;s actual device.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-[#515154]">
                  <Laptop className="h-3.5 w-3.5" /> Desktop Browsers
                </span>
                <span className="font-semibold text-[#1d1d1f]">
                  {desktopCount}
                </span>
              </div>
              <div className="h-2 w-full bg-black/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0071e3] rounded-full transition-all"
                  style={{
                    width: `${recentEventsCount > 0 ? (desktopCount / recentEventsCount) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-[#515154]">
                  <Smartphone className="h-3.5 w-3.5" /> Mobile Devices
                </span>
                <span className="font-semibold text-[#1d1d1f]">
                  {mobileCount}
                </span>
              </div>
              <div className="h-2 w-full bg-black/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#34c759] rounded-full transition-all"
                  style={{
                    width: `${recentEventsCount > 0 ? (mobileCount / recentEventsCount) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-[#515154]">
                  <Bot className="h-3.5 w-3.5 text-[#af52de]" /> Suspected
                  proxies and scanners
                </span>
                <span className="font-semibold text-[#1d1d1f]">
                  {proxyCount}
                </span>
              </div>
              <div className="h-2 w-full bg-black/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#af52de] rounded-full transition-all"
                  style={{
                    width: `${recentEventsCount > 0 ? (proxyCount / recentEventsCount) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#86868b] border-t border-black/[0.05]">
            Automated detection uses user-agent signatures and is an estimate;
            some privacy proxies and link scanners may appear as human traffic.
          </div>
        </div>

        {/* Link Performance Leaderboard (2 cols) */}
        <div className="lg:col-span-2 bento-card overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-black/[0.06] bg-black/[0.015]">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Link Performance Leaderboard
            </h3>
            <p className="text-xs text-[#86868b]">
              Unique counts use recipient tokens; total clicks can include
              suspected scanner requests.
            </p>
          </div>

          <div className="flex-1 overflow-x-auto">
            {linkStats.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#86868b]">
                No links registered for this campaign yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] text-[#86868b] bg-black/[0.01]">
                    <th className="px-6 py-3 font-medium">Destination URL</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Unique Clickers
                    </th>
                    <th className="px-6 py-3 font-medium text-right">
                      Total Clicks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {linkStats.map((link, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-black/[0.015] transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#0071e3] hover:underline truncate max-w-md block flex items-center gap-1.5"
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
                        </a>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-[#1d1d1f]">
                        {link.unique}
                      </td>
                      <td className="px-6 py-3.5 text-right font-medium text-[#515154]">
                        {link.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      )}

      {activeTab === "engagement" && <RecipientActivity
        key={`${campaign.id}-${refreshKey}`}
        campaignId={campaign.id}
        refreshKey={refreshKey}
        openTrackingEnabled={campaign.openTracking}
        clickTrackingEnabled={campaign.clickTracking}
      />}

      {/* Activity Timeline Stream */}
      {activeTab === "engagement" && (
      <div className="apple-glass-card rounded-2xl overflow-hidden border border-black/[0.06]">
        <div className="px-6 py-4 border-b border-black/[0.06] bg-black/[0.015] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Activity Log
            </h3>
            <p className="text-xs text-[#86868b]">
              Latest {recentEvents.length} of {totalEvents.toLocaleString()} events;
              opens are pixel estimates and automated activity is flagged.
            </p>
          </div>
          <span className="text-xs text-[#86868b]">
            {totalEvents.toLocaleString()} total records
          </span>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#86868b]">
            No activity recorded for this campaign yet. Send your email to start
            capturing events.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] max-h-96 overflow-y-auto text-xs">
            {recentEvents.map((evt) => {
              const isOpen = evt.eventType === "OPEN";
              const email =
                evt.campaignRecipient?.recipient?.email || "Unattributed recipient";
              const isBot = isBotEvent(evt);

              return (
                <div
                  key={evt.id}
                  className="px-6 py-3 hover:bg-black/[0.015] flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-6 w-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isOpen
                          ? "bg-[#34c759]/10 text-[#34c759]"
                          : "bg-[#ff9500]/10 text-[#ff9500]"
                      }`}
                    >
                      {isOpen ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <MousePointerClick className="h-3 w-3" />
                      )}
                    </span>
                    <div className="truncate">
                      <p className="font-semibold text-[#1d1d1f] truncate">
                        {email}
                      </p>
                      <p className="text-[11px] text-[#86868b] truncate mt-0.5">
                        {isOpen
                          ? "Email open recorded (pixel loaded)"
                          : `Clicked ${evt.campaignLink?.originalUrl || "tracked link"}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 text-[#86868b]">
                    {isBot && (
                      <span className="text-[10px] bg-[#af52de]/10 text-[#af52de] px-2 py-0.5 rounded-full font-medium">
                        Suspected automated
                      </span>
                    )}
                    <span className="text-[11px]">
                      {new Date(evt.timestamp).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
