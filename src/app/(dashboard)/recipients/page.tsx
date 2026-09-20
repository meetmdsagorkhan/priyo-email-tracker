import { Users, Upload, Plus } from "lucide-react";

export default function RecipientsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-midnight)]">Recipients</h1>
          <p className="text-gray-500 mt-1">Manage individual recipient lists for tracking attribution.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Recipient
          </button>
        </div>
      </div>

      <div className="card text-center py-16">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-paper)]">
          <Users className="h-6 w-6 text-[var(--color-amber)]" />
        </div>
        <h3 className="mt-4 text-sm font-semibold text-gray-900">No recipients imported</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by creating a new recipient or importing a CSV file for your Selected Recipient campaigns.
        </p>
      </div>
    </div>
  );
}
