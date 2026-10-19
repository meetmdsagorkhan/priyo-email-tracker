import type { Prisma } from "@prisma/client";
type CampaignWithCounts = Prisma.CampaignGetPayload<{
  include: {
    _count: { select: { links: true; events: true; recipients: true } };
  };
}>;
import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { HtmlGenerator } from "@/components/campaigns/HtmlGenerator";
import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  let campaign: CampaignWithCounts | null = null;
  try {
    campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: user.workspaceId },
      include: {
        _count: {
          select: { links: true, events: true, recipients: true },
        },
      },
    });
  } catch (e) {
    console.error("DB error in CampaignDetailsPage:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Breadcrumb & Actions */}
      <div>
        <Link
          href="/campaigns"
          className="text-xs text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1.5 mb-2 transition-colors inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
                {campaign.name}
              </h1>
              <span
                className={`apple-badge text-[11px] ${
                  campaign.status === "ACTIVE"
                    ? "bg-[#34c759]/10 text-[#34c759]"
                    : campaign.status === "READY"
                      ? "bg-[#ff9500]/10 text-[#ff9500]"
                      : "bg-black/[0.05] text-[#86868b]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    campaign.status === "ACTIVE"
                      ? "bg-[#34c759]"
                      : campaign.status === "READY"
                        ? "bg-[#ff9500]"
                        : "bg-[#86868b]"
                  }`}
                ></span>
                {campaign.status}
              </span>
            </div>
            <p className="text-xs text-[#86868b] mt-1">
              {campaign.type.replace(/_/g, " ")} • Created{" "}
              {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/email-logs?campaignId=${campaign.id}`} className="apple-btn-secondary text-xs px-4 py-2">Email logs</Link>
            <Link
              href={`/analytics?campaign=${campaign.id}`}
              className="apple-btn-secondary text-xs px-4 py-2"
            >
              <BarChart3 className="h-3.5 w-3.5 text-[#0071e3]" />
              Detailed Analytics
            </Link>
          </div>
        </div>
      </div>

      {/* Campaign Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="apple-glass-card rounded-2xl p-4">
          <span className="text-[11px] font-medium text-[#86868b]">
            Recipient Mode
          </span>
          <p className="text-base font-semibold text-[#1d1d1f] mt-1">
            {campaign.recipientMode === "BULK"
              ? "Bulk Campaign"
              : "Targeted List"}
          </p>
          <p className="text-[10px] text-[#86868b] mt-0.5">
            {campaign.recipientMode === "BULK"
              ? "Universal blast tracking"
              : `${campaign._count?.recipients || 0} individual recipients`}
          </p>
        </div>

        <div className="apple-glass-card rounded-2xl p-4">
          <span className="text-[11px] font-medium text-[#86868b]">
            Tracked Links
          </span>
          <p className="text-base font-semibold text-[#1d1d1f] mt-1">
            {campaign._count?.links || 0} Links
          </p>
          <p className="text-[10px] text-[#86868b] mt-0.5">
            Redirect tokens generated
          </p>
        </div>

        <div className="apple-glass-card rounded-2xl p-4">
          <span className="text-[11px] font-medium text-[#86868b]">
            Telemetry Recorded
          </span>
          <p className="text-base font-semibold text-[#1d1d1f] mt-1">
            {campaign._count?.events || 0} Events
          </p>
          <p className="text-[10px] text-[#86868b] mt-0.5">
            Total opens and clicks
          </p>
        </div>

        <div className="apple-glass-card rounded-2xl p-4">
          <span className="text-[11px] font-medium text-[#86868b]">
            Subject Line
          </span>
          <p className="text-base font-semibold text-[#1d1d1f] mt-1 truncate">
            {campaign.subject || "Not specified"}
          </p>
          <p className="text-[10px] text-[#86868b] mt-0.5 truncate">
            {campaign.previewText || "No preview text"}
          </p>
        </div>
      </div>

      {/* HTML Generator Studio */}
      {canManageCampaigns(user.role) ? (
        <HtmlGenerator
          campaignId={campaign.id}
          recipientMode={campaign.recipientMode}
          campaignName={campaign.name}
        />
      ) : (
        <p className="bento-card p-6 text-sm text-[#515154]">
          Your role has read-only access. Ask a campaign manager to edit or send
          this campaign.
        </p>
      )}
    </div>
  );
}
