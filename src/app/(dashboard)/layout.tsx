import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8f8fa] text-[#1d1d1f] relative">
      {/* Ambient background glow & subtle dot pattern */}
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none opacity-30 z-0"></div>
      <div className="absolute top-0 right-1/4 w-[500px] h-[280px] bg-gradient-to-b from-[#0071e3]/[0.05] to-transparent rounded-full blur-3xl pointer-events-none z-0"></div>

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Top Header Glass Bar */}
        <header className="h-14 border-b border-black/[0.05] bg-white/70 backdrop-blur-2xl flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#86868b]">Priyo Technologies</span>
            <span className="text-[#d1d1d6]">/</span>
            <span className="text-xs font-semibold text-[#1d1d1f]">Email Intelligence Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[#515154] bg-white/80 border border-black/[0.05] px-3 py-1.5 rounded-full shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34c759]"></span>
              </span>
              <span>All Systems Operational</span>
            </div>
          </div>
        </header>

        {/* Main Scrollable View */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
