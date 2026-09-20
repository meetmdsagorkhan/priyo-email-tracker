import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Plus } from "lucide-react";

export default async function DashboardPage() {
  // We'll mock the stats until we have real tracking data
  // but we can query campaigns if the DB is connected.
  let recentCampaigns = [];
  try {
    recentCampaigns = await prisma.campaign.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("Database not initialized or accessible yet.");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-midnight)]">Good afternoon</h1>
          <p className="text-gray-500 mt-1">Here is the latest overview of your email campaigns.</p>
        </div>
        <Link href="/campaigns/new" className="btn btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { label: "Campaigns Tracked", value: recentCampaigns.length.toString() },
          { label: "Emails Tracked", value: "0" },
          { label: "Estimated Opens", value: "0" },
          { label: "Unique Clickers", value: "0" },
        ].map((stat) => (
          <div key={stat.label} className="card">
            <h3 className="text-sm font-medium text-gray-500 mb-1">{stat.label}</h3>
            <p className="text-3xl font-bold text-[var(--color-midnight)]">{stat.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold text-[var(--color-midnight)] mb-4">Recent Campaigns</h2>
      
      <div className="card overflow-hidden p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Campaign</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Type</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Estimated Opens</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Clickers</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
              <th className="px-6 py-3 text-sm font-semibold text-gray-600">Date</th>
            </tr>
          </thead>
          <tbody>
            {recentCampaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No campaigns found. Create your first campaign to start tracking.
                </td>
              </tr>
            ) : (
              recentCampaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link href={`/campaigns/${campaign.id}`} className="font-medium text-[var(--color-midnight)] hover:text-[var(--color-amber)]">
                      {campaign.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{campaign.type}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">0</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">0</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {campaign.status}
                    </span>
                  </td>
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
