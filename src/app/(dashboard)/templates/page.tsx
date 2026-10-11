"use client";

import { useSession } from "next-auth/react";
import { canManageCampaigns } from "@/lib/permissions";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileCode2,
  Plus,
  Eye,
  ArrowRight,
  Copy,
  Check,
  Smartphone,
  Laptop,
  X,
  ShieldCheck,
} from "lucide-react";
import { OFFICIAL_TEMPLATES, TemplateItem } from "@/lib/templates";

export default function TemplatesPage() {
  const { data: session } = useSession();
  const canManage = canManageCampaigns(session?.user.role);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(
    null,
  );
  const [previewDevice, setPreviewDevice] = useState<"mac" | "iphone">("mac");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTemplate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [copyError, setCopyError] = useState("");
  const handleCopy = async (t: TemplateItem) => {
    try {
      await navigator.clipboard.writeText(t.html);
      setCopyError("");
    } catch {
      setCopyError("Clipboard unavailable. Select and copy the HTML manually.");
      return;
    }
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {copyError && (
        <p role="alert" className="text-sm text-red-700">
          {copyError}
        </p>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Email Templates Library
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Production-grade master email template containing all Priyo Pay
            design blocks and typography.
          </p>
        </div>

        {canManage && (
          <Link
            href="/campaigns/new"
            className="apple-btn-primary text-xs px-4 py-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Create New Campaign
          </Link>
        )}
      </div>

      {/* Templates Showcase Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {OFFICIAL_TEMPLATES.map((tpl) => (
          <div
            key={tpl.id}
            className="bento-card flex flex-col justify-between p-6 transition-all group lg:col-span-2"
          >
            <div>
              {/* Card Top Pill */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${tpl.badgeColor}`}
                >
                  {tpl.badge}
                </span>
                <span className="text-[11px] font-medium text-[#86868b] flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#34c759]" />{" "}
                  Certified Design System
                </span>
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-bold text-[#1d1d1f] mb-2 group-hover:text-[#0071e3] transition-colors">
                {tpl.name}
              </h3>
              <p className="text-xs text-[#86868b] leading-relaxed mb-4">
                {tpl.description}
              </p>

              {/* Component Feature Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[11px] text-[#515154]">
                <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                  <span className="font-semibold block text-[#1d1d1f]">
                    1. Hero Banner
                  </span>
                  600x250 Header & Logo
                </div>
                <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                  <span className="font-semibold block text-[#1d1d1f]">
                    2. User Profile
                  </span>
                  Avatar & Account Last 4
                </div>
                <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                  <span className="font-semibold block text-[#1d1d1f]">
                    3. Alert Boxes
                  </span>
                  Gold & Red Variant
                </div>
                <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/[0.04]">
                  <span className="font-semibold block text-[#1d1d1f]">
                    4. Steps & Receipt
                  </span>
                  Timeline & Status Badges
                </div>
              </div>

              {/* Monospace Subject Box */}
              <div className="p-3 rounded-xl bg-black/[0.02] border border-black/[0.05] text-[11px] text-[#515154] font-mono flex items-center justify-between">
                <span className="truncate">Subject: {tpl.subject}</span>
                <span className="text-[10px] text-[#86868b] uppercase tracking-wider font-sans font-semibold ml-2">
                  15 Components
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 mt-4 border-t border-black/[0.05] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedTemplate(tpl)}
                className="apple-btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
              >
                <Eye className="h-3.5 w-3.5" /> Interactive Preview
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(tpl)}
                  className="apple-btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
                  title="Copy raw HTML"
                >
                  {copiedId === tpl.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#34c759]" /> Copied
                      Code!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy HTML Source
                    </>
                  )}
                </button>
                {canManage && (
                  <Link
                    href="/campaigns/new"
                    className="apple-btn-ghost text-xs px-3 py-2 text-[#0071e3] flex items-center gap-1"
                  >
                    Use in Campaign <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Modal with PROMINENT Close Button & Device Switcher */}
      {selectedTemplate && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTemplate(null);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
        >
          <div className="apple-glass-card bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-black/[0.1] overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 px-6 border-b border-black/[0.07] flex items-center justify-between bg-white/90">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <FileCode2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1d1d1f]">
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-xs text-[#86868b] truncate max-w-md">
                    Subject: {selectedTemplate.subject}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Device frame switch */}
                <div className="apple-segmented-container hidden sm:inline-flex">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mac")}
                    className={`apple-segmented-item flex items-center gap-1.5 ${
                      previewDevice === "mac"
                        ? "apple-segmented-item-active"
                        : ""
                    }`}
                  >
                    <Laptop className="h-3.5 w-3.5" /> Mac Mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("iphone")}
                    className={`apple-segmented-item flex items-center gap-1.5 ${
                      previewDevice === "iphone"
                        ? "apple-segmented-item-active"
                        : ""
                    }`}
                  >
                    <Smartphone className="h-3.5 w-3.5" /> iPhone
                  </button>
                </div>

                {/* Highly Prominent Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  title="Close Preview (Esc)"
                  className="h-9 w-9 rounded-full bg-black/[0.06] hover:bg-black/[0.14] text-[#1d1d1f] flex items-center justify-center transition-all shadow-sm group"
                >
                  <X className="h-4 w-4 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* Modal Body: Device Frame Viewer */}
            <div className="flex-1 bg-[#f0f0f4] p-4 sm:p-8 overflow-y-auto flex items-center justify-center min-h-[480px]">
              {previewDevice === "iphone" ? (
                /* iPhone Frame Mockup */
                <div className="w-[360px] h-[600px] bg-black rounded-[44px] p-3 shadow-2xl relative border-4 border-[#2c2c2e] flex flex-col flex-shrink-0">
                  <div className="h-5 w-24 bg-black rounded-full mx-auto mb-2 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-[#1c1c1e] mr-2"></div>
                  </div>
                  <div className="flex-1 rounded-[32px] overflow-hidden bg-white">
                    <iframe
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={selectedTemplate.html}
                      className="w-full h-full border-0"
                      title="Preview"
                    />
                  </div>
                </div>
              ) : (
                /* Mac Mail Window Mockup */
                <div className="w-full max-w-2xl h-[530px] bg-white rounded-2xl shadow-xl border border-black/[0.08] flex flex-col overflow-hidden">
                  <div className="h-9 bg-[#f6f6f6] border-b border-black/[0.06] px-4 flex items-center justify-between select-none">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-[#ff5f56]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#ffbd2e]"></div>
                      <div className="h-3 w-3 rounded-full bg-[#27c93f]"></div>
                    </div>
                    <span className="text-xs font-medium text-[#515154]">
                      Mail — {selectedTemplate.name}
                    </span>
                    <div className="w-10"></div>
                  </div>
                  <iframe
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={selectedTemplate.html}
                    className="w-full h-full border-0"
                    title="Preview"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer with Actions and Close Button */}
            <div className="p-4 px-6 border-t border-black/[0.07] bg-white flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleCopy(selectedTemplate)}
                className="apple-btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {copiedId === selectedTemplate.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#34c759]" /> Copied to
                    Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy HTML Source
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="apple-btn-secondary text-xs px-4 py-2"
                >
                  Close
                </button>
                {canManage && (
                  <Link
                    href="/campaigns/new"
                    className="apple-btn-primary text-xs px-5 py-2 flex items-center gap-1.5"
                  >
                    Use in Campaign <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
