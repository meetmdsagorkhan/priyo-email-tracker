import {
  LayoutDashboard,
  Megaphone,
  BarChart3,
  Users,
  Target,
  CreditCard,
  FileCode2,
  Settings,
  Mail,
} from "lucide-react";

export const workspaceNavigation = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
    description: "Your workspace at a glance",
  },
  {
    name: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
    description: "Create and manage email campaigns",
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Explore engagement and delivery",
  },
  { name: "Email logs", href: "/email-logs", icon: Mail, description: "Sending status, errors, and message history" },
  {
    name: "Templates",
    href: "/templates",
    icon: FileCode2,
    description: "Your email design library",
  },
  {
    name: "Recipients",
    href: "/recipients",
    icon: Users,
    description: "Browse your audience",
  },
  {
    name: "Segments",
    href: "/segments",
    icon: Target,
    description: "Organize audience segments",
  },
  {
    name: "Plan & billing",
    href: "/billing",
    icon: CreditCard,
    description: "Manage your subscription",
  },
  {
    name: "Settings & team",
    href: "/settings",
    icon: Settings,
    description: "Workspace preferences and access",
  },
];
