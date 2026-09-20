"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Users,
  Settings,
  LogOut,
  FileText
} from "lucide-react";
import { signOut } from "next-auth/react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Recipients", href: "/recipients", icon: Users },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col justify-between border-r border-gray-200 bg-white" style={{ width: '280px', flexShrink: 0 }}>
      <div className="px-4 py-6">
        <div className="mb-8 flex items-center px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-midnight)] text-white font-heading font-bold mr-3">
            P
          </div>
          <span className="font-heading text-lg font-bold text-[var(--color-midnight)]">
            Priyo Tracker
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--color-midnight)] text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-gray-200 p-4">
        <nav className="flex flex-col gap-1">
          {secondaryNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-[var(--color-midnight)] text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <item.icon className="h-5 w-5 text-gray-400" />
              {item.name}
            </Link>
          ))}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 w-full text-left"
          >
            <LogOut className="h-5 w-5 text-gray-400" />
            Logout
          </button>
        </nav>
      </div>
    </div>
  );
}
