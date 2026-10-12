"use client";

import { useEffect, useState } from "react";

type RecipientActivityRow = {
  id: string;
  email: string;
  deliveryStatus: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  automatedOpenAt: string | null;
  automatedClickAt: string | null;
};

type RecipientPage = {
  page: number;
  pageSize: number;
  total: number;
  recipients: RecipientActivityRow[];
};

function formatTimestamp(value: string | null) {
  return value
    ? new Date(value).toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}

export function RecipientActivity({
  campaignId,
  refreshKey,
  openTrackingEnabled,
  clickTrackingEnabled,
}: {
  campaignId: string;
  refreshKey: string;
  openTrackingEnabled: boolean;
  clickTrackingEnabled: boolean;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecipientPage | null>(null);
  const [loadState, setLoadState] = useState<{
    key: string;
    error: string | null;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${campaignId}:${page}:${refreshKey}:${retry}`;
  const currentLoad =
    loadState?.key === requestKey ? loadState : null;
  const loading = !currentLoad;
  const error = currentLoad?.error ?? null;

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `/api/campaigns/${encodeURIComponent(campaignId)}/analytics/recipients?page=${page}`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        const result: RecipientPage | { error: string } = await response.json();
        if (!response.ok || !("recipients" in result)) {
          throw new Error(
            "error" in result ? result.error : "Unable to load recipient activity.",
          );
        }
        setData(result);
        setLoadState({ key: requestKey, error: null });
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError")
          return;
        setLoadState({
          key: requestKey,
          error:
            fetchError instanceof Error
              ? fetchError.message
              : "Unable to load recipient activity.",
        });
      });

    return () => controller.abort();
  }, [campaignId, page, refreshKey, requestKey, retry]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 50)));

  return (
    <section className="apple-glass-card overflow-hidden rounded-2xl border border-black/[0.06]">
      <div className="flex flex-col gap-2 border-b border-black/[0.06] bg-black/[0.015] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1d1f]">
            Recipient activity
          </h2>
          <p className="text-xs text-[#86868b]">
            Individual delivery status and the latest estimated open and click times.
          </p>
        </div>
        {data && (
          <span className="text-xs text-[#86868b]">
            {data.total.toLocaleString()} recipients
          </span>
        )}
      </div>

      {error ? (
        <div className="p-8 text-center">
          <p role="alert" className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((current) => current + 1)}
            className="apple-btn-secondary mt-3 text-xs"
          >
            Retry
          </button>
        </div>
      ) : loading && !data ? (
        <div className="space-y-3 p-6" aria-label="Loading recipient activity">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-8 animate-pulse rounded bg-black/[0.05]" />
          ))}
        </div>
      ) : data?.recipients.length ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-black/[0.01] text-[#86868b]">
                <tr>
                  <th className="px-6 py-3 font-medium">Recipient</th>
                  <th className="px-4 py-3 font-medium">Delivery</th>
                  <th className="px-4 py-3 font-medium">Open activity</th>
                  <th className="px-6 py-3 font-medium">Click activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {data.recipients.map((recipient) => (
                  <tr key={recipient.id}>
                    <td className="px-6 py-3.5 font-medium text-[#1d1d1f]">
                      {recipient.email}
                    </td>
                    <td className="px-4 py-3.5 text-[#515154]">
                      <span className="capitalize">
                        {recipient.deliveryStatus.toLowerCase().replaceAll("_", " ")}
                      </span>
                      {recipient.sentAt && (
                        <span className="mt-0.5 block text-[11px] text-[#86868b]">
                          {formatTimestamp(recipient.sentAt)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {!openTrackingEnabled ? (
                        <span className="text-[#86868b]">Tracking disabled</span>
                      ) : recipient.openedAt ? (
                        <span className="text-[#34a853]">
                          Opened · {formatTimestamp(recipient.openedAt)}
                        </span>
                      ) : recipient.automatedOpenAt ? (
                        <span className="text-[#af52de]">
                          Suspected scanner · {formatTimestamp(recipient.automatedOpenAt)}
                        </span>
                      ) : (
                        <span className="text-[#86868b]">No pixel open observed</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      {!clickTrackingEnabled ? (
                        <span className="text-[#86868b]">Tracking disabled</span>
                      ) : recipient.clickedAt ? (
                        <span className="text-[#0071e3]">
                          Clicked · {formatTimestamp(recipient.clickedAt)}
                        </span>
                      ) : recipient.automatedClickAt ? (
                        <span className="text-[#af52de]">
                          Suspected scanner · {formatTimestamp(recipient.automatedClickAt)}
                        </span>
                      ) : (
                        <span className="text-[#86868b]">No click recorded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-black/[0.05] px-6 py-3 text-xs text-[#86868b]">
            <span>
              Page {page} of {totalPages}
              {loading ? " · Updating" : ""}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => current - 1)}
                className="apple-btn-secondary text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => current + 1)}
                className="apple-btn-secondary text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="p-8 text-center text-xs text-[#86868b]">
          No individualized delivery records are available. Manually sent bulk
          HTML without recipient-specific tracking tokens cannot be attributed
          to individual recipients.
        </div>
      )}
    </section>
  );
}
