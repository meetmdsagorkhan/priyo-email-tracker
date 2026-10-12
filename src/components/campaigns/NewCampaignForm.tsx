"use client";
import { errorMessage } from "@/lib/errors";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radio, Users, ArrowRight, CheckCircle2 } from "lucide-react";

const CAMPAIGN_TYPES = [
  {
    id: "ANNOUNCEMENT",
    label: "Announcement",
    desc: "General company & service updates",
  },
  {
    id: "ACCOUNT_NOTICE",
    label: "Account Notice",
    desc: "Important user account or banking alerts",
  },
  {
    id: "PROMOTIONAL",
    label: "Promotional",
    desc: "Discounts, cashbacks & special offers",
  },
  {
    id: "PRODUCT_UPDATE",
    label: "Product Update",
    desc: "New features, app releases & changes",
  },
  {
    id: "URGENT_NOTICE",
    label: "Urgent Notice",
    desc: "Critical regulatory, KYC or action required",
  },
  {
    id: "EDUCATIONAL",
    label: "Educational",
    desc: "Guides, tutorials and financial tips",
  },
];

export function NewCampaignForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("ANNOUNCEMENT");
  const [recipientMode, setRecipientMode] = useState<"BULK" | "SELECTED">(
    "BULK",
  );
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) return;

    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName.trim(),
          type: selectedType,
          subject: subject.trim() || null,
          previewText: previewText.trim() || null,
          description: description.trim() || null,
          recipientMode,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create campaign");
      }

      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(errorMessage(err, "Failed to create campaign"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {/* 1. General Campaign Info */}
      <div className="apple-glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            1. Campaign Identity
          </h2>
          <p className="text-xs text-[#86868b] mt-0.5">
            Identify the purpose and audience of this email blast.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Campaign Name <span className="text-[#ff3b30]">*</span>
            </label>
            <input
              type="text"
              required
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g. Regent Bank Account Migration Notice"
              className="apple-input text-sm"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-2">
              Campaign Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CAMPAIGN_TYPES.map((type) => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-[#0071e3] bg-[#0071e3]/[0.04] shadow-[0_0_0_1px_#0071e3]"
                        : "border-black/[0.08] hover:border-black/[0.18] bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-[#1d1d1f]">
                        {type.label}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#0071e3]" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#86868b] line-clamp-1">
                      {type.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Recipient Tracking Strategy */}
      <div className="apple-glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 id="recipient-mode-label" className="text-lg font-semibold text-[#1d1d1f]">
            2. Recipient Tracking Strategy
          </h2>
          <p className="text-xs text-[#86868b] mt-0.5">
            Choose how opens and link clicks will be attributed to your
            recipients.
          </p>
        </div>

        <div role="radiogroup" aria-labelledby="recipient-mode-label" className="grid grid-cols-1 sm:grid-cols-2 gap-4" onKeyDown={(event) => {
          if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=radio]"));
            const index = radios.indexOf(document.activeElement as HTMLElement);
            const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            const next = radios[(index + delta + radios.length) % radios.length];
            next?.focus(); next?.click();
          }
        }}>
          {/* Bulk Option */}
          <div role="radio" aria-checked={recipientMode === "BULK"} tabIndex={recipientMode === "BULK" ? 0 : -1}
            onClick={() => setRecipientMode("BULK")}
            onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.currentTarget.click(); } }}
            className={`p-5 rounded-2xl border cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${
              recipientMode === "BULK"
                ? "border-[#0071e3] bg-[#0071e3]/[0.03] shadow-[0_0_0_1px_#0071e3]"
                : "border-black/[0.08] hover:border-black/[0.16] bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
                  <Radio className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#1d1d1f]">
                  Bulk Campaign
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2 py-0.5 rounded-full">
                Recommended
              </span>
            </div>
            <p className="text-xs text-[#86868b] mt-2">
              One universal tracking token for the entire blast. Best for mass
              newsletters and script-driven campaigns through your email
              platform. Zero
              per-email script templating needed.
            </p>
          </div>

          {/* Selected Option */}
          <div role="radio" aria-checked={recipientMode === "SELECTED"} tabIndex={recipientMode === "SELECTED" ? 0 : -1}
            onClick={() => setRecipientMode("SELECTED")}
            onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.currentTarget.click(); } }}
            className={`p-5 rounded-2xl border cursor-pointer transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0071e3] ${
              recipientMode === "SELECTED"
                ? "border-[#0071e3] bg-[#0071e3]/[0.03] shadow-[0_0_0_1px_#0071e3]"
                : "border-black/[0.08] hover:border-black/[0.16] bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-[#34c759]/10 text-[#34c759] flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#1d1d1f]">
                  Targeted Attribution
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-[#34c759] bg-[#34c759]/10 px-2 py-0.5 rounded-full">
                Per-User
              </span>
            </div>
            <p className="text-xs text-[#86868b] mt-2">
              Injects a variable placeholder{" "}
              <code className="text-[#0071e3] bg-black/[0.04] px-1 py-0.5 rounded">{`{{SIGNALPOST_TRACKING_TOKEN}}`}</code>{" "}
              into each link. Your sending script replaces it with unique
              recipient tokens to attribute individual opens and clicks.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Metadata & Email Context (Optional) */}
      <div className="apple-glass-card rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#1d1d1f]">
            3. Email Metadata (Optional)
          </h2>
          <p className="text-xs text-[#86868b] mt-0.5">
            Internal notes and subject lines for tracking records.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Action Required: Regent Account Closure"
              className="apple-input text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Preview Text
            </label>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="e.g. Please take action before October 31st"
              className="apple-input text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#1d1d1f] mb-1.5">
              Description & Operational Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Internal campaign objectives, target segment, or sending schedule..."
              className="apple-input text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Submit Footer */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="apple-btn-secondary text-xs px-5 py-2.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !campaignName.trim()}
          className="apple-btn-primary text-xs px-6 py-2.5 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Continue to HTML Studio"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
