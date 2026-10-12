import { requirePageUser } from "@/lib/access";
import { Sidebar } from "@/components/layout/Sidebar";
import { WorkspaceHeader } from "@/components/layout/WorkspaceHeader";

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
        <WorkspaceHeader />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
