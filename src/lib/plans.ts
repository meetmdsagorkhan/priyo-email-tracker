import type { BillingStatus, Plan } from "@prisma/client";

export const planLimits: Record<
  Plan,
  { recipients: number; monthlyEmails: number }
> = {
  FREE: { recipients: 1_000, monthlyEmails: 500 },
  STARTER: { recipients: 5_000, monthlyEmails: 10_000 },
  GROWTH: { recipients: 25_000, monthlyEmails: 100_000 },
  BUSINESS: { recipients: 100_000, monthlyEmails: 500_000 },
};

export function getUtcMonthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Preserve the subscribed plan for billing history, but grant paid limits only
// while Stripe confirms an active subscription or trial. No delinquency grace
// period is advertised, so an incomplete/past-due/canceled plan uses free limits.
export function effectivePlan(plan: Plan, billingStatus: BillingStatus): Plan {
  return billingStatus === "ACTIVE" || billingStatus === "TRIALING"
    ? plan
    : "FREE";
}

// Admission reserves one email per delivery, including queued/failed attempts.
// Cancellation releases that reservation. Both admission and billing use the
// UTC month in which the delivery was queued, rather than its eventual send date.
export function monthlyEmailUsageWhere(workspaceId: string, now = new Date()) {
  return {
    workspaceId,
    status: { not: "CANCELED" as const },
    queuedAt: { gte: getUtcMonthStart(now) },
  };
}
