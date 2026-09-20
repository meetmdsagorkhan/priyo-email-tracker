"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCampaignForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      type: formData.get("type"),
      subject: formData.get("subject"),
      previewText: formData.get("previewText"),
      description: formData.get("description"),
      recipientMode: formData.get("recipientMode"),
    };

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to create campaign");
      
      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error(error);
      alert("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-semibold mb-4 text-[var(--color-midnight)]">Campaign Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Campaign Name</label>
              <input type="text" id="name" name="name" required className="input" placeholder="e.g. Regent Account Closure" />
            </div>

            <div>
              <label className="label" htmlFor="type">Campaign Type</label>
              <select id="type" name="type" className="input" required defaultValue="ANNOUNCEMENT">
                <option value="ANNOUNCEMENT">Announcement</option>
                <option value="ACCOUNT_NOTICE">Account Notice</option>
                <option value="PROMOTIONAL">Promotional</option>
                <option value="PRODUCT_UPDATE">Product Update</option>
                <option value="EDUCATIONAL">Educational</option>
                <option value="URGENT_NOTICE">Urgent Notice</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            
            <div>
              <label className="label" htmlFor="recipientMode">Recipient Mode</label>
              <select id="recipientMode" name="recipientMode" className="input" required defaultValue="BULK">
                <option value="BULK">Bulk Campaign (Campaign-level tracking)</option>
                <option value="SELECTED">Selected Recipients (Recipient-level tracking)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Use Bulk for mass emails sent via scripts. Use Selected if you want to track individual users.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="subject">Subject Line (Optional)</label>
              <input type="text" id="subject" name="subject" className="input" placeholder="Action Required: Account Closure" />
            </div>

            <div>
              <label className="label" htmlFor="previewText">Preview Text (Optional)</label>
              <input type="text" id="previewText" name="previewText" className="input" placeholder="Please read this important notice regarding your account." />
            </div>

            <div>
              <label className="label" htmlFor="description">Description / Notes (Optional)</label>
              <textarea id="description" name="description" className="input min-h-[100px]" placeholder="Internal notes about this campaign..."></textarea>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <button type="button" onClick={() => router.back()} className="btn btn-outline">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Creating..." : "Create Campaign"}
        </button>
      </div>
    </form>
  );
}
