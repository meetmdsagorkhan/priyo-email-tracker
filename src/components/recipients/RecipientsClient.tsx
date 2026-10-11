"use client";
import { errorMessage } from "@/lib/errors";

import { useState } from "react";
import {
  Users,
  Plus,
  Upload,
  Search,
  Check,
  X,
  FileSpreadsheet,
} from "lucide-react";

interface Recipient {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  customerId: string | null;
  createdAt: string;
  _count?: {
    campaigns: number;
  };
}

export function RecipientsClient({
  initialRecipients,
  canManage,
}: {
  initialRecipients: Recipient[];
  canManage: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Add Form state
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(false);

  // CSV Import state
  const [csvPreview, setCsvPreview] = useState<
    { email: string; firstName: string; lastName: string; customerId: string }[]
  >([]);
  const [csvLoading, setCsvLoading] = useState(false);

  const filteredRecipients = recipients.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.email.toLowerCase().includes(q) ||
      (r.firstName && r.firstName.toLowerCase().includes(q)) ||
      (r.lastName && r.lastName.toLowerCase().includes(q)) ||
      (r.customerId && r.customerId.toLowerCase().includes(q))
    );
  });

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName, customerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRecipients([
        data,
        ...recipients.filter((recipient) => recipient.id !== data.id),
      ]);
      setShowAddModal(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setCustomerId("");
    } catch (err) {
      setFeedback(errorMessage(err, "Failed to add recipient"));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) return;

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const parsed: {
        email: string;
        firstName: string;
        lastName: string;
        customerId: string;
      }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length === 0 || !parts[0]) continue;

        const row: Record<string, string> = {};
        header.forEach((h, index) => {
          row[h] = parts[index] || "";
        });

        // Ensure email exists
        if (row.email && row.email.includes("@")) {
          parsed.push({
            email: row.email,
            firstName: row.firstname || row.first_name || row.name || "",
            lastName: row.lastname || row.last_name || "",
            customerId: row.customerid || row.customer_id || row.id || "",
          });
        }
      }

      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (csvPreview.length === 0) return;
    setCsvLoading(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(csvPreview),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback(`Successfully imported ${data.count} recipients.`);
      setShowImportModal(false);
      setCsvPreview([]);
      // Reload page to reflect full list
      window.location.reload();
    } catch (err) {
      setFeedback(errorMessage(err, "Failed to import CSV"));
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {feedback}
        </p>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Recipients Directory
          </h1>
          <p className="text-sm text-[#86868b] mt-1">
            Manage customer directories for targeted recipient-level link
            attribution ({recipients.length} registered profiles).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setShowImportModal(true)}
            className="apple-btn-secondary text-xs px-3.5 py-2 flex items-center gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </button>
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setShowAddModal(true)}
            className="apple-btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Add Recipient
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="apple-glass-card rounded-2xl p-3 border border-black/[0.06] flex items-center gap-3">
        <Search className="h-4 w-4 text-[#86868b] ml-2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, name, or Customer ID..."
          className="w-full bg-transparent text-xs text-[#1d1d1f] outline-none placeholder-[#a1a1a6]"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-xs text-[#86868b] hover:text-[#1d1d1f] mr-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="apple-glass-card rounded-2xl overflow-hidden border border-black/[0.06]">
        {filteredRecipients.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="h-10 w-10 text-[#86868b] mx-auto mb-3 opacity-40" />
            <h3 className="text-sm font-semibold text-[#1d1d1f]">
              No recipients found
            </h3>
            <p className="text-xs text-[#86868b] mt-1 mb-4">
              Add individual recipients or import your Priyo Pay customer list
              via CSV.
            </p>
            <button
              disabled={!canManage}
              onClick={() => setShowAddModal(true)}
              className="apple-btn-primary text-xs"
            >
              Add First Recipient
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] bg-black/[0.015] text-[#86868b]">
                  <th className="px-6 py-3.5 font-medium">Recipient</th>
                  <th className="px-4 py-3.5 font-medium">Customer ID</th>
                  <th className="px-4 py-3.5 font-medium text-right">
                    Campaigns
                  </th>
                  <th className="px-6 py-3.5 font-medium text-right">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredRecipients.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-black/[0.015] transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-black/[0.05] text-[#1d1d1f] flex items-center justify-center font-medium text-xs">
                          {rec.firstName
                            ? rec.firstName.charAt(0)
                            : rec.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#1d1d1f]">
                            {rec.firstName || rec.lastName
                              ? `${rec.firstName || ""} ${rec.lastName || ""}`.trim()
                              : rec.email}
                          </p>
                          <p className="text-[11px] text-[#86868b] font-mono">
                            {rec.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-[#515154]">
                      {rec.customerId ? (
                        <span className="font-mono bg-black/[0.04] px-1.5 py-0.5 rounded text-[11px]">
                          {rec.customerId}
                        </span>
                      ) : (
                        <span className="text-[#a1a1a6]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-right font-medium text-[#1d1d1f]">
                      {rec._count?.campaigns || 0}
                    </td>

                    <td className="px-6 py-3.5 text-right text-[#86868b]">
                      {new Date(rec.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Recipient Modal */}
      {showAddModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="apple-glass-card bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-black/[0.1] animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[#1d1d1f]">
                Add Single Recipient
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                title="Close (Esc)"
                className="h-8 w-8 rounded-full bg-black/[0.06] hover:bg-black/[0.14] text-[#1d1d1f] flex items-center justify-center transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddRecipient} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Email Address <span className="text-[#ff3b30]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="customer@domain.com"
                  className="apple-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sagor"
                    className="apple-input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ahmed"
                    className="apple-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1d1d1f] mb-1">
                  Customer ID / Priyo User ID (Optional)
                </label>
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="PRY-94821"
                  className="apple-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="apple-btn-secondary text-xs px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="apple-btn-primary text-xs px-5 py-2 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Save Recipient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImportModal(false);
              setCsvPreview([]);
            }
          }}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="apple-glass-card bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-black/[0.1] animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1d1d1f]">
                  Import Audience CSV
                </h3>
                <p className="text-xs text-[#86868b]">
                  Accepts columns:{" "}
                  <code>email, firstName, lastName, customerId</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setCsvPreview([]);
                }}
                title="Close (Esc)"
                className="h-8 w-8 rounded-full bg-black/[0.06] hover:bg-black/[0.14] text-[#1d1d1f] flex items-center justify-center transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 border-2 border-dashed border-black/[0.1] rounded-2xl text-center bg-[#fafafc]">
              <FileSpreadsheet className="h-8 w-8 text-[#0071e3] mx-auto mb-2 opacity-80" />
              <p className="text-xs font-semibold text-[#1d1d1f]">
                Select CSV file to upload
              </p>
              <p className="text-[11px] text-[#86868b] mt-0.5 mb-3">
                UTF-8 encoded .csv files up to 10,000 rows
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="text-xs text-[#515154]"
              />
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#1d1d1f]">
                    Preview ({csvPreview.length} records parsed)
                  </span>
                  <span className="text-[#34c759] font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Valid CSV
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto border border-black/[0.06] rounded-xl p-2 text-xs divide-y divide-black/[0.04]">
                  {csvPreview.slice(0, 5).map((row, i) => (
                    <div key={i} className="py-1 flex justify-between">
                      <span className="font-mono">{row.email}</span>
                      <span className="text-[#86868b]">
                        {row.firstName} {row.lastName}
                      </span>
                    </div>
                  ))}
                  {csvPreview.length > 5 && (
                    <div className="py-1 text-center text-[#86868b] text-[10px]">
                      + {csvPreview.length - 5} more records
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setCsvPreview([]);
                }}
                className="apple-btn-secondary text-xs px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportCsv}
                disabled={csvLoading || csvPreview.length === 0}
                className="apple-btn-primary text-xs px-5 py-2 disabled:opacity-50"
              >
                {csvLoading
                  ? "Importing..."
                  : `Import ${csvPreview.length} Recipients`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
