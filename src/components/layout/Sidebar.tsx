"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Radio, LogOut, Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { roleLabels } from "@/lib/permissions";
import { useModalAccessibility } from "@/components/useModalAccessibility";
import { workspaceNavigation } from "./navigation";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  useModalAccessibility(open, sidebarRef, () => setOpen(false));
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const closeNavigation = () => setOpen(false);
  const initials = (session?.user.name || session?.user.email || "S")
    .charAt(0)
    .toUpperCase();
  return (
    <>
      <button
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="workspace-navigation"
        onClick={() => setOpen(!open)}
        className="rail-mobile-toggle fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg md:hidden"
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <button
          aria-label="Dismiss navigation"
          onClick={closeNavigation}
          className="fixed inset-0 z-30 bg-[#17132d]/35 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        ref={sidebarRef}
        id="workspace-navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Workspace navigation"
        className={`signal-rail ${open ? "is-open flex" : "hidden"} fixed inset-y-0 left-0 z-40 flex-col md:relative md:inset-auto md:flex`}
      >
        <svg
          aria-hidden="true"
          className="rail-silhouette"
          viewBox="0 0 96 900"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="signal-rail-gradient"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop stopColor="#6c4cf6" />
              <stop offset="1" stopColor="#4935d8" />
            </linearGradient>
          </defs>
          <path
            fill="url(#signal-rail-gradient)"
            d="M24 0H62C62 75 96 115 96 235V670C96 790 54 824 54 900H24Q0 900 0 876V24Q0 0 24 0Z"
          />
        </svg>
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <Link
            href="/"
            onClick={closeNavigation}
            aria-label="Signalpost home"
            className="rail-brand"
          >
            <span className="rail-brand-mark">
              <Radio size={23} strokeWidth={1.8} />
            </span>
            <span className="rail-mobile-label">
              <strong>Signalpost</strong>
              <small>Email intelligence</small>
            </span>
          </Link>
          <nav aria-label="Workspace" className="rail-navigation">
            {workspaceNavigation.map((item, index) => {
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
                  aria-label={item.name}
                  aria-current={active ? "page" : undefined}
                  title={item.name}
                  className={`rail-link ${index === 6 ? "rail-section-start" : ""}`}
                >
                  <item.icon aria-hidden size={19} strokeWidth={1.7} />
                  <span className="rail-mobile-label">{item.name}</span>
                  <span className="rail-tooltip" aria-hidden>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="rail-footer">
            <Link
              href="/settings"
              onClick={closeNavigation}
              aria-label="Your profile and workspace settings"
              title={`${session?.user.name || "Your account"}${session?.user.role ? ` · ${roleLabels[session.user.role]}` : ""}`}
              className="rail-profile"
            >
              <span className="rail-avatar">
                {initials}
                <i />
              </span>
              <span className="rail-mobile-label min-w-0">
                <strong className="block truncate">
                  {session?.user.name || "Team member"}
                </strong>
                <small className="block truncate">
                  {session?.user.role && roleLabels[session.user.role]}
                </small>
              </span>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Sign out"
              title="Sign out"
              className="rail-link"
            >
              <LogOut aria-hidden size={18} />
              <span className="rail-mobile-label">Sign out</span>
              <span className="rail-tooltip" aria-hidden>
                Sign out
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
