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
    <div className="dashboard-shell relative flex h-dvh w-full overflow-hidden text-[#29243b]">
      <a href="#workspace-content" className="workspace-skip-link">
        Skip to content
      </a>
      <Sidebar />

      <div className="workspace-canvas relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <WorkspaceHeader />

        <main
          id="workspace-content"
          className="workspace-content flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-8 lg:p-10"
        >
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
