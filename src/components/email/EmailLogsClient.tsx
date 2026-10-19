"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Mail, ChevronLeft, ChevronRight } from "lucide-react";

type Log = { id: string; campaignId: string | null; campaignName: string | null; kind: string; toEmail: string;
  subject: string; fromAddress: string | null; replyTo: string | null; status: string; attempts: number;
  messageId: string | null; lastError: string | null; queuedAt: string; sentAt: string | null;
  nextAttemptAt: string | null; deliveredAt: string | null };
type Logs = { items: Log[]; total: number; counts: Record<string, number>; nextCursor: string | null };
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
function label(log: Log) {
  if (log.status === "SENT") return "SMTP accepted";
  if (log.status === "FAILED" && log.lastError?.startsWith("SMTP accepted")) return "Confirmation uncertain";
  if (log.status === "FAILED" && log.nextAttemptAt) return "Retry scheduled";
  return ({ QUEUED: "Queued", SENDING: "Sending", DELIVERED: "Delivered", FAILED: "Failed", CANCELED: "Canceled", BOUNCED: "Bounced", COMPLAINED: "Complaint" } as Record<string, string>)[log.status] || log.status;
}
export function EmailLogsClient({ initialCampaignId = "" }: { initialCampaignId?: string }) {
  const [data, setData] = useState<Logs | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [campaign, setCampaign] = useState(initialCampaignId);
  const [cursor, setCursor] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => { setQuery(search); setCursor(""); setHistory([]); setLoading(true); }, 350);
    return () => clearTimeout(timer);
  }, [search, query]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ search: query, status, kind, cursor, campaignId: campaign });
    fetch(`/api/email-logs?${params}`, { signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setData(result); setError("");
    }).catch(error => { if (!controller.signal.aborted) setError(error.message || "Unable to load email logs."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, status, kind, cursor, campaign, revision]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") setRevision(value => value + 1); }, 30000);
    return () => clearInterval(timer);
  }, []);
  function filter(change: () => void) { setLoading(true); setError(""); setCursor(""); setHistory([]); change(); }
  const counts = data?.counts || {};
  const summaries = [ ["Queued", counts.QUEUED || 0], ["Sending", counts.SENDING || 0], ["SMTP accepted", (counts.SENT || 0) + (counts.DELIVERED || 0)], ["Failed / retrying", counts.FAILED || 0] ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-3xl font-semibold tracking-tight">Email logs</h1><p className="mt-2 max-w-2xl text-sm text-[#62596f]">Sending history for campaigns, test messages, and workspace emails. Each campaign recipient has an individual record.</p></div>
      <div className="flex gap-2"><Link href="/settings#email-sending" className="apple-btn-secondary px-3 py-2 text-xs">Sending settings</Link>
      <button type="button" disabled={loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }} className="apple-btn-secondary flex items-center gap-2 px-3 py-2 text-xs"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
    </div>
    <p className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-relaxed text-violet-900"><strong>SMTP accepted</strong> means your sending server accepted the message, not that it reached the inbox. Opens and clicks appear in Analytics. Inbox delivery, bounce, and complaint confirmation require provider feedback, which is not connected yet.</p>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{summaries.map(([title, value]) => <div key={title} className="rounded-2xl border border-black/[0.06] bg-white p-4"><p className="text-xs text-[#62596f]">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 sm:flex-row">
      <input aria-label="Search email logs" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} placeholder="Search recipient, subject, or campaign…" className="apple-input min-w-0 flex-1 text-xs" />
      <select aria-label="Email type" value={kind} onChange={e => filter(() => setKind(e.target.value))} className="apple-input text-xs sm:w-40"><option value="">All email types</option><option value="CAMPAIGN">Campaigns</option><option value="TEST">Test emails</option><option value="INVITATION">Invitations</option><option value="VERIFICATION">Account verification</option></select>
      <select aria-label="Sending status" value={status} onChange={e => filter(() => setStatus(e.target.value))} className="apple-input text-xs sm:w-44"><option value="">All statuses</option>{[["QUEUED", "Queued"], ["SENDING", "Sending"], ["SENT", "SMTP accepted"], ["FAILED", "Failed / retrying"], ["CANCELED", "Canceled"], ["DELIVERED", "Delivered"], ["BOUNCED", "Bounced"], ["COMPLAINED", "Complaint"]].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select>
    </div>
    {campaign && <p className="text-xs">Filtered to this campaign. <button type="button" onClick={() => filter(() => setCampaign(""))} className="text-violet-700 underline">Show all campaigns</button></p>}
    <p role="status" className="text-xs text-[#62596f]">{loading ? "Loading email logs…" : `${data?.total || 0} matching ${data?.total === 1 ? "email" : "emails"}. Updates every 30 seconds while this page is visible.`}</p>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : data?.items.length === 0 ? <div className="rounded-2xl border border-black/[0.06] bg-white p-10 text-center"><Mail className="mx-auto mb-3 h-7 w-7 text-violet-500" /><h2 className="font-semibold">No email logs found</h2><p className="mt-2 text-sm text-[#62596f]">Send a test or queue a campaign to see its status here, or change your filters.</p><p className="mt-3 text-xs text-[#62596f]">Existing campaign records are retained. Test emails sent before logging was added are unavailable.</p></div> : <div className="space-y-3" aria-busy={loading}>
      {data?.items.map(log => <article key={log.id} className="min-w-0 rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:justify-between">
          <div className="min-w-0"><p className="break-all text-sm font-semibold">{log.toEmail}</p><p className="mt-1 break-words text-sm text-[#514861]">{log.subject}</p><p className="mt-2 text-xs text-[#62596f]">{log.kind === "CAMPAIGN" ? "Campaign" : log.kind === "TEST" ? "Test email" : log.kind === "INVITATION" ? "Invitation" : "Account verification"}{log.campaignName ? ` · ${log.campaignName}` : ""}</p></div>
          <div className="shrink-0 text-xs sm:text-right"><span className={`inline-flex rounded-full px-2.5 py-1 font-medium ${["SENT", "DELIVERED"].includes(log.status) ? "bg-green-50 text-green-800" : ["FAILED", "BOUNCED", "COMPLAINED"].includes(log.status) ? "bg-red-50 text-red-800" : "bg-violet-50 text-violet-800"}`}>{label(log)}</span><p className="mt-2 text-[#62596f]">{log.attempts} {log.attempts === 1 ? "attempt" : "attempts"}</p></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#62596f]"><span>Queued: {date(log.queuedAt)}</span><span>SMTP accepted: {date(log.sentAt)}</span>{log.nextAttemptAt && <span>Retry eligible after: {date(log.nextAttemptAt)}</span>}</div>
        {log.lastError && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{log.lastError}</p>}
        <details className="mt-3 text-xs"><summary className="cursor-pointer text-violet-700">Message details</summary><dl className="mt-3 grid min-w-0 gap-2 text-[#514861] sm:grid-cols-2">
          <div><dt className="font-medium">From</dt><dd className="mt-1 break-all">{log.fromAddress || "Not recorded yet"}</dd></div><div><dt className="font-medium">Reply-To</dt><dd className="mt-1 break-all">{log.replyTo || (log.attempts === 0 ? "Uses saved default at send time" : "From address (default)")}</dd></div>
          <div><dt className="font-medium">Provider message ID</dt><dd className="mt-1 break-all">{log.messageId || "Not available"}</dd></div><div><dt className="font-medium">Log ID</dt><dd className="mt-1 break-all">{log.id}</dd></div>
        </dl>{log.campaignId && <div className="mt-3 flex flex-wrap gap-4"><Link href={`/campaigns/${log.campaignId}`} className="text-violet-700 underline">Open campaign</Link><Link href={`/analytics?campaign=${encodeURIComponent(log.campaignId)}&tab=engagement#recipient-activity`} className="text-violet-700 underline">View recipient tracking</Link></div>}</details>
      </article>)}
    </div>}
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={loading || !history.length} onClick={() => { setLoading(true); setCursor(history.at(-1) || ""); setHistory(history.slice(0, -1)); }} className="apple-btn-secondary flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50"><ChevronLeft className="h-4 w-4" />Previous</button><span className="text-xs text-[#62596f]">Page {history.length + 1}</span><button type="button" disabled={loading || !data?.nextCursor} onClick={() => { if (!data?.nextCursor) return; setLoading(true); setHistory([...history, cursor]); setCursor(data.nextCursor); }} className="apple-btn-secondary flex items-center gap-1 px-3 py-2 text-xs disabled:opacity-50">Next<ChevronRight className="h-4 w-4" /></button></div>
  </div>;
}
