import { NewCampaignForm } from "@/components/campaigns/NewCampaignForm";

export default function NewCampaignPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-midnight)]">Create Campaign</h1>
        <p className="text-gray-500 mt-1">Set up a new email campaign for tracking.</p>
      </div>
      
      <div className="max-w-4xl">
        <NewCampaignForm />
      </div>
    </div>
  );
}
