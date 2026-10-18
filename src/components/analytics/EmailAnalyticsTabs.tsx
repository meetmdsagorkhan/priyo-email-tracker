"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "conversions", label: "Conversions" },
  { id: "engagement", label: "Engagement" },
  { id: "subscriptions", label: "Subscriptions" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type TabContextValue = {
  activeTab: TabId;
  visitedTabs: Set<TabId>;
};

const AnalyticsTabContext = createContext<TabContextValue | null>(null);

export function EmailAnalyticsTabs({
  campaignId,
  activeTab: initialTab,
  children,
}: {
  campaignId?: string;
  activeTab: TabId;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([initialTab]));

  const selectTab = (tab: TabId) => {
    setActiveTab(tab);
    setVisitedTabs((visited) => new Set(visited).add(tab));

    const url = new URL(window.location.href);
    if (campaignId) url.searchParams.set("campaign", campaignId);
    else url.searchParams.delete("campaign");
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <AnalyticsTabContext.Provider value={{ activeTab, visitedTabs }}>
      <nav
        aria-label="Email analytics sections"
        role="tablist"
        className="flex gap-6 overflow-x-auto border-b border-black/[0.08]"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`analytics-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`analytics-panel-${tab.id}`}
            onClick={() => selectTab(tab.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-0.5 py-3 text-sm transition-colors ${
              activeTab === tab.id
                ? "border-[#625bf6] font-semibold text-[#1d1d1f]"
                : "border-transparent text-[#667085] hover:text-[#1d1d1f]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      {children}
    </AnalyticsTabContext.Provider>
  );
}

export function AnalyticsTabPanel({
  tab,
  children,
}: {
  tab: TabId;
  children: ReactNode;
}) {
  const context = useContext(AnalyticsTabContext);
  if (!context) {
    throw new Error("AnalyticsTabPanel must be used inside EmailAnalyticsTabs.");
  }
  if (!context.visitedTabs.has(tab)) return null;

  return (
    <section
      id={`analytics-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`analytics-tab-${tab}`}
      hidden={context.activeTab !== tab}
      className="space-y-6 pt-5"
    >
      {children}
    </section>
  );
}
