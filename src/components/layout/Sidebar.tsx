"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Users,
  FileCode2,
  Settings,
  LogOut,
  Sparkles,
  Radio,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Templates", href: "/templates", icon: FileCode2 },
  { name: "Recipients", href: "/recipients", icon: Users },
];

const secondaryNavigation = [
  { name: "Settings & API", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col justify-between h-screen border-r border-black/[0.06] bg-[#fbfbfd]/80 backdrop-blur-2xl select-none">
      <div className="flex flex-col px-4 pt-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0b0f19] to-[#1d293d] p-[1px] shadow-sm flex items-center justify-center text-white transition-transform group-hover:scale-105">
              <span className="font-semibold text-sm tracking-tight">P</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]">
                  Priyo Tracker
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3]">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-[#86868b]">Email Intelligence Hub</p>
            </div>
          </Link>
        </div>

        {/* Live Engine Status Pill */}
        <div className="mx-2 mb-6 px-3 py-2 rounded-xl bg-white/70 border border-black/[0.05] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34c759]"></span>
            </span>
            <span className="text-[11px] font-medium text-[#1d1d1f]">Tracking Pixel</span>
          </div>
          <span className="text-[10px] font-medium text-[#34c759] bg-[#34c759]/10 px-1.5 py-0.5 rounded-md">
            Active
          </span>
        </div>

        {/* Main Navigation */}
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[#0071e3] text-white shadow-[0_2px_8px_rgba(0,113,227,0.25)]"
                    : "text-[#515154] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 transition-colors ${
                    isActive ? "text-white" : "text-[#86868b] group-hover:text-[#1d1d1f]"
                  }`}
                />
                <span className="flex-1 tracking-tight">{item.name}</span>
                {item.name === "Campaigns" && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      isActive ? "bg-white/20 text-white" : "bg-black/[0.04] text-[#86868b]"
                    }`}
                  >
                    Live
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-black/[0.06] bg-white/40">
        <nav className="space-y-1 mb-3">
          {secondaryNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-[#0071e3] text-white"
                    : "text-[#515154] hover:bg-black/[0.04] hover:text-[#1d1d1f]"
                }`}
              >
                <item.icon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-[#86868b]"}`}
                />
                <span className="tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white/60 border border-black/[0.04]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#0071e3] to-[#34c759] flex items-center justify-center text-white text-xs font-semibold">
              {session?.user?.name ? session.user.name.charAt(0) : "P"}
            </div>
            <div className="truncate">
              <p className="text-[12px] font-medium text-[#1d1d1f] truncate">
                {session?.user?.name || "Admin"}
              </p>
              <p className="text-[10px] text-[#86868b] truncate">
                {session?.user?.email || "admin@priyo.com"}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            className="p-1.5 rounded-lg text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
