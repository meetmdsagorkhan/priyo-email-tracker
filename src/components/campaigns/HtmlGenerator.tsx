"use client";

import { useState } from "react";
import { Copy, Download, Code, Play } from "lucide-react";

export function HtmlGenerator({ campaignId, recipientMode }: { campaignId: string, recipientMode: string }) {
  const [htmlInput, setHtmlInput] = useState("");
  const [processedHtml, setProcessedHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkCount, setLinkCount] = useState(0);
  const [view, setView] = useState<"code" | "preview">("code");

  const handleGenerate = async () => {
    if (!htmlInput) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ htmlContent: htmlInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setProcessedHtml(data.processedHtml);
      setLinkCount(data.linkCount);
    } catch (error) {
      console.error(error);
      alert("Failed to generate tracking HTML");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(processedHtml);
    alert("Copied to clipboard!");
  };

  const handleDownload = () => {
    const blob = new Blob([processedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `priyo-campaign-${campaignId}.html`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {!processedHtml ? (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 text-[var(--color-midnight)]">Step 1: Paste Email HTML</h2>
          <p className="text-sm text-gray-500 mb-4">
            Paste the exact HTML you intend to send via Priyo Pay Admin. We will preserve the design and securely inject tracking.
          </p>
          <textarea
            className="input font-mono text-xs w-full h-[300px] mb-4"
            placeholder="<html>...</html>"
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
          />
          <button
            onClick={handleGenerate}
            disabled={!htmlInput || loading}
            className="btn btn-primary"
          >
            {loading ? "Processing..." : "Generate Tracking HTML"}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="card bg-green-50 border-green-200">
            <h3 className="font-semibold text-green-800">HTML Generated Successfully!</h3>
            <p className="text-sm text-green-700 mt-1">
              Found and wrapped {linkCount} links. The tracking pixel was successfully injected.
            </p>
            {recipientMode === "SELECTED" && (
              <p className="text-sm text-amber-700 mt-2 p-2 bg-amber-50 rounded">
                <strong>Important:</strong> Because you selected Recipient-Level Tracking, the generated HTML contains the placeholder <code>{`{{PRIYO_TRACKING_TOKEN}}`}</code>. Your bulk-sending script must replace this placeholder with the actual tracking tokens for each recipient.
              </p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--color-midnight)]">Step 2: Use Your HTML</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setView(view === "code" ? "preview" : "code")}
                  className="btn btn-outline flex items-center gap-2"
                >
                  {view === "code" ? (
                    <><Play className="h-4 w-4" /> Visual Preview</>
                  ) : (
                    <><Code className="h-4 w-4" /> View Code</>
                  )}
                </button>
                <button onClick={handleDownload} className="btn btn-outline flex items-center gap-2">
                  <Download className="h-4 w-4" /> Download
                </button>
                <button onClick={handleCopy} className="btn btn-primary flex items-center gap-2">
                  <Copy className="h-4 w-4" /> Copy HTML
                </button>
              </div>
            </div>

            {view === "code" ? (
              <textarea
                readOnly
                className="input font-mono text-xs w-full h-[400px] bg-gray-50"
                value={processedHtml}
              />
            ) : (
              <div className="border border-gray-300 rounded-md p-4 bg-gray-50 h-[400px] overflow-auto">
                <iframe
                  srcDoc={processedHtml}
                  className="w-full h-full border-0 bg-white"
                  title="Email Preview"
                />
              </div>
            )}
          </div>
          
          <button onClick={() => setProcessedHtml("")} className="btn btn-outline text-sm">
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
