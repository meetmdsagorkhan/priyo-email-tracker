import type { Plan } from "@prisma/client";

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
