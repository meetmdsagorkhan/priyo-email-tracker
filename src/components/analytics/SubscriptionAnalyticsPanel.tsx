"use client";

import { useEffect, useState } from "react";
import { SubscriptionTrendChart } from "./SubscriptionTrendChart";

type SubscriptionAnalytics = {
  subscribed: number;
  unsubscribed: number;
  unknown: number;
  trend: { label: string; subscribed: number; unsubscribed: number }[];
};

export function SubscriptionAnalyticsPanel() {
  const [data, setData] = useState<SubscriptionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analytics/subscriptions", { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as
          | SubscriptionAnalytics
          | { error: string };
        if (!response.ok || !("trend" in result)) {
          throw new Error(
            "error" in result
              ? result.error
              : "Unable to load subscription analytics.",
          );
        }
        setData(result);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError")
          return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load subscription analytics.",
        );
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div role="alert" className="bento-card p-8 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="space-y-5"
        role="status"
        aria-label="Loading subscription analytics"
      >
        <span className="sr-only">Loading subscription analytics</span>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="bento-card h-28 animate-pulse bg-black/[0.03]"
            />
          ))}
        </div>
        <div className="bento-card h-64 animate-pulse bg-black/[0.03]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Subscribed",
            value: data.subscribed,
            note: "Eligible opted-in recipients",
            color: "text-[#16a36a]",
          },
          {
            label: "Unsubscribed",
            value: data.unsubscribed,
            note: "Opted out of email",
            color: "text-[#f79009]",
          },
          {
            label: "Consent not recorded",
            value: data.unknown,
            note: "Not eligible for campaign sends",
            color: "text-[#667085]",
          },
        ].map((metric) => (
          <div key={metric.label} className="bento-card p-5">
            <p className="text-xs font-medium text-[#667085]">{metric.label}</p>
            <p className={`mt-3 text-3xl font-semibold ${metric.color}`}>
              {metric.value.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-[#86868b]">{metric.note}</p>
          </div>
        ))}
      </div>
      <SubscriptionTrendChart trend={data.trend} />
      <p className="text-[11px] text-[#667085]">
        Subscription trends use recorded consent and unsubscribe timestamps.
        Changes made before those timestamps were captured are not included.
      </p>
    </div>
  );
}
