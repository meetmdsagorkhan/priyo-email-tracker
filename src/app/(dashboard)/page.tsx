import type { Prisma } from "@prisma/client";
import { isAutomated } from "@/lib/errors";
type CampaignWithCounts = Prisma.CampaignGetPayload<{
  include: {
    _count: { select: { links: true; events: true; recipients: true } };
  };
}>;
type RecentEvent = Prisma.TrackingEventGetPayload<{
  include: {
    campaign: { select: { id: true; name: true } };
    campaignRecipient: {
      include: { recipient: { select: { email: true; firstName: true } } };
    };
    campaignLink: { select: { originalUrl: true } };
  };
}>;
import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Plus,
  Mail,
  MousePointerClick,
  Eye,
  ArrowUpRight,
  Layers,
  ChevronRight,
  Laptop,
  Smartphone,
  Bot,
  Globe,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const canManage = canManageCampaigns(user.role);
  let recentCampaigns: CampaignWithCounts[] = [];
  let totalCampaigns = 0;
  let opensCount = 0;
  let clicksCount = 0;
  let recentEvents: RecentEvent[] = [];

  try {
    const [camps, totalC, events, recents] = await Promise.all([
      prisma.campaign.findMany({
        where: { workspaceId: user.workspaceId },
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { links: true, events: true, recipients: true },
          },
        },
      }),
      prisma.campaign.count({ where: { workspaceId: user.workspaceId } }),
      prisma.trackingEvent.groupBy({
        by: ["eventType"],
        where: { campaign: { workspaceId: user.workspaceId } },
        _count: { _all: true },
      }),
      prisma.trackingEvent.findMany({
        where: { campaign: { workspaceId: user.workspaceId } },
        take: 8,
        orderBy: { timestamp: "desc" },
        include: {
          campaign: { select: { id: true, name: true } },
          campaignRecipient: {
            include: {
              recipient: { select: { email: true, firstName: true } },
            },
          },
          campaignLink: { select: { originalUrl: true } },
        },
      }),
    ]);

    recentCampaigns = camps;
    totalCampaigns = totalC;
    recentEvents = recents;

    for (const item of events) {
      if (item.eventType === "OPEN") opensCount = item._count._all;
      if (item.eventType === "CLICK") clicksCount = item._count._all;
    }
  } catch (e) {
    console.error("Database connection issue in dashboard overview:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  // Calculate greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Total click events per 100 total open events (not unique-recipient CTOR).
  const clicksPer100Opens =
    opensCount > 0 ? ((clicksCount / opensCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
            {greeting}, Team
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Recent delivery activity, link click attribution, and recipient
            analytics. Data reflects the latest page load.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/templates"
            className="apple-btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Layers className="h-3.5 w-3.5 text-[#515154]" />
            Templates Library
          </Link>
          {canManage && (
            <Link
              href="/campaigns/new"
              className="apple-btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </Link>
          )}
        </div>
      </div>

      {/* Aceternity Bento Grid KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Campaigns Bento Card */}
        <div className="bento-card p-5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Tracked Campaigns
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {totalCampaigns}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#86868b]">
              <span className="h-2 w-2 rounded-full bg-[#34c759]"></span>
              <span className="text-[#34c759] font-semibold">
                Active Engine
              </span>
              <span>• All blasts</span>
            </div>
          </div>
        </div>

        {/* Email Opens Bento Card */}
        <div className="bento-card p-5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Email Opens
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {opensCount.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#86868b]">
              <span className="font-semibold text-[#34c759]">
                1x1 Stealth Pixel
              </span>
              <span>• Zero-cache telemetry</span>
            </div>
          </div>
        </div>

        {/* Link Clicks Bento Card */}
        <div className="bento-card p-5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Total Link Clicks
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center">
              <MousePointerClick className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {clicksCount.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#86868b]">
              <span className="font-semibold text-[#ff9500]">
                Verified Tokens
              </span>
              <span>• Redirects tracked</span>
            </div>
          </div>
        </div>

        {/* Security & Bot Filtering Bento Card */}
        <div className="bento-card p-5 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
              Clicks per 100 Opens
            </span>
            <div className="h-8 w-8 rounded-xl bg-[#af52de]/10 text-[#af52de] flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-bold tracking-tight text-[#1d1d1f]">
              {clicksPer100Opens}%
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#86868b]">
              <span className="font-semibold text-[#af52de]">
                Based on total events, not unique recipients
              </span>

            </div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Campaigns (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Recent Campaigns
              </h2>
              <p className="text-xs text-[#86868b]">
                Active tracking campaigns and HTML states
              </p>
            </div>
            <Link
              href="/campaigns"
              className="text-xs font-medium text-[#0071e3] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="bento-card overflow-hidden">
            {recentCampaigns.length === 0 ? (
              <div className="py-20 px-6 text-center">
                <div className="h-12 w-12 rounded-2xl bg-black/[0.04] text-[#86868b] mx-auto flex items-center justify-center mb-3">
                  <Mail className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-semibold text-[#1d1d1f]">
                  No campaigns yet
                </h3>
                <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4">
                  Create your first email campaign to generate trackable links
                  and inject the tracking pixel.
                </p>
                {canManage && (
                  <Link
                    href="/campaigns/new"
                    className="apple-btn-primary text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create Campaign
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {recentCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-4 sm:p-5 hover:bg-black/[0.015] transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="text-sm font-semibold text-[#1d1d1f] hover:text-[#0071e3] truncate block"
                        >
                          {camp.name}
                        </Link>
                        <span
                          className={`apple-badge text-[10px] ${
                            camp.status === "ACTIVE"
                              ? "bg-[#34c759]/10 text-[#34c759] border border-[#34c759]/20"
                              : camp.status === "READY"
                                ? "bg-[#ff9500]/10 text-[#ff9500] border border-[#ff9500]/20"
                                : "bg-black/[0.05] text-[#86868b]"
                          }`}
                        >
                          {camp.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#86868b]">
                        <span className="font-medium text-[#515154]">
                          {camp.type.replace(/_/g, " ")}
                        </span>
                        <span>•</span>
                        <span>
                          {camp.recipientMode === "BULK"
                            ? "Bulk Blast"
                            : "Targeted List"}
                        </span>
                        <span>•</span>
                        <span>{camp._count?.links || 0} Links</span>
                        <span>•</span>
                        <span>{camp._count?.events || 0} Events</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/campaigns/${camp.id}`}
                        className="apple-btn-secondary text-xs px-3.5 py-1.5"
                      >
                        Studio
                      </Link>
                      <Link
                        href={`/analytics?campaign=${camp.id}`}
                        className="apple-btn-ghost text-xs p-2 text-[#0071e3]"
                        title="View analytics"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Telemetry Stream (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Recent Telemetry
              </h2>
              <p className="text-xs text-[#86868b]">
                Latest open and click events at page load
              </p>
            </div>
          </div>

          <div className="bento-card p-4 divide-y divide-black/[0.04] max-h-[480px] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#86868b]">
                <Globe className="h-8 w-8 text-[#a1a1a6] mx-auto mb-2 opacity-50" />
                No recent opens or clicks.
              </div>
            ) : (
              recentEvents.map((evt) => {
                const isOpen = evt.eventType === "OPEN";
                const isBot = isAutomated(evt.metadata);
                const email =
                  evt.campaignRecipient?.recipient?.email || "Bulk Subscriber";
                const userAgent = (evt.userAgent || "").toLowerCase();
                const isMobile =
                  userAgent.includes("mobile") || userAgent.includes("iphone");

                return (
                  <div key={evt.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-7 w-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isOpen
                              ? "bg-[#34c759]/10 text-[#34c759]"
                              : "bg-[#ff9500]/10 text-[#ff9500]"
                          }`}
                        >
                          {isOpen ? (
                            <Eye className="h-3.5 w-3.5" />
                          ) : (
                            <MousePointerClick className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-[#1d1d1f] truncate">
                            {isOpen ? "Email Opened" : "Link Clicked"}
                          </p>
                          <p className="text-[11px] text-[#86868b] truncate">
                            {evt.campaign?.name || "Campaign"}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] text-[#a1a1a6] flex-shrink-0">
                        {new Date(evt.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-[#86868b]">
                      <span className="truncate max-w-[150px] font-mono">
                        {email}
                      </span>
                      <span>•</span>
                      {isBot ? (
                        <span className="flex items-center gap-0.5 text-[#af52de]">
                          <Bot className="h-2.5 w-2.5" /> Bot/Proxy
                        </span>
                      ) : isMobile ? (
                        <span className="flex items-center gap-0.5 text-[#0071e3]">
                          <Smartphone className="h-2.5 w-2.5" /> Mobile
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-[#515154]">
                          <Laptop className="h-2.5 w-2.5" /> Desktop
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
