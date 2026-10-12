import { requirePageUser } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePageUser();
  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-[#f6f8fb] text-[#172033]">
      <Sidebar />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#e7ebf2] bg-white px-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden shrink-0 text-xs font-medium text-[#667085] sm:inline">
              Signalpost
            </span>
            <span aria-hidden="true" className="hidden text-[#c3cad5] sm:inline">/</span>
            <span className="truncate text-xs font-semibold text-[#344054]">
              Email Intelligence Platform
            </span>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-[#e7ebf2] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#475467] sm:flex">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[#16a36a]"
            />
            Workspace
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
