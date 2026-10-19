"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/errors";

type BillingWorkspace = {
  name: string;
  plan: "FREE" | "STARTER" | "GROWTH" | "BUSINESS";
  billingStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
};

export function BillingClient({
  workspace,
  canManage,
  recipients,
  monthlyEmails,
  effectivePlan,
  limits,
  checkoutState,
  availablePlans,
}: {
  workspace: BillingWorkspace;
  canManage: boolean;
  recipients: number;
  monthlyEmails: number;
  effectivePlan: BillingWorkspace["plan"];
  limits: { recipients: number; monthlyEmails: number };
  checkoutState?: string;
  availablePlans: string[];
}) {
  const [message, setMessage] = useState(
    checkoutState === "success"
      ? "Checkout completed. Your plan updates after Stripe confirms payment."
      : checkoutState === "cancelled"
        ? "Checkout was cancelled."
        : "",
  );
  const [loading, setLoading] = useState(false);
  const hasSubscription = Boolean(
    workspace.stripeSubscriptionId && workspace.billingStatus !== "CANCELED",
  );

  const openStripeUrl = async (endpoint: string, body?: object) => {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Billing request failed.");
      if (typeof data.url !== "string")
        throw new Error("Billing service did not return a redirect URL.");
      window.location.assign(data.url);
    } catch (error) {
      setMessage(errorMessage(error, "Billing request failed."));
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Plan & billing
        </h1>
        <p className="mt-1 text-sm text-[#86868b]">{workspace.name}</p>
      </header>
      {message && (
        <p role="status" className="rounded-xl border p-3 text-sm">
          {message}
        </p>
      )}
      <section className="apple-glass-card grid gap-5 rounded-2xl border border-black/[0.06] p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs text-[#86868b]">Subscription plan</p>
          <p className="mt-1 text-xl font-semibold">{workspace.plan}</p>
          <p className="text-xs text-[#86868b]">{workspace.billingStatus}</p>
        </div>
        <div>
          <p className="text-xs text-[#86868b]">Contacts</p>
          <p className="mt-1 text-xl font-semibold">
            {recipients.toLocaleString()} / {limits.recipients.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#86868b]">
            Email reservations this month
          </p>
          <p className="mt-1 text-xl font-semibold">
            {monthlyEmails.toLocaleString()} /{" "}
            {limits.monthlyEmails.toLocaleString()}
          </p>
        </div>
      </section>
      <p className="text-xs leading-relaxed text-[#667085]">
        Reservations include queued, sent, and failed campaign emails queued in
        the current UTC month. Canceled deliveries release their reservation.
        Test emails are excluded.
      </p>
      {effectivePlan !== workspace.plan && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          Free limits apply while your subscription is{" "}
          {workspace.billingStatus.toLowerCase().replaceAll("_", " ")}. Update
          your subscription in Stripe to restore paid limits.
        </p>
      )}
      {workspace.trialEndsAt && (
        <p className="text-sm text-[#515154]">
          Trial ends {new Date(workspace.trialEndsAt).toLocaleDateString()}.
        </p>
      )}
      {canManage ? (
        <section className="space-y-4">
          {workspace.stripeCustomerId && (
            <button
              type="button"
              disabled={loading}
              onClick={() => openStripeUrl("/api/billing/portal")}
              className="apple-btn-secondary text-xs disabled:opacity-50"
            >
              Manage billing in Stripe
            </button>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {(["STARTER", "GROWTH", "BUSINESS"] as const).map((plan) => (
              <article
                key={plan}
                className="apple-glass-card rounded-2xl border border-black/[0.06] p-5"
              >
                <h2 className="font-semibold">{plan}</h2>
                <p className="mt-1 text-xs text-[#86868b]">
                  {plan === "STARTER"
                    ? "5,000 contacts · 10,000 monthly emails"
                    : plan === "GROWTH"
                      ? "25,000 contacts · 100,000 monthly emails"
                      : "100,000 contacts · 500,000 monthly emails"}
                </p>
                <button
                  type="button"
                  disabled={
                    loading ||
                    hasSubscription ||
                    (workspace.plan === plan && effectivePlan === plan) ||
                    !availablePlans.includes(plan)
                  }
                  onClick={() =>
                    openStripeUrl("/api/billing/checkout", { plan })
                  }
                  className="apple-btn-primary mt-4 text-xs disabled:opacity-50"
                >
                  {!availablePlans.includes(plan)
                    ? "Not configured"
                    : workspace.plan === plan && effectivePlan === plan
                      ? "Current plan"
                      : hasSubscription
                        ? "Manage in Stripe"
                        : `Choose ${plan}`}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-[#86868b]">
          Ask a workspace admin to manage the subscription.
        </p>
      )}
    </main>
  );
}
