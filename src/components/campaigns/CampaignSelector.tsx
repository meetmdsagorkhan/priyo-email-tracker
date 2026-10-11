"use client";
import { useRouter } from "next/navigation";
export function CampaignSelector({
  value,
  campaigns,
}: {
  value: string;
  campaigns: { id: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="analytics-campaign" className="text-sm text-[#515154]">
        Campaign
      </label>
      <select
        id="analytics-campaign"
        value={value}
        onChange={(e) =>
          router.push(
            `/analytics?campaign=${encodeURIComponent(e.target.value)}`,
          )
        }
        className="apple-input !w-auto max-w-full"
      >
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name}
          </option>
        ))}
      </select>
    </div>
  );
}
