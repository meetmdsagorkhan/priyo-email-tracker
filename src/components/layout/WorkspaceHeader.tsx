"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Command,
  LayoutGrid,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { canManageCampaigns } from "@/lib/permissions";
import { useModalAccessibility } from "@/components/useModalAccessibility";
import { ModalPortal } from "./ModalPortal";
import { workspaceNavigation } from "./navigation";

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(searchOpen, dialogRef, () => setSearchOpen(false));
  const page =
    pathname === "/campaigns/new"
      ? "New campaign"
      : /^\/campaigns\/[^/]+$/.test(pathname)
        ? "Campaign details"
        : workspaceNavigation.find((item) => item.href === pathname)?.name ||
          "Workspace";
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        if (
          document.querySelector('[role="dialog"][aria-modal="true"]') &&
          !dialogRef.current
        )
          return;
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const results = workspaceNavigation.filter((item) =>
    `${item.name} ${item.description}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const tabs = [
    { href: "/", name: "Dashboard", icon: LayoutGrid },
    { href: "/campaigns", name: "Campaigns", icon: ArrowUpRight },
  ];
  return (
    <>
      <header className="signal-topbar">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/" className="topbar-wordmark">
            Signalpost
            <span />
          </Link>
          <nav
            aria-label="Quick navigation"
            className="hidden items-center gap-1 lg:flex"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className="topbar-tab"
                aria-current={
                  (
                    tab.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(tab.href)
                  )
                    ? "page"
                    : undefined
                }
              >
                <tab.icon size={14} aria-hidden />
                {tab.name}
              </Link>
            ))}
          </nav>
          <span className="topbar-breadcrumb hidden min-w-0 items-center gap-2 sm:flex lg:hidden">
            <ChevronRight size={13} aria-hidden />
            <span className="truncate">{page}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              setQuery("");
              setSearchOpen(true);
            }}
            className="workspace-search"
            aria-label="Search workspace pages"
          >
            <Search size={15} aria-hidden />
            <span className="hidden xl:inline">Jump to a page…</span>
            <kbd className="hidden xl:flex">
              <Command size={10} />K
            </kbd>
          </button>
          <span className="topbar-divider" />
          {canManageCampaigns(session?.user.role) && (
            <Link href="/campaigns/new" className="topbar-create">
              <Plus size={15} aria-hidden />
              <span className="hidden sm:inline">New campaign</span>
              <span className="sr-only sm:hidden">New campaign</span>
            </Link>
          )}
          <Link
            href="/settings"
            className="topbar-avatar"
            aria-label="Account settings"
            title={session?.user.name || "Account settings"}
          >
            {(session?.user.name || "S").charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>
      {searchOpen && (
        <ModalPortal>
          <div
            className="workspace-search-backdrop"
            onClick={(event) => {
              if (event.target === event.currentTarget) setSearchOpen(false);
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workspace-search-title"
              className="workspace-command-dialog"
            >
              <div className="flex items-center gap-3 border-b border-[#eeecf5] p-4">
                <Search size={20} className="text-[#766c98]" aria-hidden />
                <label
                  id="workspace-search-title"
                  htmlFor="workspace-page-search"
                  className="sr-only"
                >
                  Search workspace pages
                </label>
                <input
                  id="workspace-page-search"
                  placeholder="Where would you like to go?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  aria-label="Close page search"
                  className="rounded-lg p-2 text-[#766c98]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[60dvh] overflow-y-auto p-2">
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[.14em] text-[#8b829f]">
                  Your workspace
                </p>
                {results.length ? (
                  results.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSearchOpen(false)}
                      className="command-result"
                    >
                      <span className="command-result-icon">
                        <item.icon size={18} />
                      </span>
                      <span className="flex-1">
                        <strong className="block text-sm font-medium">
                          {item.name}
                        </strong>
                        <small className="text-xs text-[#81788f]">
                          {item.description}
                        </small>
                      </span>
                      <ChevronRight size={15} className="text-[#b1a9c2]" />
                    </Link>
                  ))
                ) : (
                  <p
                    role="status"
                    className="px-3 py-8 text-center text-sm text-[#81788f]"
                  >
                    No pages found. Try “campaigns” or “settings”.
                  </p>
                )}
              </div>
              <div className="border-t border-[#eeecf5] px-5 py-3 text-[11px] text-[#81788f]">
                Navigate with Tab · Open with Enter · Close with Esc
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
