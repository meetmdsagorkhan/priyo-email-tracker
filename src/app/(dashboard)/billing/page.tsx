import { requirePageUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { effectivePlan, monthlyEmailUsageWhere, planLimits } from "@/lib/plans";
import { stripePriceIds } from "@/lib/stripe";
import { BillingClient } from "@/components/billing/BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requirePageUser();
  const [workspace, recipients, monthlyEmails, query] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: user.workspaceId },
      select: {
        name: true,
        plan: true,
        billingStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        trialEndsAt: true,
      },
    }),
    prisma.recipient.count({ where: { workspaceId: user.workspaceId } }),
    prisma.campaignDelivery.count({
      where: monthlyEmailUsageWhere(user.workspaceId),
    }),
    searchParams,
  ]);
  if (!workspace) throw new Error("Workspace not found.");
  return (
    <BillingClient
      workspace={workspace}
      canManage={user.role === "ADMIN"}
      recipients={recipients}
      monthlyEmails={monthlyEmails}
      effectivePlan={effectivePlan(workspace.plan, workspace.billingStatus)}
      limits={
        planLimits[effectivePlan(workspace.plan, workspace.billingStatus)]
      }
      checkoutState={query.checkout}
      availablePlans={Object.entries(stripePriceIds())
        .filter(([, priceId]) => Boolean(priceId))
        .map(([plan]) => plan)}
    />
  );
}
