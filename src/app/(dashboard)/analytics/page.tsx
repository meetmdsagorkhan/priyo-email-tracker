import type { Campaign, Prisma } from "@prisma/client";
import { isAutomated } from "@/lib/errors";
import { CampaignSelector } from "@/components/campaigns/CampaignSelector";
type AnalyticsCampaign = Prisma.CampaignGetPayload<{
  include: {
    links: true;
    recipients: { include: { recipient: true } };
    events: {
      include: {
        campaignRecipient: { include: { recipient: true } };
        campaignLink: true;
      };
    };
  };
}>;
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
  Laptop,
  Smartphone,
  Bot,
  ExternalLink,
  BarChart2,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign: campaignId } = await searchParams;

  const user = await requirePageUser();
  const canManage = canManageCampaigns(user.role);
  let campaigns: Campaign[] = [];
  try {
    campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("DB connection error in AnalyticsPage:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  // If no campaign selected, show selector or first campaign
  const activeCampaignId =
    campaignId || (campaigns.length > 0 ? campaigns[0].id : null);

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
  let campaign: AnalyticsCampaign | null = null;
  try {
    campaign = await prisma.campaign.findUnique({
      where: { id: activeCampaignId },
      include: {
        links: true,
        recipients: {
          include: { recipient: true },
        },
        events: {
          orderBy: { timestamp: "desc" },
          include: {
            campaignRecipient: {
              include: { recipient: true },
            },
            campaignLink: true,
          },
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

  // Aggregation calculations

  const opens = campaign.events.filter((e) => e.eventType === "OPEN");
  const clicks = campaign.events.filter((e) => e.eventType === "CLICK");

  const totalOpens = opens.length;
  const uniqueOpeners = new Set(
    opens.map((e) => e.ipHash || e.campaignRecipientId),
  ).size;

  const totalClicks = clicks.length;
  const uniqueClickers = new Set(
    clicks.map((e) => e.ipHash || e.campaignRecipientId),
  ).size;

  // Bot filtering count
  const botEvents = campaign.events.filter((e) =>
    isAutomated(e.metadata),
  ).length;

  const botPercentage =
    campaign.events.length > 0
      ? ((botEvents / campaign.events.length) * 100).toFixed(1) + "%"
      : "0%";

  // Client device classification
  let mobileCount = 0;
  let desktopCount = 0;
  let proxyCount = 0;

  for (const evt of campaign.events) {
    const ua = (evt.userAgent || "").toLowerCase();
    const isBot = isAutomated(evt.metadata);
    if (isBot) {
      proxyCount++;
    } else if (
      ua.includes("mobile") ||
      ua.includes("iphone") ||
      ua.includes("android")
    ) {
      mobileCount++;
    } else {
      desktopCount++;
    }
  }

  // Link Performance breakdown
  const linkStats = campaign.links
    .map((link) => {
      const linkClicks = clicks.filter((c) => c.campaignLinkId === link.id);
      const unique = new Set(
        linkClicks.map((c) => c.ipHash || c.campaignRecipientId),
      ).size;
      return {
        url: link.originalUrl,
        total: linkClicks.length,
        unique: unique,
      };
    })
    .sort((a, b) => b.total - a.total);

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
            Real-time delivery telemetry, open rate tracking, and link
            engagement.
          </p>
        </div>

        {/* Campaign Switcher Dropdown */}
        <CampaignSelector value={campaign.id} campaigns={campaigns} />
      </div>

      {/* Apple KPI Metric Cards */}
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
              <span>recipients opened</span>
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
              <span>clickers verified</span>
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
              MPP & Security Scanners
            </span>
            <div className="h-8 w-8 rounded-full bg-[#af52de]/10 text-[#af52de] flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
              {botPercentage}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#86868b]">
              <span className="text-[#af52de] font-medium">
                {botEvents} filtered
              </span>
              <span>automated events</span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Device Distribution + Link Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device & Client Breakdown (1 col) */}
        <div className="bento-card p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Client Breakdown
            </h3>
            <p className="text-xs text-[#86868b]">
              Telemetry classified by user agent
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
                    width: `${campaign.events.length > 0 ? (desktopCount / campaign.events.length) * 100 : 0}%`,
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
                    width: `${campaign.events.length > 0 ? (mobileCount / campaign.events.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-[#515154]">
                  <Bot className="h-3.5 w-3.5 text-[#af52de]" /> Apple MPP /
                  Proxy Crawlers
                </span>
                <span className="font-semibold text-[#1d1d1f]">
                  {proxyCount}
                </span>
              </div>
              <div className="h-2 w-full bg-black/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#af52de] rounded-full transition-all"
                  style={{
                    width: `${campaign.events.length > 0 ? (proxyCount / campaign.events.length) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-[#86868b] border-t border-black/[0.05]">
            Apple Mail Privacy Protection (MPP) automatically pre-fetches images
            via Apple proxy servers. Our engine distinguishes these from active
            human engagement.
          </div>
        </div>

        {/* Link Performance Leaderboard (2 cols) */}
        <div className="lg:col-span-2 bento-card overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-black/[0.06] bg-black/[0.015]">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Link Performance Leaderboard
            </h3>
            <p className="text-xs text-[#86868b]">
              Top clicked URLs in this campaign
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

      {/* Activity Timeline Stream */}
      <div className="apple-glass-card rounded-2xl overflow-hidden border border-black/[0.06]">
        <div className="px-6 py-4 border-b border-black/[0.06] bg-black/[0.015] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              Activity Log
            </h3>
            <p className="text-xs text-[#86868b]">
              Chronological audit of opens and link clicks
            </p>
          </div>
          <span className="text-xs text-[#86868b]">
            {campaign.events.length} total records
          </span>
        </div>

        {campaign.events.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#86868b]">
            No activity recorded for this campaign yet. Send your email to start
            capturing events.
          </div>
        ) : (
          <div className="divide-y divide-black/[0.04] max-h-96 overflow-y-auto text-xs">
            {campaign.events.map((evt) => {
              const isOpen = evt.eventType === "OPEN";
              const email =
                evt.campaignRecipient?.recipient?.email || "Bulk Subscriber";
              const isBot = isAutomated(evt.metadata);

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
                        Bot
                      </span>
                    )}
                    <span className="text-[11px]">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
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
    </div>
  );
}
