import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { applicationOrigin } from "@/lib/site";
import {
  isPaidPlan,
  stripePost,
  stripePriceIds,
} from "@/lib/stripe";

export async function POST(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const plan = body?.plan;
  if (!isPaidPlan(plan))
    return NextResponse.json(
      { error: "Choose a valid paid plan." },
      { status: 400 },
    );
  const priceId = stripePriceIds()[plan];
  if (!priceId)
    return NextResponse.json(
      { error: `Set STRIPE_PRICE_${plan} to enable this plan.` },
      { status: 503 },
    );
  try {
    const workspace = await prisma.workspace.findUnique({
      where: { id: access.user.workspaceId },
      select: {
        plan: true,
        billingStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });
    if (!workspace)
      return NextResponse.json(
        { error: "Workspace not found." },
        { status: 404 },
      );
    if (
      workspace.stripeSubscriptionId &&
      ["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE"].includes(
        workspace.billingStatus,
      )
    )
      return NextResponse.json(
        { error: "Manage your existing subscription in the billing portal." },
        { status: 409 },
      );
    const origin = applicationOrigin(request.url);
    const fields: Record<string, string> = {
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "success_url": `${origin}/billing?checkout=success`,
      "cancel_url": `${origin}/billing?checkout=cancelled`,
      "client_reference_id": access.user.workspaceId,
      "metadata[workspaceId]": access.user.workspaceId,
      "metadata[plan]": plan,
      "subscription_data[metadata][workspaceId]": access.user.workspaceId,
      "subscription_data[metadata][plan]": plan,
    };
    if (workspace.stripeCustomerId)
      fields.customer = workspace.stripeCustomerId;
    else fields.customer_email = access.user.email;
    const session = await stripePost("checkout/sessions", fields);
    if (typeof session.url !== "string")
      throw new Error("Stripe did not return a checkout URL.");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start subscription checkout.",
      },
      { status: 502 },
    );
  }
}
