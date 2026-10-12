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
        className="fixed bottom-5 right-5 z-50 rounded-full bg-[#0071e3] p-3 text-white shadow-lg md:hidden"
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
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-40 w-64 flex-shrink-0 flex-col justify-between overflow-y-auto border-r border-black/5 bg-[#fbfbfd] md:static md:flex`}
      >
        <div className="p-4 pt-6">
          <Link
            href="/"
            onClick={closeNavigation}
            className="mb-8 flex items-center gap-3 px-2"
          >
            <Image
              src="/email-tracker-favicon.png"
              alt="Priyo Tracker"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <div>
              <p className="font-semibold">Priyo Tracker</p>
              <p className="text-xs text-[#6e6e73]">Email Intelligence Hub</p>
            </div>
          </Link>
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
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${active ? "bg-[#0071e3] text-white" : "text-[#515154] hover:bg-black/5"}`}
                >
                  <item.icon aria-hidden className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-black/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {session?.user.name || "Team member"}
              </p>
              <p className="truncate text-xs text-[#6e6e73]">
                {session?.user.email}
              </p>
              <p className="mt-1 text-xs text-[#0071e3]">
                {session?.user.role && roleLabels[session.user.role]}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              className="rounded-lg p-3 text-[#515154] hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
