"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Settings = { configured: boolean; source: string; canEdit: boolean; host?: string; port?: number; secure?: boolean;
  user?: string; from: string; replyTo: string; hasPassword?: boolean };

export function SmtpSettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/smtp", { signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setSettings(data);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message || "Unable to load sending settings."); });
    return () => controller.abort();
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!settings) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch("/api/settings/smtp", { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: settings.host, port: settings.port, secure: settings.secure, user: settings.user,
          pass: password || undefined, from: settings.from, replyTo: settings.replyTo }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setSettings({ ...settings, configured: true, source: "WORKSPACE", hasPassword: true }); setPassword(""); setFeedback(data.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save sending settings."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm("Remove saved workspace SMTP? Future sends will use server defaults if available. Queued emails may fail if no defaults exist.")) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch("/api/settings/smtp", { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const refreshed = await fetch("/api/settings/smtp"); const next = await refreshed.json();
      if (!refreshed.ok) throw new Error(next.error); setSettings(next); setPassword(""); setFeedback(data.message);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to remove sending settings."); }
    finally { setBusy(false); }
  }
  return <section id="email-sending" aria-labelledby="smtp-settings-title" className="space-y-4 rounded-2xl border border-black/[0.08] bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h2 id="smtp-settings-title" className="text-base font-semibold">Email sending</h2>
      <p className="mt-1 text-xs text-[#515154]">Save SMTP once for this workspace. Campaigns and test emails reuse it automatically.</p></div>
      <Link href="/email-logs" className="text-xs text-violet-700 underline">View email logs</Link>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {feedback && <p role="status" className="rounded-lg bg-green-50 p-3 text-xs text-green-800">{feedback}</p>}
    {!settings ? <p className="text-xs text-[#515154]">{error ? "Reload the page to try loading settings again." : "Loading sending settings…"}</p> : <>
      <p className="text-xs text-[#515154]">{settings.source === "WORKSPACE" ? "Using saved workspace SMTP." : settings.source === "SERVER" ? "Using SMTP configured by your deployment administrator. Save a workspace configuration below to override it." : "SMTP is not configured yet."}</p>
      {!settings.canEdit ? <div className="space-y-1 text-xs text-[#515154]">
        <p>From: {settings.from || "Not configured"}</p><p>Reply-To: {settings.replyTo || "Replies go to the From address"}</p>
        <p>Ask a workspace admin to change saved credentials. You can send campaigns using the saved configuration.</p>
      </div> : <form onSubmit={save} className="space-y-4">
        <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs"><span>SMTP host</span><input required value={settings.host || ""} maxLength={254} onChange={e => setSettings({ ...settings, host: e.target.value })} placeholder="smtp.gmail.com" className="apple-input text-xs" /></label>
          <label className="block space-y-1 text-xs"><span>SMTP port</span><input required type="number" min={1} max={65535} value={settings.port || ""} onChange={e => setSettings({ ...settings, port: Number(e.target.value), secure: e.target.value === "465" })} className="apple-input text-xs" /></label>
          <label className="block space-y-1 text-xs"><span>SMTP username</span><input required autoComplete="off" maxLength={254} value={settings.user || ""} onChange={e => setSettings({ ...settings, user: e.target.value })} className="apple-input text-xs" /></label>
          <label className="block space-y-1 text-xs"><span>SMTP password / app password</span><input type="password" autoComplete="new-password" required={!settings.hasPassword} maxLength={4096} value={password} onChange={e => setPassword(e.target.value)} placeholder={settings.hasPassword ? "Saved securely — leave blank to keep" : "Enter once to save"} className="apple-input text-xs" /></label>
          <label className="block space-y-1 text-xs sm:col-span-2"><span>From address</span><input required maxLength={320} value={settings.from} onChange={e => setSettings({ ...settings, from: e.target.value })} placeholder="Your Name <you@example.com>" className="apple-input text-xs" /></label>
          <label className="block space-y-1 text-xs sm:col-span-2"><span>Default Reply-To address (optional)</span><input maxLength={320} value={settings.replyTo} onChange={e => setSettings({ ...settings, replyTo: e.target.value })} placeholder="replies@example.com" className="apple-input text-xs" /><span className="block text-[#515154]">Replies use this address, or the From address if left blank.</span></label>
          <label className="flex items-start gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={Boolean(settings.secure)} onChange={e => setSettings({ ...settings, secure: e.target.checked })} /><span>Use implicit TLS (usually port 465). Other ports use STARTTLS.</span></label>
        </fieldset>
        <p className="text-xs text-[#515154]">Passwords are encrypted on the server and never sent back to this form. For Gmail, use an app password when required by your account.</p>
        <div className="flex flex-wrap gap-2"><button type="submit" disabled={busy} className="apple-btn-primary px-4 py-2 text-xs disabled:opacity-50">{busy ? "Saving…" : "Save sending settings"}</button>
        {settings.source === "WORKSPACE" && <button type="button" disabled={busy} onClick={() => void remove()} className="apple-btn-secondary px-4 py-2 text-xs">Remove saved SMTP</button>}</div>
        <p className="text-xs text-[#515154]">Save does not send an email. Send a test from a campaign to confirm your provider accepts the message.</p>
      </form>}
    </>}
  </section>;
}
