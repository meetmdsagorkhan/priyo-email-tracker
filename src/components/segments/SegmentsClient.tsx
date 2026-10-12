"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/lib/errors";

type Campaign = { id: string; name: string };
type Engagement = "OPENED" | "UNOPENED" | "CLICKED" | "NOT_CLICKED";
type Segment = {
  id: string;
  name: string;
  audienceCount: number;
  definition: { campaignId: string; engagement: Engagement };
};

const engagementLabels: Record<Engagement, string> = {
  OPENED: "Opened",
  UNOPENED: "Did not open",
  CLICKED: "Clicked a link",
  NOT_CLICKED: "Did not click a link",
};

export function SegmentsClient({
  campaigns,
  canManage,
}: {
  campaigns: Campaign[];
  canManage: boolean;
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [engagement, setEngagement] = useState<Engagement>("UNOPENED");
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSegments = useCallback(async () => {
    const response = await fetch("/api/segments");
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Unable to load segments.");
    setSegments(data);
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchSegments = async () => {
      try {
        await loadSegments();
      } catch (error) {
        if (mounted) {
          setFeedback(errorMessage(error, "Unable to load segments."));
          setFeedbackError(true);
          setLoadFailed(true);
        }
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };
    void fetchSegments();
    return () => {
      mounted = false;
    };
  }, [loadSegments]);

  const createSegment = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback("");
    setFeedbackError(false);
    try {
      const response = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, campaignId, engagement }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to create segment.");
      setName("");
      await loadSegments();
      setFeedback(`Segment saved with ${data.audienceCount} eligible recipients.`);
    } catch (error) {
      setFeedback(errorMessage(error, "Unable to create segment."));
      setFeedbackError(true);
    } finally {
      setLoading(false);
    }
  };

  const deleteSegment = async (id: string, segmentName: string) => {
    if (!window.confirm(`Delete segment "${segmentName}"?`)) return;
    setDeletingId(id);
    setFeedback("");
    setFeedbackError(false);
    try {
      const response = await fetch("/api/segments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Unable to delete segment.");
      await loadSegments();
      setFeedback("Segment deleted.");
    } catch (error) {
      setFeedback(errorMessage(error, "Unable to delete segment."));
      setFeedbackError(true);
    } finally {
      setDeletingId("");
    }
  };

  return (
    <main className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Audience segments</h1>
        <p className="mt-1 text-sm text-[#86868b]">
          Save opened, unopened, clicked, or not-clicked audiences for campaign follow-up.
          Open tracking is an estimate and may be affected by privacy proxies.
        </p>
      </header>
      {feedback && (
        <p role={feedbackError ? "alert" : "status"} className="rounded-xl border p-3 text-sm">
          {feedback}
        </p>
      )}
      {canManage && (
        <form
          onSubmit={createSegment}
          className="apple-glass-card grid gap-3 rounded-2xl border border-black/[0.06] p-4 md:grid-cols-4"
        >
          <input
            aria-label="Segment name"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Segment name"
            className="apple-input text-xs"
          />
          <select
            aria-label="Campaign"
            required
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="apple-input text-xs"
          >
            {campaigns.length ? (
              campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))
            ) : (
              <option value="">Create a campaign first</option>
            )}
          </select>
          <select
            aria-label="Engagement"
            value={engagement}
            onChange={(event) =>
              setEngagement(event.target.value as Engagement)
            }
            className="apple-input text-xs"
          >
            {Object.entries(engagementLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !campaignId}
            className="apple-btn-primary text-xs disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save segment"}
          </button>
        </form>
      )}
      <section className="space-y-3">
        {initialLoading ? (
          <p role="status" className="p-8 text-center text-sm text-[#86868b]">
            Loading segments...
          </p>
        ) : loadFailed ? null : segments.length ? (
          segments.map((segment) => (
            <article
              key={segment.id}
              className="apple-glass-card flex items-center justify-between gap-4 rounded-2xl border border-black/[0.06] p-4"
            >
              <div>
                <h2 className="font-medium">{segment.name}</h2>
                <p className="text-xs text-[#86868b]">
                  {engagementLabels[segment.definition.engagement]} ·{" "}
                  {campaigns.find(
                    (campaign) => campaign.id === segment.definition.campaignId,
                  )?.name || "Campaign"}{" "}
                  · {segment.audienceCount} eligible recipients
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => void deleteSegment(segment.id, segment.name)}
                  disabled={deletingId === segment.id}
                  className="text-xs text-red-700 hover:underline disabled:opacity-50"
                >
                  {deletingId === segment.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-[#86868b]">
            No segments saved yet. Create one from a campaign&apos;s engagement.
          </p>
        )}
      </section>
    </main>
  );
}