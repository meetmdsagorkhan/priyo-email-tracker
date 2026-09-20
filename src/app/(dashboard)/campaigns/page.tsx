import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function CampaignsPage() {
  let campaigns = [];
  try {
    campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("Database connection failed");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-midnight)]">Campaigns</h1>
          <p className="text-gray-500 mt-1">Manage and track your email campaigns.</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      <div className="card overflow-hidden p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Name</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Type</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Recipients</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No campaigns yet.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/campaigns/${campaign.id}`} className="font-medium text-[var(--color-midnight)] hover:text-[var(--color-amber)]">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{campaign.type}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-600">0</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
