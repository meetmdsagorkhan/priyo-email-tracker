import { NewCampaignForm } from "@/components/campaigns/NewCampaignForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewCampaignPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          href="/campaigns"
          className="text-xs text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1.5 mb-2 transition-colors inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Campaigns
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          Create New Campaign
        </h1>
        <p className="text-sm text-[#86868b] mt-0.5">
          Configure campaign settings and proceed to the HTML tracking injector.
        </p>
      </div>

      <NewCampaignForm />
    </div>
  );
}
