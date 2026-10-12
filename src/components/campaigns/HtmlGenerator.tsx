"use client";
import { errorMessage } from "@/lib/errors";

import { useState, useEffect, useRef } from "react";
import { useModalAccessibility } from "@/components/useModalAccessibility";
import {
  Copy,
  Download,
  Code2,
  Eye,
  Check,
  Smartphone,
  Laptop,
  Monitor,
  Sparkles,
  Link2,
  ShieldCheck,
  RefreshCw,
  Send,
  ExternalLink,
  Settings,
  Mail,
  X,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { PRIYO_MASTER_HTML } from "@/lib/templates";

interface HtmlGeneratorProps {
  campaignId: string;
  recipientMode: string;
  campaignName: string;
}

type AudienceSegment = {
  id: string;
  name: string;
  audienceCount: number;
};

export function HtmlGenerator({
  campaignId,
  campaignName,
}: HtmlGeneratorProps) {
  const [htmlInput, setHtmlInput] = useState("");
  const [processedHtml, setProcessedHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [linkCount, setLinkCount] = useState(0);
  const [detectedLinks, setDetectedLinks] = useState<
    { originalUrl: string; trackingToken: string }[]
  >([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"code" | "preview">("preview");
  const [deviceFrame, setDeviceFrame] = useState<"iphone" | "mac" | "desktop">(
    "mac",
  );

  // Modals state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const adminModalRef = useRef<HTMLDivElement>(null);
  const sendModalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(showAdminModal, adminModalRef, () => setShowAdminModal(false));
  useModalAccessibility(showSendModal, sendModalRef, () => setShowSendModal(false));
  const [segments, setSegments] = useState<AudienceSegment[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState("");

  // Direct Send Modal state
  const [sendTab, setSendTab] = useState<"test" | "blast" | "smtp">("test");
  const [testEmail, setTestEmail] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("Priyo Pay <support@priyo.com>");

useEffect(() => {
    let cancelled = false;
    fetch("/api/segments")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load saved segments.");
        if (!cancelled) setSegments(data);
      })
      .catch((error) => {
        if (!cancelled)
          setSendResult({
            success: false,
            message: errorMessage(error, "Unable to load saved segments."),
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMasterTemplate = () => {
    setHtmlInput(PRIYO_MASTER_HTML);
  };

  const handleGenerate = async () => {
    if (!htmlInput.trim()) return;
    setGenerateError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: htmlInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");

      setProcessedHtml(data.processedHtml);
      setLinkCount(data.linkCount || 0);
      setDetectedLinks(data.links || []);
    } catch (err) {
      setGenerateError(errorMessage(err, "Failed to process HTML."));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!processedHtml) return;
    navigator.clipboard.writeText(processedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!processedHtml) return;
    const blob = new Blob([processedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `priyo-${campaignName.toLowerCase().replace(/\s+/g, "-")}-tracked.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) return;

    setTestSending(true);
    setSendResult(null);

    const smtpConfig =
      smtpUser && smtpPass
        ? {
            host: smtpHost || "smtp.gmail.com",
            port: Number(smtpPort) || 587,
            user: smtpUser,
            pass: smtpPass,
            from: smtpFrom,
          }
        : undefined;
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: testEmail,
          subject: testSubject || undefined,
          htmlContent: processedHtml || htmlInput,
          smtpConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send test email");

      setSendResult({
        success: true,
        message: data.message || `Test email dispatched to ${testEmail}!`,
      });
    } catch (err) {
      setSendResult({
        success: false,
        message:
          errorMessage(err) || "Failed to send email. Check SMTP settings.",
      });
    } finally {
      setTestSending(false);
    }
  };

  const handleDirectBlast = async () => {
    if (
      !confirm(
        "Queue this campaign for delivery to its eligible audience?",
      )
    )
      return;

    setTestSending(true);
    setSendResult(null);

    const smtpConfig = smtpUser && smtpPass ? { host: smtpHost || "smtp.gmail.com", port: Number(smtpPort) || 587, user: smtpUser, pass: smtpPass, from: smtpFrom } : undefined;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send-blast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent: processedHtml || htmlInput,
          segmentId: selectedSegmentId || undefined,
          smtpConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Direct blast failed");

      setSendResult({
        success: true,
        message: data.message || "Campaign queued for delivery.",
      });
    } catch (err) {
      setSendResult({
        success: false,
        message: errorMessage(err) || "Failed to dispatch blast.",
      });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Studio Controls */}
      <div className="bento-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#1d1d1f]">
              HTML Tracking Studio
            </h2>
            <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full border border-[#0071e3]/20">
              Stealth Injector
            </span>
          </div>
          <p className="text-xs text-[#86868b] mt-0.5">
            Preserves 100% of your email HTML while replacing links with
            tracking redirects and injecting the 1x1 pixel.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!processedHtml ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={loadMasterTemplate}
                className="apple-btn-secondary text-[11px] px-3.5 py-1.5 flex items-center gap-1.5 shadow-sm"
              >
                <Sparkles className="h-3 w-3 text-[#ff9500]" /> Load Master
                Template
              </button>
              <button
                type="button"
                onClick={() =>
                  setHtmlInput(
                    `<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>Priyo Notification</title>\n</head>\n<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f;background-color:#ffffff;">\n  <h2>Headline Here</h2>\n  <p>Write your email message here...</p>\n  <p><a href="https://priyo.com" style="color:#0071e3;">Click here</a></p>\n</body>\n</html>`,
                  )
                }
                className="apple-btn-secondary text-[11px] px-3 py-1.5 flex items-center gap-1.5"
                title="Start with a minimal clean blank HTML skeleton"
              >
                <Code2 className="h-3 w-3 text-[#0071e3]" /> Blank Canvas
              </button>
              {htmlInput && (
                <button
                  type="button"
                  onClick={() => setHtmlInput("")}
                  className="apple-btn-ghost text-[11px] px-2.5 py-1 text-[#86868b] hover:text-[#ff3b30]"
                  title="Clear all text"
                >
                  Clear Editor
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setProcessedHtml("")}
                className="apple-btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 text-[#515154]"
              >
                <RefreshCw className="h-3 w-3" /> Re-edit Raw
              </button>

              {/* Workflow 1: Send from Priyo Admin */}
              <button
                onClick={() => setShowAdminModal(true)}
                className="apple-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5 text-[#191970] font-semibold bg-[#191970]/[0.06] hover:bg-[#191970]/[0.12]"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#191970]" /> Send via
                Priyo Admin
              </button>

              {/* Workflow 2: Send directly from Priyo Tracker */}
              <button
                onClick={() => setShowSendModal(true)}
                className="apple-btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 shadow-sm"
              >
                <Send className="h-3.5 w-3.5" /> Send from Here
              </button>

              <button
                onClick={handleCopy}
                className="apple-btn-secondary text-xs px-3.5 py-1.5 flex items-center gap-1.5"
                title="Copy tracked HTML to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#34c759]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy HTML
                  </>
                )}
              </button>

              <button
                onClick={handleDownload}
                className="apple-btn-ghost text-xs p-1.5 text-[#515154]"
                title="Download .html file"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {!processedHtml ? (
        /* Step 1: Input Code */
        <div className="bento-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0071e3]" /> Paste Email HTML
              Source
            </span>
            <span className="text-xs text-[#86868b]">
              HTML will be parsed without altering styles
            </span>
          </div>

          {generateError && (<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{generateError}</p>)}
          <textarea
            aria-label="Paste email HTML source" value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            placeholder="<!DOCTYPE html>&#10;<html>&#10;  <body>&#10;    <!-- Paste Priyo Pay HTML email here, or click 'Load Master Template' -->&#10;  </body>&#10;</html>"
            className="w-full h-80 font-mono text-xs p-4 rounded-xl border border-black/[0.1] bg-[#fafafc] focus:bg-white text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all resize-y"
          />

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-[#86868b] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#34c759]" />
              Safe parsing: preserves responsive tables, mobile media queries,
              and inline CSS.
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading || !htmlInput.trim()}
              className="apple-btn-primary text-xs px-5 py-2 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Processing
                  Links...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> Generate Tracked HTML
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        /* Step 2: Tracked Output with Apple Device Frames */
        <div className="space-y-6">
          {/* Status Alert Banner */}
          <div className="p-4 rounded-2xl bg-[#34c759]/10 border border-[#34c759]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-[#34c759] text-white flex items-center justify-center flex-shrink-0">
                <Check className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#1d1d1f]">
                  Tracking successfully injected!
                </p>
                <p className="text-[11px] text-[#515154]">
                  {linkCount} link{linkCount === 1 ? "" : "s"} wrapped with
                  redirect tokens • 1x1 transparent open pixel injected at end
                  of body.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="apple-btn-primary text-xs px-3.5 py-1.5 shadow-sm"
              >
                Send via Priyo Admin
              </button>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="apple-btn-secondary text-xs px-3.5 py-1.5"
              >
                Send from Here
              </button>
            </div>
          </div>

          {/* Studio Viewport Tabs & Frame Pickers */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="apple-segmented-container">
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`apple-segmented-item flex items-center gap-1.5 ${
                  activeTab === "preview" ? "apple-segmented-item-active" : ""
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> Visual Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`apple-segmented-item flex items-center gap-1.5 ${
                  activeTab === "code" ? "apple-segmented-item-active" : ""
                }`}
              >
                <Code2 className="h-3.5 w-3.5" /> Source Code
              </button>
            </div>

            {activeTab === "preview" && (
              <div className="flex items-center gap-1.5 bg-black/[0.04] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDeviceFrame("mac")}
                  title="Mac Mail Client"
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    deviceFrame === "mac"
                      ? "bg-white text-[#1d1d1f] shadow-sm"
                      : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  <Laptop className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mac Mail</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFrame("iphone")}
                  title="iPhone 16 Pro View"
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    deviceFrame === "iphone"
                      ? "bg-white text-[#1d1d1f] shadow-sm"
                      : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">iPhone</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFrame("desktop")}
                  title="Full Width Webmail"
                  className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    deviceFrame === "desktop"
                      ? "bg-white text-[#1d1d1f] shadow-sm"
                      : "text-[#86868b] hover:text-[#1d1d1f]"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Desktop</span>
                </button>
              </div>
            )}
          </div>

          {/* Viewport Display */}
          {activeTab === "preview" ? (
            <div className="flex justify-center p-4 sm:p-8 rounded-2xl bg-[#e5e5ea]/50 border border-black/[0.06] overflow-x-auto min-h-[520px]">
              {deviceFrame === "iphone" ? (
                /* iPhone 16 Pro Mockup */
                <div className="w-[375px] h-[660px] bg-black rounded-[48px] p-3 shadow-2xl relative border-4 border-[#2c2c2e] flex flex-col flex-shrink-0">
                  <div className="h-6 w-24 bg-black rounded-full mx-auto mb-2 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-[#1c1c1e] mr-2"></div>
                  </div>
                  <div className="flex-1 rounded-[36px] overflow-hidden bg-white">
                    <iframe
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={processedHtml}
                      className="w-full h-full border-0"
                      title="iPhone Preview"
                    />
                  </div>
                </div>
              ) : deviceFrame === "mac" ? (
                /* Mac Mail Window Mockup */
                <div className="w-full max-w-3xl h-[600px] bg-white rounded-2xl shadow-xl border border-black/[0.08] flex flex-col overflow-hidden flex-shrink-0">
                  <div className="h-9 bg-[#f6f6f6] border-b border-black/[0.06] px-4 flex items-center justify-between select-none">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                    </div>
                    <span className="text-xs font-medium text-[#515154]">
                      Mail — {campaignName}
                    </span>
                    <div className="w-12"></div>
                  </div>
                  <div className="flex-1 bg-white overflow-hidden">
                    <iframe
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={processedHtml}
                      className="w-full h-full border-0"
                      title="Mac Mail Preview"
                    />
                  </div>
                </div>
              ) : (
                /* Full Desktop View */
                <div className="w-full h-[600px] bg-white rounded-2xl shadow-sm border border-black/[0.08] overflow-hidden">
                  <iframe
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={processedHtml}
                    className="w-full h-full border-0"
                    title="Desktop Preview"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Code View */
            <div className="bento-card p-4">
              <textarea
                readOnly
                value={processedHtml}
                className="w-full h-[520px] font-mono text-xs p-4 rounded-xl border border-black/[0.08] bg-[#fafafc] text-[#1d1d1f] outline-none"
              />
            </div>
          )}

          {/* Link Inspector Table */}
          {detectedLinks.length > 0 && (
            <div className="bento-card overflow-hidden">
              <div className="px-6 py-4 border-b border-black/[0.06] bg-black/[0.015] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[#1d1d1f] flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-[#0071e3]" /> Monitored
                    Redirect Links ({detectedLinks.length})
                  </h3>
                  <p className="text-[11px] text-[#86868b]">
                    Every click on these links records IP hash, user-agent, and
                    recipient attribution before instant redirect.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-black/[0.04] text-xs">
                {detectedLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#1d1d1f] truncate">
                        {link.originalUrl}
                      </p>
                      <p className="font-mono text-[10px] text-[#86868b] mt-0.5">
                        Token: {link.trackingToken}
                      </p>
                    </div>
                    <span className="apple-badge bg-[#34c759]/10 text-[#34c759] text-[10px]">
                      Tracked
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SEND VIA PRIYO ADMIN & TRACK HERE                                */}
      {/* ========================================================================= */}
      {showAdminModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAdminModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        >
          <div ref={adminModalRef} role="dialog" aria-modal="true" aria-labelledby="admin-send-title" tabIndex={-1} className="apple-glass-card bg-white rounded-3xl w-full max-w-2xl max-h-[90dvh] flex flex-col shadow-2xl border border-black/[0.1] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-5 px-6 border-b border-black/[0.07] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#191970]/10 text-[#191970] flex items-center justify-center">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="admin-send-title" className="text-base font-bold text-[#1d1d1f]">
                    Send Email via Priyo Admin
                  </h3>
                  <p className="text-xs text-[#86868b]">
                    Dispatch mass email from Priyo Admin and monitor opens &
                    clicks live on this dashboard.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                aria-label="Close dialog"
                className="h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-[#1d1d1f] flex items-center justify-center transition-all shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Option 1: Bulk Campaign Mode */}
              <div className="p-5 rounded-2xl border border-[#0071e3]/20 bg-[#0071e3]/[0.03] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0071e3]">
                      Method 1: Direct HTML Blast in Priyo Admin
                    </span>
                    <span className="text-[10px] font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#515154] leading-relaxed">
                  The generated HTML already has the stealth tracking pixel and
                  all link tokens embedded.
                </p>

                <ol className="text-xs text-[#515154] space-y-2 list-decimal list-inside pl-1 bg-white p-3.5 rounded-xl border border-black/[0.06]">
                  <li>
                    Click <strong>Copy Tracked HTML</strong> below.
                  </li>
                  <li>
                    Open <strong>Priyo Admin</strong> &rarr;{" "}
                    <em>Communication / Mass Email Blast</em>.
                  </li>
                  <li>
                    Paste into the raw HTML code editor and dispatch your email
                    to all users.
                  </li>
                  <li>
                    Watch your <strong>Priyo Email Tracker Dashboard</strong>{" "}
                    update with real-time opens, device types, and link clicks!
                  </li>
                </ol>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="apple-btn-primary text-xs px-4 py-2 flex items-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-white" /> HTML Copied to
                        Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy Tracked HTML for Priyo
                        Admin
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="apple-btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download .html
                  </button>
                </div>
              </div>

              {/* Option 2: Individual Recipient Token Merge */}
              <div className="p-5 rounded-2xl border border-black/[0.08] bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1d1d1f]">
                    Method 2: Personalized Recipient Merge via CSV
                  </span>
                  <span className="text-[10px] font-semibold text-[#86868b] bg-black/[0.05] px-2 py-0.5 rounded-full">
                    Targeted
                  </span>
                </div>

                <p className="text-xs text-[#515154] leading-relaxed">
                  If you need Priyo Admin to track individual users by
                  name/customer ID, download the tokens CSV and use it with your
                  Priyo Admin mail merge template:
                </p>

                <div className="p-3 bg-black/[0.02] rounded-xl border border-black/[0.05] text-xs font-mono text-[#515154]">
                  Placeholder tag:{" "}
                  <code className="text-[#0071e3] font-bold">
                    &#123;&#123;PRIYO_TRACKING_TOKEN&#125;&#125;
                  </code>
                </div>

                <a
                  href={`/api/campaigns/${campaignId}/export-admin-csv`}
                  download
                  className="apple-btn-secondary text-xs px-4 py-2 flex items-center gap-2 inline-flex"
                >
                  <FileSpreadsheet className="h-4 w-4 text-[#34c759]" />{" "}
                  Download Priyo Admin Tokens CSV
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-black/[0.07] bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="apple-btn-secondary text-xs px-4 py-2"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SEND EMAIL DIRECTLY FROM PRIYO TRACKER                           */}
      {/* ========================================================================= */}
      {showSendModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowSendModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        >
          <div ref={sendModalRef} role="dialog" aria-modal="true" aria-labelledby="direct-send-title" tabIndex={-1} className="apple-glass-card bg-white rounded-3xl w-full max-w-xl max-h-[90dvh] flex flex-col shadow-2xl border border-black/[0.1] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="p-5 px-6 border-b border-black/[0.07] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="direct-send-title" className="text-base font-bold text-[#1d1d1f]">
                    Send Email from Priyo Tracker
                  </h3>
                  <p className="text-xs text-[#86868b]">
                    Send test messages or queue tracked campaigns for delivery.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                aria-label="Close dialog"
                className="h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/[0.12] text-[#1d1d1f] flex items-center justify-center transition-all shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="px-6 pt-4 bg-white border-b border-black/[0.04]">
              <div className="apple-segmented-container mb-3">
                <button
                  type="button"
                  onClick={() => setSendTab("test")}
                  className={`apple-segmented-item flex items-center gap-1.5 ${
                    sendTab === "test" ? "apple-segmented-item-active" : ""
                  }`}
                >
                  <Mail className="h-3.5 w-3.5" /> Send Test Email
                </button>
                <button
                  type="button"
                  onClick={() => setSendTab("blast")}
                  className={`apple-segmented-item flex items-center gap-1.5 ${
                    sendTab === "blast" ? "apple-segmented-item-active" : ""
                  }`}
                >
                  <Send className="h-3.5 w-3.5" /> Direct Audience Blast
                </button>
                <button
                  type="button"
                  onClick={() => setSendTab("smtp")}
                  className={`apple-segmented-item flex items-center gap-1.5 ${
                    sendTab === "smtp" ? "apple-segmented-item-active" : ""
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" /> SMTP Settings
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {sendResult && (
                <div
                  role={sendResult.success ? "status" : "alert"}
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 ${
                    sendResult.success
                      ? "bg-[#34c759]/10 text-[#1e8e3e] border border-[#34c759]/20"
                      : "bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20"
                  }`}
                >
                  {sendResult.success ? (
                    <Check className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>{sendResult.message}</span>
                </div>
              )}

              {sendTab === "test" && (
                <form onSubmit={handleSendTestEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                      Send Test Email To{" "}
                      <span className="text-[#ff3b30]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="e.g. sagor@priyo.com or your inbox"
                      className="apple-input text-xs"
                    />
                    <p className="text-[11px] text-[#86868b] mt-1">
                      Dispatches the full HTML with embedded tracking pixels and
                      redirect tokens to verify rendering in Apple Mail, Gmail,
                      or Outlook.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
                      Subject Line (Optional Override)
                    </label>
                    <input
                      type="text"
                      value={testSubject}
                      onChange={(e) => setTestSubject(e.target.value)}
                      placeholder={`[TEST] ${campaignName}`}
                      className="apple-input text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={testSending || !testEmail}
                      className="apple-btn-primary text-xs px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
                    >
                      {testSending ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />{" "}
                          Dispatching...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Dispatch Test Email
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {sendTab === "blast" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/[0.06] text-xs text-[#515154] space-y-2">
                    <p className="font-semibold text-[#1d1d1f]">
                      Direct Audience Blast
                    </p>
                    <p>
                      This will queue the tracked email for delivery to all
                      opted-in recipients in the Audience Directory, campaign,
                      or selected segment.
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      Campaign delivery uses the server&apos;s SMTP settings.
                      Test-only credentials entered in SMTP Settings are not
                      saved or used for queued campaigns.
                    </p>
                    <p className="text-[11px] text-[#86868b]">
                      Unsubscribed, suppressed, and unknown-consent contacts
                      are excluded. Opens can be estimated incorrectly by mail
                      privacy proxies.
                    </p>
                  </div>
                  {segments.length > 0 && (
                    <label className="block space-y-1 text-xs">
                      <span className="font-medium">Retarget a saved segment</span>
                      <select
                        value={selectedSegmentId}
                        onChange={(event) =>
                          setSelectedSegmentId(event.target.value)
                        }
                        className="apple-input text-xs"
                      >
                        <option value="">Use this campaign&apos;s audience</option>
                        {segments.map((segment) => (
                          <option key={segment.id} value={segment.id}>
                            {segment.name} ({segment.audienceCount} eligible)
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleDirectBlast}
                      disabled={testSending}
                      className="apple-btn-primary text-xs px-6 py-2.5 flex items-center gap-2 disabled:opacity-50"
                    >
                      {testSending ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />{" "}
                          Queueing Campaign...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Queue Campaign for
                          Audience
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {sendTab === "smtp" && (
                <div className="space-y-4">
                  <p className="text-xs text-[#86868b]">
                    Values entered here are used for this send only and are not
                    saved; use them only for test emails. Campaign deliveries
                    run in the background and require SMTP_HOST, SMTP_PORT,
                    SMTP_USER, SMTP_PASS, and optionally SMTP_FROM in the
                    server environment.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com or mail.priyo.com"
                        className="apple-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        SMTP Port
                      </label>
                      <input
                        type="text"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        placeholder="587"
                        className="apple-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        SMTP Username / Email
                      </label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="support@priyo.com"
                        className="apple-input text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                        SMTP Password / App Key
                      </label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="••••••••••••"
                        className="apple-input text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                      From Display Name & Email
                    </label>
                    <input
                      type="text"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="Priyo Pay <support@priyo.com>"
                      className="apple-input text-xs"
                    />
                  </div>

                  <p className="text-[11px] text-[#34c759] font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Credentials will be used
                    immediately for sends from this dialog.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 px-6 border-t border-black/[0.07] bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="apple-btn-secondary text-xs px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
