import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Clock, MousePointerClick, MailOpen } from "lucide-react";

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: { campaign?: string }
}) {
  const campaignId = searchParams.campaign;

  let campaigns = [];
  try {
    campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch (e) {
    console.error("DB connection error");
  }

  if (!campaignId && campaigns.length > 0) {
    // Show a selection screen or redirect to the first campaign
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-midnight)] mb-8">Analytics</h1>
        <div className="card max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Select a campaign to view analytics</h2>
          <div className="flex flex-col gap-2">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/analytics?campaign=${c.id}`} className="block p-4 border border-gray-200 rounded-md hover:border-[var(--color-midnight)] transition-colors">
                <div className="font-semibold text-[var(--color-midnight)]">{c.name}</div>
                <div className="text-sm text-gray-500">Created: {new Date(c.createdAt).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!campaignId) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--color-midnight)] mb-8">Analytics</h1>
        <div className="card max-w-2xl">
          <p className="text-gray-500">No campaigns found. Create a campaign first.</p>
        </div>
      </div>
    );
  }

  // Load analytics for the selected campaign
  let campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      links: true,
      recipients: true,
      events: {
        orderBy: { timestamp: 'desc' },
        include: {
          campaignRecipient: {
            include: { recipient: true }
          },
          campaignLink: true
        }
      }
    }
  });

  if (!campaign) {
    return <div>Campaign not found</div>;
  }

  // Aggregation
  const totalRecipients = campaign.recipientMode === "BULK" ? "Unknown (Bulk)" : campaign.recipients.length;
  
  const opens = campaign.events.filter(e => e.eventType === "OPEN");
  const clicks = campaign.events.filter(e => e.eventType === "CLICK");

  const totalOpens = opens.length;
  const uniqueOpeners = new Set(opens.map(e => e.ipHash || e.campaignRecipientId)).size;
  
  const totalClicks = clicks.length;
  const uniqueClickers = new Set(clicks.map(e => e.ipHash || e.campaignRecipientId)).size;

  const openRate = typeof totalRecipients === "number" && totalRecipients > 0 
    ? ((uniqueOpeners / totalRecipients) * 100).toFixed(1) + "%" 
    : "N/A";

  const clickRate = typeof totalRecipients === "number" && totalRecipients > 0 
    ? ((uniqueClickers / totalRecipients) * 100).toFixed(1) + "%" 
    : "N/A";

  const clickToOpenRate = uniqueOpeners > 0
    ? ((uniqueClickers / uniqueOpeners) * 100).toFixed(1) + "%"
    : "N/A";

  // Link Performance
  const linkStats = campaign.links.map(link => {
    const linkClicks = clicks.filter(c => c.campaignLinkId === link.id);
    const unique = new Set(linkClicks.map(c => c.ipHash || c.campaignRecipientId)).size;
    return {
      url: link.originalUrl,
      total: linkClicks.length,
      unique: unique,
    };
  }).sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="mb-8">
        <Link href="/campaigns" className="text-gray-500 hover:text-[var(--color-midnight)] flex items-center gap-1 text-sm mb-4 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-midnight)]">{campaign.name} Analytics</h1>
        <p className="text-gray-500 mt-1">Detailed performance metrics for this campaign.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="card p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Recipients</h3>
          <p className="text-2xl font-bold text-[var(--color-midnight)]">{totalRecipients}</p>
        </div>
        <div className="card p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Estimated Opens</h3>
          <p className="text-2xl font-bold text-[var(--color-midnight)]">{totalOpens}</p>
          <p className="text-sm text-gray-500 mt-1">{uniqueOpeners} unique</p>
        </div>
        <div className="card p-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Total Clicks</h3>
          <p className="text-2xl font-bold text-[var(--color-midnight)]">{totalClicks}</p>
          <p className="text-sm text-gray-500 mt-1">{uniqueClickers} unique</p>
        </div>
        <div className="card p-4 bg-[var(--color-midnight)] text-white">
          <h3 className="text-xs font-medium text-blue-200 uppercase tracking-wider mb-1">Open Rate</h3>
          <p className="text-2xl font-bold">{openRate}</p>
        </div>
        <div className="card p-4 bg-[var(--color-amber)] text-[var(--color-ink)]">
          <h3 className="text-xs font-medium text-amber-900 uppercase tracking-wider mb-1">Click Rate</h3>
          <p className="text-2xl font-bold">{clickRate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-[var(--color-midnight)]">Link Performance</h2>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600">Destination URL</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Unique Clicks</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-600 text-right">Total Clicks</th>
                </tr>
              </thead>
              <tbody>
                {linkStats.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No tracked links found in this campaign.</td>
                  </tr>
                ) : (
                  linkStats.map((link, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="truncate max-w-md text-sm font-medium text-blue-600" title={link.url}>
                          <a href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-bold">{link.unique}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">{link.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="card p-0 overflow-hidden h-full max-h-[600px] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-bold text-[var(--color-midnight)]">Activity Timeline</h2>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {campaign.events.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No activity recorded yet.</p>
              ) : (
                <div className="space-y-6">
                  {campaign.events.slice(0, 50).map((event) => {
                    const recipientEmail = event.campaignRecipient?.recipient?.email || "Unknown Recipient (Bulk)";
                    const isAutomated = (event.metadata as any)?.automated_estimate;
                    
                    return (
                      <div key={event.id} className="relative pl-6 border-l-2 border-gray-200">
                        <div className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full ${event.eventType === 'OPEN' ? 'bg-blue-400' : 'bg-amber-400'}`}></div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-[var(--color-midnight)]">{recipientEmail}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            {event.eventType === 'OPEN' ? (
                              <><MailOpen className="h-3 w-3 text-blue-500" /> Opened email</>
                            ) : (
                              <><MousePointerClick className="h-3 w-3 text-amber-500" /> Clicked link</>
                            )}
                            
                            {isAutomated && (
                              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Possible Bot</span>
                            )}
                          </div>
                          
                          {event.eventType === 'CLICK' && event.campaignLink && (
                            <div className="text-xs text-blue-500 truncate bg-blue-50 p-1.5 rounded mt-1">
                              {event.campaignLink.originalUrl}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
