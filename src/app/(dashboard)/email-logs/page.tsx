import { requirePageUser } from "@/lib/access";
import { EmailLogsClient } from "@/components/email/EmailLogsClient";

export const dynamic = "force-dynamic";
export default async function EmailLogsPage({ searchParams }: { searchParams: Promise<{ campaignId?: string }> }) {
  await requirePageUser();
  const { campaignId } = await searchParams;
  return <EmailLogsClient initialCampaignId={typeof campaignId === "string" ? campaignId : ""} />;
}
