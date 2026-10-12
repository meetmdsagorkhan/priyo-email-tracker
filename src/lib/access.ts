import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { canManageCampaigns } from "./permissions";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user.id || !session.user.workspaceId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      memberships: {
        where: {
          workspaceId: session.user.workspaceId,
          isActive: true,
        },
        select: { workspaceId: true, role: true },
        take: 1,
      },
    },
  });
  const membership = user?.memberships[0];
  if (!user?.isActive || !membership) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    role: membership.role,
    workspaceId: membership.workspaceId,
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
