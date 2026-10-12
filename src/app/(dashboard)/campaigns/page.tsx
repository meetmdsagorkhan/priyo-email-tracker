import type { Prisma } from "@prisma/client";
type CampaignWithCounts = Prisma.CampaignGetPayload<{
  include: {
    _count: { select: { links: true; events: true; recipients: true } };
  };
}>;
import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import Link from "next/link";
import { Plus, Megaphone, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { DeleteCampaignButton } from "@/components/campaigns/DeleteCampaignButton";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await requirePageUser();
  const canManage = canManageCampaigns(user.role);
  let campaigns: CampaignWithCounts[] = [];
  try {
    campaigns = await prisma.campaign.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { links: true, events: true, recipients: true },
        },
      },
    });
  } catch (e) {
    console.error("Database connection failed in CampaignsPage:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Email Campaigns
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Create, manage, and track your email campaigns (
            {campaigns.length} total).
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManage && (
            <Link
              href="/campaigns/new"
              className="apple-btn-primary text-xs px-4 py-2"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </Link>
          )}
        </div>
      </div>

      {/* Campaigns Listing Card */}
      <div className="bento-card overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="h-12 w-12 rounded-2xl bg-black/[0.04] text-[#86868b] mx-auto flex items-center justify-center mb-3">
              <Megaphone className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              No campaigns created yet
            </h3>
            <p className="text-xs text-[#86868b] max-w-sm mx-auto mt-1 mb-4">
              Get started by creating your first campaign to inject tracking
              pixels and generate monitored redirect links.
            </p>
            {canManage && (
              <Link href="/campaigns/new" className="apple-btn-primary text-xs">
                <Plus className="h-3.5 w-3.5" />
                Create First Campaign
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.02] text-[#86868b] font-medium">
                  <th className="px-6 py-3.5 font-medium">Campaign Name</th>
                  <th className="px-4 py-3.5 font-medium">Category</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  <th className="px-4 py-3.5 font-medium">Recipient Mode</th>
                  <th className="px-4 py-3.5 font-medium text-right">Links</th>
                  <th className="px-4 py-3.5 font-medium text-right">Events</th>
                  <th className="px-6 py-3.5 font-medium text-right">
                    Created
                  </th>
                  <th className="px-4 py-3.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {campaigns.map((camp) => (
                  <tr
                    key={camp.id}
                    className="hover:bg-black/[0.015] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="font-semibold text-sm text-[#1d1d1f] hover:text-[#0071e3] transition-colors"
                        >
                          {camp.name}
                        </Link>
                        {camp.subject && (
                          <span className="text-[11px] text-[#86868b] truncate max-w-xs mt-0.5">
                            {camp.subject}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-[#515154]">
                      <span className="px-2 py-0.5 rounded-md bg-black/[0.04] text-[11px] font-medium">
                        {camp.type.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`apple-badge text-[11px] ${
                          camp.status === "ACTIVE"
                            ? "bg-[#34c759]/10 text-[#34c759]"
                            : camp.status === "READY"
                              ? "bg-[#ff9500]/10 text-[#ff9500]"
                              : camp.status === "COMPLETED"
                                ? "bg-[#0071e3]/10 text-[#0071e3]"
                                : "bg-black/[0.05] text-[#86868b]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            camp.status === "ACTIVE"
                              ? "bg-[#34c759]"
                              : camp.status === "READY"
                                ? "bg-[#ff9500]"
                                : camp.status === "COMPLETED"
                                  ? "bg-[#0071e3]"
                                  : "bg-[#86868b]"
                          }`}
                        ></span>
                        {camp.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-[#515154]">
                      {camp.recipientMode === "BULK" ? (
                        <span className="text-[11px] text-[#86868b] font-medium">
                          Bulk Blast
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#0071e3] font-medium">
                          Targeted ({camp._count?.recipients || 0})
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-right font-medium text-[#1d1d1f]">
                      {camp._count?.links || 0}
                    </td>

                    <td className="px-4 py-4 text-right font-medium text-[#1d1d1f]">
                      {camp._count?.events || 0}
                    </td>

                    <td className="px-6 py-4 text-right text-[#86868b]">
                      {new Date(camp.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/campaigns/${camp.id}`}
                          className="apple-btn-secondary text-[11px] px-2.5 py-1"
                        >
                          Studio
                        </Link>
                        <Link
                          href={`/analytics?campaign=${camp.id}`}
                          className="apple-btn-ghost text-[11px] p-1.5 text-[#0071e3]"
                          title="View Analytics"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        {canManage && (
                          <DeleteCampaignButton
                            campaignId={camp.id}
                            campaignName={camp.name}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
