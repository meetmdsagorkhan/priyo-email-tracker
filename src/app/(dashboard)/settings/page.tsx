"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
  Plus,
  Users,
  UserPlus,
} from "lucide-react";

type UserRecord = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
};

type InvitationRecord = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  expiresAt: string;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [invites, setInvites] = useState<InvitationRecord[]>([]);
  const [form, setForm] = useState({ name: "", email: "", role: "MEMBER" });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  const fetchAdminData = async () => {
    if (!isAdmin) {
      return;
    }

    const response = await fetch("/api/admin/invite");
    if (!response.ok) {
      return;
    }

    const data = await response.json();
    setUsers(data.users || []);
    setInvites(data.invitations || []);
  };

  useEffect(() => {
    fetchAdminData();
  }, [isAdmin]);

  const copySnippet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Unable to send invite.");
      setSubmitting(false);
      return;
    }

    setMessage(`Invite created successfully. Share this link: ${data.inviteUrl}`);
    setForm({ name: "", email: "", role: "MEMBER" });
    await fetchAdminData();
    setSubmitting(false);
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
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
          System Settings & Sending Guide
        </h1>
        <p className="text-sm text-[#86868b] mt-1">
          Send emails from Priyo Admin, blast directly via SMTP, and configure telemetry endpoints.
        </p>
      </div>

      {isAdmin && (
        <div className="bento-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Team Access & Invitations</h2>
              <p className="text-xs text-[#86868b]">
                Invite additional admins and members to the platform.
              </p>
            </div>
          </div>

          <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Full name</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="apple-input text-xs"
                placeholder="Jane Smith"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                className="apple-input text-xs"
                placeholder="teammate@company.com"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                className="apple-input text-xs"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={submitting}
                className="apple-btn-primary text-xs w-full justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
                {submitting ? "Sending..." : "Invite user"}
              </button>
            </div>
          </form>

          {message && (
            <div className="rounded-xl border border-[#34c759]/30 bg-[#34c759]/10 px-3 py-2 text-xs text-[#1d1d1f] break-all">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[#ff3b30]/30 bg-[#ff3b30]/10 px-3 py-2 text-xs text-[#ff3b30]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-[#0071e3]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Current team</h3>
              </div>
              <div className="space-y-2">
                {users.length === 0 ? (
                  <p className="text-xs text-[#86868b]">No active users yet.</p>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-[#1d1d1f]">{user.name || user.email}</p>
                        <p className="text-[11px] text-[#86868b]">{user.email}</p>
                      </div>
                      <span className="text-[10px] font-medium uppercase tracking-wide rounded-full bg-[#0071e3]/10 text-[#0071e3] px-2 py-1">
                        {user.role}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-white/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserPlus className="h-4 w-4 text-[#34c759]" />
                <h3 className="text-sm font-semibold text-[#1d1d1f]">Pending invites</h3>
              </div>
              <div className="space-y-2">
                {invites.length === 0 ? (
                  <p className="text-xs text-[#86868b]">No invites pending.</p>
                ) : (
                  invites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2">
                      <div>
                        <p className="text-xs font-medium text-[#1d1d1f]">{invite.email}</p>
                        <p className="text-[11px] text-[#86868b]">{invite.role} • {invite.status}</p>
                      </div>
                      <span className="text-[10px] font-medium text-[#86868b]">{new Date(invite.expiresAt).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="bento-card p-6 sm:p-8">
          <p className="text-sm text-[#86868b]">
            Only the default admin account can invite new admins and members.
          </p>
        </div>
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
              Choose whether to send mass emails from Priyo Admin or blast directly from this tracker.
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
