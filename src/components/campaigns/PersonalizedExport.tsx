"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ClipboardPaste,
  Fingerprint,
  LoaderCircle,
} from "lucide-react";

export function PersonalizedExport({
  campaignId,
  htmlContent,
}: {
  campaignId: string;
  htmlContent: string;
}) {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    email: string;
    html: string;
    source: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const current =
    result?.source === htmlContent &&
    result.email === email.trim().toLowerCase()
      ? result
      : null;
  return (
    <section
      className="rounded-2xl border border-[#dfd7fa] bg-gradient-to-br from-[#faf8ff] to-white p-5 sm:p-6"
      aria-labelledby="personalized-export-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ece5ff] text-[#6a4bd8]">
          <Fingerprint size={20} aria-hidden />
        </span>
        <div>
          <h2
            id="personalized-export-title"
            className="text-base font-semibold text-[#30233f]"
          >
            Sending from Gmail, Outlook, or another tool?
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#756980]">
            Create a separate tracked copy for each recipient. Shared bulk HTML
            counts activity for the campaign, but cannot identify who opened it.
          </p>
        </div>
      </div>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setFeedback("");
          setResult(null);
          try {
            const response = await fetch(
              `/api/campaigns/${encodeURIComponent(campaignId)}/recipient-html`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, htmlContent }),
              },
            );
            const data = await response.json();
            if (!response.ok)
              throw new Error(data.error || "Unable to prepare HTML.");
            setResult({
              email: data.recipient.email,
              html: data.html,
              source: htmlContent,
            });
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Unable to prepare HTML.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="personalized-export-email"
            className="mb-1.5 block text-xs font-medium text-[#51435f]"
          >
            Recipient email in your audience
          </label>
          <input
            id="personalized-export-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="recipient@example.com"
            className="apple-input"
            autoComplete="off"
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !htmlContent.trim()}
          className="apple-btn-primary !rounded-xl !text-xs !py-3"
        >
          {busy ? (
            <LoaderCircle size={15} className="animate-spin" aria-hidden />
          ) : (
            <Fingerprint size={15} aria-hidden />
          )}
          {busy ? "Preparing…" : "Create recipient HTML"}
        </button>
      </form>
      {!htmlContent.trim() && (
        <p className="mt-2 text-xs text-[#756980]">
          Add your email HTML in the studio above to enable this export.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {current && (
        <div className="mt-4 rounded-xl border border-[#e3ddf1] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-[#365544]">
                <Check size={15} />
                Ready for {current.email}
              </p>
              <p className="mt-1 text-xs text-[#756980]">
                Use this version for this person only. Your editor must preserve
                the HTML and tracking image.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="apple-btn-primary !text-xs"
                onClick={async () => {
                  try {
                    if (typeof ClipboardItem === "undefined")
                      throw new Error("Rich clipboard unavailable");
                    const parsed = new DOMParser().parseFromString(
                      current.html,
                      "text/html",
                    );
                    await navigator.clipboard.write([
                      new ClipboardItem({
                        "text/html": new Blob([current.html], {
                          type: "text/html",
                        }),
                        "text/plain": new Blob(
                          [parsed.body.textContent || ""],
                          { type: "text/plain" },
                        ),
                      }),
                    ]);
                    setFeedback(
                      "Formatted email copied. Paste into your email composer and verify it preserves images and links before sending. Use a separate copy for each person.",
                    );
                  } catch {
                    setError(
                      "Formatted copying is unavailable in this browser. Copy HTML source into a supported HTML editor or download the file instead.",
                    );
                  }
                }}
              >
                <ClipboardPaste size={14} />
                Copy for email editor
              </button>

              <button
                type="button"
                className="apple-btn-secondary text-xs"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(current.html);
                    setFeedback(
                      "Recipient HTML copied. Paste it using your sender’s HTML mode.",
                    );
                  } catch {
                    setError(
                      "Clipboard unavailable. Download the HTML file instead.",
                    );
                  }
                }}
              >
                <Copy size={14} />
                Copy HTML
              </button>
              <button
                type="button"
                className="apple-btn-secondary text-xs"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([current.html], { type: "text/html" }),
                  );
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = "recipient-email.html";
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download size={14} />
                Download
              </button>
            </div>
          </div>
          <Link
            href={`/analytics?campaign=${encodeURIComponent(campaignId)}&tab=engagement#recipient-activity`}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#6847ca]"
          >
            View recipient activity
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
      {feedback && (
        <p role="status" className="mt-3 text-xs text-[#42634d]">
          {feedback}
        </p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-[#756980]">
        Opens are image-load observations, not proof of reading. Image blocking,
        mail privacy proxies, and forwarding affect accuracy. Test emails are
        labeled separately from campaign results.
      </p>
    </section>
  );
}
