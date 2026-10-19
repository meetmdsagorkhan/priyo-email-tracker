"use client";

import { useState } from "react";
import { Folder, Plus } from "lucide-react";
import { errorMessage } from "@/lib/errors";

export type RecipientGroup = {
  id: string; name: string; recipientIds: string[]; memberCount: number; audienceCount: number;
};

export function RecipientGroups({ groups, reload, selectedIds, activeGroupId, onFilter, canManage, busy, setBusy }: {
  groups: RecipientGroup[]; reload: () => Promise<void>; selectedIds: string[];
  activeGroupId: string; onFilter: (id: string) => void; canManage: boolean;
  busy: boolean; setBusy: (value: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [targetId, setTargetId] = useState("");
  const [feedback, setFeedback] = useState("");

  async function update(method: string, body: object, message: string) {
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/recipient-groups", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update group.");
      await reload(); setFeedback(message); setName(""); setRenameName("");
      if (method === "DELETE") { setTargetId(""); if (activeGroupId === targetId) onFilter(""); }
    } catch (error) { setFeedback(errorMessage(error, "Unable to update group. Refresh and try again.")); }
    finally { setBusy(false); }
  }
  const target = groups.find(g => g.id === targetId);
  return <section aria-label="Recipient groups" className="apple-glass-card rounded-2xl border border-black/[0.06] p-4 space-y-4">
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold"><Folder className="h-4 w-4 text-violet-600" /> Groups</h2>
      <p className="mt-1 text-xs text-[#515154]">Organize contacts into audiences such as Priyo Agency. A contact can belong to several groups.</p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Filter by group">
      <button type="button" disabled={busy} aria-pressed={!activeGroupId} onClick={() => onFilter("")} className={`rounded-full border px-3 py-2 text-xs ${!activeGroupId ? "border-violet-600 bg-violet-50 text-violet-800" : "border-black/10"}`}>All recipients</button>
      {groups.map(group => <button type="button" disabled={busy} key={group.id} aria-pressed={activeGroupId === group.id} onClick={() => onFilter(group.id)} className={`max-w-full break-words rounded-full border px-3 py-2 text-xs ${activeGroupId === group.id ? "border-violet-600 bg-violet-50 text-violet-800" : "border-black/10"}`}>
        {group.name} <span className="ml-1 text-[#515154]">{group.memberCount}</span>
      </button>)}
    </div>
    {canManage && <>
      <form onSubmit={event => { event.preventDefault(); void update("POST", { name, recipientIds: selectedIds }, `Created “${name.trim()}” with ${selectedIds.length} selected contacts.`); }} className="flex flex-col gap-2 sm:flex-row">
        <input aria-label="Group name" maxLength={100} required value={name} onChange={e => setName(e.target.value)} placeholder="New group, e.g. Priyo Agency" className="apple-input min-w-0 flex-1 text-xs" disabled={busy} />
        <button type="submit" disabled={busy || !name.trim()} className="apple-btn-secondary flex items-center justify-center gap-1 px-3 py-2 text-xs disabled:opacity-50"><Plus className="h-4 w-4" />Create group{selectedIds.length ? ` with ${selectedIds.length} selected` : ""}</button>
      </form>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-3">
        <span className="text-xs font-medium" aria-live="polite">{selectedIds.length} selected</span>
        <select aria-label="Bulk action group" value={targetId} onChange={e => { setTargetId(e.target.value); setRenameName(""); }} disabled={busy} className="apple-input min-w-0 max-w-full text-xs sm:w-48">
          <option value="">Choose a group…</option>
          {groups.map(g => <option value={g.id} key={g.id}>{g.name}</option>)}
        </select>
        <button type="button" disabled={busy || !target || !selectedIds.length} onClick={() => void update("PATCH", { id: targetId, action: "add", recipientIds: selectedIds }, `Added selected contacts to “${target?.name}”.`)} className="apple-btn-primary px-3 py-2 text-xs disabled:opacity-50">Add selected</button>
        <button type="button" disabled={busy || !target || !selectedIds.length} onClick={() => void update("PATCH", { id: targetId, action: "remove", recipientIds: selectedIds }, `Removed selected contacts from “${target?.name}”. Contacts were kept in your directory.`)} className="apple-btn-secondary px-3 py-2 text-xs disabled:opacity-50">Remove selected</button>
      </div>
      {target && <details className="rounded-xl border border-black/10 p-3 text-xs">
        <summary className="cursor-pointer font-medium">Manage “{target.name}”</summary>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={event => { event.preventDefault(); void update("PATCH", { id: targetId, action: "rename", name: renameName }, "Group renamed."); }}>
          <input aria-label="Rename group" maxLength={100} required value={renameName} onChange={e => setRenameName(e.target.value)} placeholder="New name for this group" disabled={busy} className="apple-input min-w-0 flex-1 text-xs" />
          <button type="submit" disabled={busy || !renameName.trim()} className="apple-btn-secondary px-3 py-2 text-xs disabled:opacity-50">Rename group</button>
          <button type="button" disabled={busy} onClick={() => { if (confirm(`Delete “${target.name}”? Contacts and their campaign history will be kept.`)) void update("DELETE", { id: targetId }, "Group deleted. Contacts were kept."); }} className="px-3 py-2 text-xs text-red-700 disabled:opacity-50">Delete group</button>
        </form>
      </details>}
    </>}
    {feedback && <p role="status" className="text-xs text-[#515154]">{feedback}</p>}
    <p className="text-xs text-[#515154]">Choose a group in Campaign studio → Send email → Campaign send. Only opted-in, non-suppressed contacts are eligible.</p>
  </section>;
}
