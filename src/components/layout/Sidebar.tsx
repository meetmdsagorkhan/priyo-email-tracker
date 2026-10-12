"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Users,
  Target,
  CreditCard,
  FileCode2,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { roleLabels } from "@/lib/permissions";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Templates", href: "/templates", icon: FileCode2 },
  { name: "Recipients", href: "/recipients", icon: Users },
  { name: "Segments", href: "/segments", icon: Target },
  { name: "Plan & billing", href: "/billing", icon: CreditCard },
  { name: "Settings & team", href: "/settings", icon: Settings },
];
export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const sidebar = sidebarRef.current;
    sidebar?.querySelector<HTMLElement>("a[href]")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);
  const closeNavigation = () => { setOpen(false); toggleRef.current?.focus(); };
  return (
    <>
      <button
        ref={toggleRef}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1769e0] text-white shadow-lg md:hidden"
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={closeNavigation}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Workspace navigation" : undefined}
        className={`workspace-sidebar ${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 flex-shrink-0 flex-col justify-between overflow-y-auto border-r md:static md:flex`}
      >
        <div className="p-4 pt-5">
          <Link
            href="/"
            onClick={closeNavigation}
            className="mb-8 flex items-center gap-3 rounded-xl px-2 py-1"
          >
            <Image
              src="/email-tracker-favicon.png"
              alt="Priyo Tracker"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <div>
              <p className="text-sm font-semibold tracking-tight text-[#172033]">
                Priyo Tracker
              </p>
              <p className="text-xs text-[#667085]">
                Email intelligence
              </p>
            </div>
          </Link>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#98a2b3]">
            Workspace
          </p>
          <nav aria-label="Workspace" className="space-y-1">
            {navigation.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeNavigation}
                  aria-current={active ? "page" : undefined}
                  className="workspace-nav-link flex items-center gap-3 px-3 text-sm font-medium"
                >
                  <item.icon aria-hidden className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-[#e7ebf2] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#f8fafc] p-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e8effc] text-sm font-semibold text-[#2457a7]"
            >
              {(session?.user.name || session?.user.email || "T")
                .charAt(0)
                .toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[#344054]">
                {session?.user.name || "Team member"}
              </p>
              <p className="truncate text-[11px] text-[#667085]">
                {session?.user.email}
              </p>
              <p className="mt-1 truncate text-[10px] font-medium text-[#1458bd]">
                {session?.user.role && roleLabels[session.user.role]}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#667085] transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
