"use client";

import { SmtpSettingsForm } from "@/components/email/SmtpSettingsForm";
import { useState } from "react";
import { ChangePassword } from "@/components/admin/ChangePassword";
import { TeamAccess } from "@/components/admin/TeamAccess";
import { Globe, Check, Terminal, Code2, FileCode, Send } from "lucide-react";

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copySnippet = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey("error");
    }
  };

  const pythonSnippet = `import requests

# 1. Fetch the recipient list and generated tokens from Signalpost
# Replace {{SIGNALPOST_TRACKING_TOKEN}} in the tracked campaign HTML
def blast_campaign(recipient_email, tracking_token, raw_tracked_html):
    personalized_html = raw_tracked_html.replace("{{SIGNALPOST_TRACKING_TOKEN}}", tracking_token)
    
    # Send via your SMTP provider or SES
    send_email(
        to=recipient_email,
        subject="Important Notice Regarding Your Account",
        html_body=personalized_html
    )`;

  const trackingBaseUrl = process.env.NEXT_PUBLIC_TRACKING_BASE_URL;
  const hasConfiguredTrackingUrl = Boolean(
    trackingBaseUrl && !/localhost|127\.0\.0\.1/i.test(trackingBaseUrl),
  );

  const nodeSnippet = `// Node.js / TypeScript SendGrid / SES dispatcher
const sendPersonalizedBlast = async (recipient, campaignHtml) => {
  const finalHtml = campaignHtml.replaceAll(
    "{{SIGNALPOST_TRACKING_TOKEN}}",
    recipient.trackingToken
  );

  await mailer.sendMail({
    to: recipient.email,
    subject: "Action Required: Account Notice",
    html: finalHtml,
  });
};`;

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          System Settings & Sending Guide
        </h1>
        <p className="text-sm text-[#86868b] mt-1">
          Send emails through your email platform or SMTP integration.
          Tracking endpoint settings are managed by your deployment administrator.
        </p>
      </div>

      <SmtpSettingsForm />
      <TeamAccess />
      <ChangePassword />
      {copiedKey === "error" && (
        <p role="alert">
          Clipboard unavailable. Select and copy the snippet manually.
        </p>
      )}

      {/* Existing settings content below remains unchanged */}
      <div className="bento-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#191970]/10 text-[#191970] flex items-center justify-center">
            <Send className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              How to Send Emails (2 Core Workflows)
            </h2>
            <p className="text-xs text-[#86868b]">
              Send through your email platform or directly from Signalpost.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-5 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.03] space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#0071e3] text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Send from Your Email Platform & Track Here
              </h3>
            </div>
            <p className="text-xs text-[#515154] leading-relaxed">
              Generate tracked HTML in any campaign, copy it into your email
              platform or download the tokens CSV. Your platform sends the
              campaign while Signalpost records opens, clicks, and device
              types in real time.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#0071e3] bg-white px-2.5 py-1 rounded-lg border border-[#0071e3]/20 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Zero SMTP setup needed in Signalpost
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-[#34c759]/20 bg-[#34c759]/[0.03] space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#34c759] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Send Directly from Signalpost
              </h3>
            </div>
            <p className="text-xs text-[#515154] leading-relaxed">
              Use the built-in <strong>&quot;Send from Here&quot;</strong>{" "}
              button on any campaign to dispatch test previews (e.g. to your
              inbox) or run direct audience blasts using configured SMTP (Amazon
              SES, SendGrid, Gmail, or your mail server).
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#34c759] bg-white px-2.5 py-1 rounded-lg border border-[#34c759]/20 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> SMTP acceptance logs & test
                emails
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bento-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                Tracking Domain & Endpoint
              </h2>
              <p className="text-xs text-[#86868b]">
                Public hostname embedded in redirect links and 1x1 image pixels.
              </p>
            </div>
          </div>
          <span className={`apple-badge text-[11px] ${hasConfiguredTrackingUrl ? "bg-[#34c759]/10 text-[#34c759]" : "bg-[#ff9500]/10 text-[#9a5700]"}`}>
            {hasConfiguredTrackingUrl ? "Configured" : "Local default"}
          </span>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="tracking-base-url" className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Current Tracking Base URL (read-only)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="tracking-base-url"
                type="text"
                readOnly
                value={trackingBaseUrl || "http://localhost:3000"}
                className="apple-input font-mono text-xs max-w-lg bg-black/[0.02]"
              />
              <span className="text-xs text-[#86868b]">Managed in deployment environment; contact your administrator to change.</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.05] text-xs text-[#515154] space-y-2">
            <p className="font-semibold text-[#1d1d1f]">
              Production DNS Setup (CNAME):
            </p>
            <p>
              For production custom-domain branding (e.g.{" "}
              <code>https://track.yourdomain.com</code>), your deployment administrator must point a CNAME DNS record from{" "}
              <code>track.yourdomain.com</code> to this server and update{" "}
              the tracking base URL in the deployment environment.
            </p>
          </div>
        </div>
      </div>

      <div className="bento-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Sending Script Integration
            </h2>
            <p className="text-xs text-[#86868b]">
              Code snippets for your Python or Node.js sending workers.
            </p>
          </div>
        </div>

        <p className="rounded-xl border border-[#0071e3]/15 bg-[#0071e3]/[0.03] p-3 text-xs text-[#515154]">
          These examples are illustrative, not runnable senders. Supply your own mailer/SMTP integration and obtain recipient addresses and tracking tokens from your workflow before using them.
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5 text-[#0071e3]" /> Python Dispatcher
            </span>
            <button
              onClick={() => copySnippet("py", pythonSnippet)}
              className="apple-btn-secondary text-[11px] px-2.5 py-1"
            >
              {copiedKey === "py" ? "Copied!" : "Copy Python"}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#1d1d1f] text-white font-mono text-xs overflow-x-auto">
            {pythonSnippet}
          </pre>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-[#34c759]" /> Node.js /
              SendGrid Dispatcher
            </span>
            <button
              onClick={() => copySnippet("node", nodeSnippet)}
              className="apple-btn-secondary text-[11px] px-2.5 py-1"
            >
              {copiedKey === "node" ? "Copied!" : "Copy Node"}
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-[#1d1d1f] text-white font-mono text-xs overflow-x-auto">
            {nodeSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
}
