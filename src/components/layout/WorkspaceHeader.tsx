"use client";

import { usePathname } from "next/navigation";

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/analytics": "Analytics",
  "/billing": "Billing",
  "/campaigns": "Campaigns",
  "/campaigns/new": "New campaign",
  "/recipients": "Recipients",
  "/segments": "Segments",
  "/settings": "Settings",
  "/templates": "Templates",
};

function pageName(pathname: string) {
  if (pageNames[pathname]) return pageNames[pathname];
  if (/^\/campaigns\/[^/]+$/.test(pathname)) return "Campaign details";
  return "Workspace";
}

export function WorkspaceHeader() {
  const pathname = usePathname();

  return (
    <header className="z-10 flex h-14 shrink-0 items-center justify-between border-b border-[#e7ebf2] bg-white px-5 sm:px-8">
      <p className="truncate text-sm font-semibold text-[#344054]">
        {pageName(pathname)}
      </p>
      <div className="hidden items-center gap-2 rounded-lg border border-[#e7ebf2] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#475467] sm:flex">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[#16a36a]"
        />
        Workspace
      </div>
    </header>
  );
}
