"use client";

import { useState } from "react";
import {
  Settings,
  Globe,
  Shield,
  Key,
  Copy,
  Check,
  Terminal,
  Code2,
  FileCode,
  CheckCircle2,
  ExternalLink,
  Send,
  Radio,
  FileSpreadsheet,
} from "lucide-react";

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pythonSnippet = `import requests

# 1. Fetch recipient list with generated tokens from Priyo Tracker
# Replace {{PRIYO_TRACKING_TOKEN}} in the tracked campaign HTML
def blast_campaign(recipient_email, tracking_token, raw_tracked_html):
    personalized_html = raw_tracked_html.replace("{{PRIYO_TRACKING_TOKEN}}", tracking_token)
    
    # Send via Priyo Internal SMTP / SES
    send_email(
        to=recipient_email,
        subject="Important Notice Regarding Your Account",
        html_body=personalized_html
    )`;

  const nodeSnippet = `// Node.js / TypeScript Priyo SendGrid / SES Dispatcher
const sendPersonalizedBlast = async (recipient, campaignHtml) => {
  const finalHtml = campaignHtml.replaceAll(
    "{{PRIYO_TRACKING_TOKEN}}",
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          System Settings & Sending Guide
        </h1>
        <p className="text-sm text-[#86868b] mt-1">
          Send emails from Priyo Admin, blast directly via SMTP, and configure telemetry endpoints.
        </p>
      </div>

      {/* Sending Workflows Guide */}
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
              Choose whether to send mass emails from Priyo Admin or blast directly from this tracker.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Method 1 */}
          <div className="p-5 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.03] space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#0071e3] text-white text-xs font-bold flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Send from Priyo Admin & Track Here
              </h3>
            </div>
            <p className="text-xs text-[#515154] leading-relaxed">
              Generate tracked HTML in any campaign, copy it directly into <strong>Priyo Admin</strong> mass mailer or download the tokens CSV. Priyo Admin sends the blast, and Priyo Tracker automatically records opens, clicks, and device types in real-time.
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#0071e3] bg-white px-2.5 py-1 rounded-lg border border-[#0071e3]/20 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Zero SMTP setup needed in Tracker
              </span>
            </div>
          </div>

          {/* Method 2 */}
          <div className="p-5 rounded-2xl border border-[#34c759]/20 bg-[#34c759]/[0.03] space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-lg bg-[#34c759] text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-semibold text-[#1d1d1f]">
                Send Directly from Priyo Tracker
              </h3>
            </div>
            <p className="text-xs text-[#515154] leading-relaxed">
              Use the built-in <strong>"Send from Here"</strong> button on any campaign to dispatch test previews (e.g. to your inbox) or run direct audience blasts using configured SMTP (Amazon SES, SendGrid, Gmail, or Priyo mail server).
            </p>
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-[#34c759] bg-white px-2.5 py-1 rounded-lg border border-[#34c759]/20 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> Live delivery feedback & test emails
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Tracking Domain Configuration */}
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
          <span className="apple-badge bg-[#34c759]/10 text-[#34c759] text-[11px]">
            Connected
          </span>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Current Tracking Base URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={process.env.NEXT_PUBLIC_TRACKING_BASE_URL || "http://localhost:3000"}
                className="apple-input font-mono text-xs max-w-lg bg-black/[0.02]"
              />
              <span className="text-xs text-[#86868b]">Configured in .env</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-black/[0.02] border border-black/[0.05] text-xs text-[#515154] space-y-2">
            <p className="font-semibold text-[#1d1d1f]">Production DNS Setup (CNAME):</p>
            <p>
              To send emails with custom Priyo domain branding (e.g. <code>https://t.priyo.com</code>), point a CNAME DNS record from <code>t.priyo.com</code> to this server and update <code>TRACKING_BASE_URL</code>.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Developer Integration Snippets */}
      <div className="bento-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#ff9500]/10 text-[#ff9500] flex items-center justify-center">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              Priyo Sending Script Integration
            </h2>
            <p className="text-xs text-[#86868b]">
              Code snippets for your Python or Node.js sending workers.
            </p>
          </div>
        </div>

        {/* Python Snippet */}
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

        {/* Node Snippet */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-[#34c759]" /> Node.js / SendGrid Dispatcher
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
