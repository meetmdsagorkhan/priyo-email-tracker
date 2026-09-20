import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { HtmlGenerator } from "@/components/campaigns/HtmlGenerator";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CampaignDetailsPage({ params }: { params: { id: string } }) {
  let campaign;
  try {
    campaign = await prisma.campaign.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { links: true, events: true, recipients: true }
        }
      }
    });
  } catch (e) {
    console.error("DB error", e);
  }

  if (!campaign) {
    notFound();
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/campaigns" className="text-gray-500 hover:text-[var(--color-midnight)] flex items-center gap-1 text-sm mb-4 inline-flex">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-midnight)]">{campaign.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                {campaign.type}
              </span>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                {campaign.status}
              </span>
              <span className="text-sm text-gray-500">
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Link href={`/analytics?campaign=${campaign.id}`} className="btn btn-outline">
              View Analytics
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {campaign.status === "DRAFT" || campaign.status === "READY" ? (
            <HtmlGenerator campaignId={campaign.id} recipientMode={campaign.recipientMode} />
          ) : (
            <div className="card">
              <h2 className="text-xl font-semibold mb-2">Campaign is Active/Archived</h2>
              <p className="text-gray-600">HTML generation is disabled for this campaign status. If you need to send it again, please duplicate the campaign.</p>
            </div>
          )}
        </div>
        
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-bold text-[var(--color-midnight)] mb-4">Campaign Details</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Subject</dt>
                <dd className="font-medium">{campaign.subject || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Preview Text</dt>
                <dd className="font-medium">{campaign.previewText || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Recipient Mode</dt>
                <dd className="font-medium">{campaign.recipientMode === "BULK" ? "Bulk Campaign" : "Selected Recipients"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Description</dt>
                <dd className="font-medium whitespace-pre-wrap mt-1">{campaign.description || "N/A"}</dd>
              </div>
            </dl>
          </div>
          
          <div className="card">
            <h3 className="font-bold text-[var(--color-midnight)] mb-4">Stats Summary</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">Tracked Links</dt>
                <dd className="font-bold">{campaign._count?.links || 0}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">Recipients</dt>
                <dd className="font-bold">{campaign._count?.recipients || 0}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">Total Events</dt>
                <dd className="font-bold">{campaign._count?.events || 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
