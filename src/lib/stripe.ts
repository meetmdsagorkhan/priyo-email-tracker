import type { Plan } from "@prisma/client";

export type PaidPlan = Exclude<Plan, "FREE">;

export const paidPlans: PaidPlan[] = ["STARTER", "GROWTH", "BUSINESS"];

export function isPaidPlan(value: unknown): value is PaidPlan {
  return paidPlans.some((plan) => plan === value);
}

export function stripePriceIds(): Partial<Record<PaidPlan, string>> {
  return {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    GROWTH: process.env.STRIPE_PRICE_GROWTH,
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
  };
}

export function planForPriceId(priceId: string): PaidPlan | null {
  return (
    paidPlans.find((plan) => stripePriceIds()[plan] === priceId) || null
  );
}

export async function stripePost(
  path: string,
  fields: Record<string, string>,
) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe billing is not configured.");
  const body = new URLSearchParams(fields);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Stripe request failed.",
    );
  return data as Record<string, unknown>;
}
