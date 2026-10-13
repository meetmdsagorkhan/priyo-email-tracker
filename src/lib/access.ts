import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { canManageCampaigns } from "./permissions";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user.id ||
    !session.user.email ||
    !session.user.workspaceId ||
    !session.user.role
  )
    return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isActive: true,
    role: session.user.role,
    workspaceId: session.user.workspaceId,
  };
}
export async function requirePageUser(manage = false) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (manage && !canManageCampaigns(user.role))
    redirect("/campaigns?access=read-only");
  return user;
}
export async function requireApiUser(
  permission: "read" | "manage" | "admin" = "read",
) {
  const user = await currentUser();
  if (!user)
    return {
      response: NextResponse.json(
        { error: "Please sign in." },
        { status: 401 },
      ),
      user: null,
    };
  if (
    (permission === "admin" && user.role !== "ADMIN") ||
    (permission === "manage" && !canManageCampaigns(user.role))
  ) {
    return {
      response: NextResponse.json(
        { error: "You do not have permission to perform this action." },
        { status: 403 },
      ),
      user: null,
    };
  }
  return { response: null, user };
}
