export const roles = ["ADMIN", "CAMPAIGN_MANAGER", "MEMBER", "VIEWER"] as const;
export type AppRole = (typeof roles)[number];
export const roleLabels: Record<AppRole, string> = {
  ADMIN: "Admin",
  CAMPAIGN_MANAGER: "Campaign manager",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
export function isRole(value: unknown): value is AppRole {
  return typeof value === "string" && roles.some((role) => role === value);
}
export function canManageCampaigns(role?: string) {
  return role === "ADMIN" || role === "CAMPAIGN_MANAGER";
}
export function safeCallbackUrl(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/";
  const url = new URL(value, "http://localhost");
  return url.pathname === "/login" || url.pathname.startsWith("/api/")
    ? "/"
    : url.pathname + url.search;
}
