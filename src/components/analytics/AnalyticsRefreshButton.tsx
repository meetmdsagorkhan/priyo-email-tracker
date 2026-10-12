"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { RefreshCw } from "lucide-react";

export function AnalyticsRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (!document.hidden) startTransition(() => router.refresh());
    };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#667085]">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-[#16a36a]"
        />
        Live · 30s
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        aria-label="Refresh analytics"
        className="apple-btn-secondary inline-flex items-center gap-2 text-xs disabled:cursor-wait disabled:opacity-60"
      >
        <RefreshCw
          aria-hidden
          className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
        />
        {isPending ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
