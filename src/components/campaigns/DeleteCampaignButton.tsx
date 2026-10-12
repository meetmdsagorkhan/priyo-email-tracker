"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteCampaignButton({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete "${campaignName}" and its tracking events? This cannot be undone.`,
      )
    )
      return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to delete campaign.");
      }
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to delete campaign.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={`Delete ${campaignName}`}
        title="Delete campaign"
        className="apple-btn-ghost text-[11px] p-1.5 text-[#ff3b30] disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && (
        <span role="alert" className="max-w-40 text-[10px] text-[#ff3b30]">
          {error}
        </span>
      )}
    </div>
  );
}
