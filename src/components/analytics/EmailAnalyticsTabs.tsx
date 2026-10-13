import Link from "next/link";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "conversions", label: "Conversions" },
  { id: "engagement", label: "Engagement" },
  { id: "subscriptions", label: "Subscriptions" },
] as const;

export function EmailAnalyticsTabs({
  campaignId,
  activeTab,
}: {
  campaignId?: string;
  activeTab: (typeof TABS)[number]["id"];
}) {
  const campaignQuery = campaignId
    ? `campaign=${encodeURIComponent(campaignId)}&`
    : "";

  return (
    <nav
      aria-label="Email analytics sections"
      className="flex gap-6 overflow-x-auto border-b border-black/[0.08]"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/analytics?${campaignQuery}tab=${tab.id}`}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-0.5 py-3 text-sm transition-colors ${
            activeTab === tab.id
              ? "border-[#625bf6] font-semibold text-[#1d1d1f]"
              : "border-transparent text-[#667085] hover:text-[#1d1d1f]"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
