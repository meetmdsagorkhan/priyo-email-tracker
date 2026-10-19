import crypto from "node:crypto";
import { Prisma, type BillingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { planForPriceId, stripeGet } from "@/lib/stripe";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripeId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.id === "string") return value.id;
  return null;
}

function verifySignature(payload: string, signature: string, secret: string) {
  const parts = signature.split(",").map((part) => part.split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value));
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !signatures.length
  )
    return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest();
  return signatures.some((signatureValue) => {
    if (!/^[a-f0-9]{64}$/i.test(signatureValue)) return false;
    const actual = Buffer.from(signatureValue, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  });
}

function subscriptionStatus(status: unknown): BillingStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    case "incomplete":
    default:
      return "INCOMPLETE";
  }
}

// Stripe may retry events or deliver them out of order. Reconcile entitlement
// from the current subscription, never checkout metadata or an old invoice.
// Fetch before opening a database transaction so network latency holds no locks.
async function currentSubscription(
  event: JsonRecord,
): Promise<JsonRecord | null> {
  const type = event.type;
  const data = isRecord(event.data) ? event.data : null;
  const object = data && isRecord(data.object) ? data.object : null;
  if (!object) return null;
  let subscriptionId: string | null = null;
  if (type === "customer.subscription.deleted")
    return { ...object, status: "canceled" };
  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  )
    subscriptionId = stripeId(object.id);
  if (type === "checkout.session.completed") {
    if (object.mode !== "subscription") return null;
    subscriptionId = stripeId(object.subscription);
  }
  if (
    type === "invoice.payment_failed" ||
    type === "invoice.payment_succeeded"
  ) {
    const parent = isRecord(object.parent) ? object.parent : null;
    const details =
      parent && isRecord(parent.subscription_details)
        ? parent.subscription_details
        : null;
    subscriptionId =
      stripeId(object.subscription) || stripeId(details?.subscription);
    // A standalone invoice is unrelated to this workspace's subscription.
    if (!subscriptionId) return null;
  }
  if (
    !subscriptionId &&
    ![
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
    ].includes(String(type))
  )
    return null;
  if (!subscriptionId)
    throw new Error("Stripe event is missing a subscription ID.");
  const subscription = await stripeGet(
    `subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
  if (stripeId(subscription.id) !== subscriptionId)
    throw new Error("Stripe returned a different subscription.");
  return subscription;
}

async function applyEvent(
  tx: Prisma.TransactionClient,
  event: JsonRecord,
  subscription: JsonRecord | null,
) {
  if (!subscription) return;
  const subscriptionId = stripeId(subscription.id);
  const customerId = stripeId(subscription.customer);
  const billingStatus = subscriptionStatus(subscription.status);
  const items = isRecord(subscription.items) ? subscription.items.data : null;
  const firstItem =
    Array.isArray(items) && isRecord(items[0]) ? items[0] : null;
  const price = firstItem && isRecord(firstItem.price) ? firstItem.price : null;
  const plan =
    billingStatus === "CANCELED"
      ? "FREE"
      : price && typeof price.id === "string"
        ? planForPriceId(price.id)
        : null;
  if (!subscriptionId || !customerId || !plan)
    throw new Error(
      "Stripe subscription has an unknown customer, plan, or subscription.",
    );

  const data = isRecord(event.data) ? event.data : null;
  const object = data && isRecord(data.object) ? data.object : null;
  const metadata = isRecord(subscription.metadata) ? subscription.metadata : {};
  const checkoutMetadata =
    object && isRecord(object.metadata) ? object.metadata : {};
  const workspaceId =
    typeof metadata.workspaceId === "string"
      ? metadata.workspaceId
      : event.type === "checkout.session.completed" &&
          typeof checkoutMetadata.workspaceId === "string"
        ? checkoutMetadata.workspaceId
        : null;
  const workspace = await tx.workspace.findUnique({
    where: workspaceId ? { id: workspaceId } : { stripeCustomerId: customerId },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      billingStatus: true,
      updatedAt: true,
    },
  });
  if (!workspace) throw new Error("Subscription workspace not found.");
  if (workspace.stripeCustomerId && workspace.stripeCustomerId !== customerId)
    throw new Error("Stripe customer does not match this workspace.");

  if (
    workspace.stripeSubscriptionId &&
    workspace.stripeSubscriptionId !== subscriptionId
  ) {
    // Only a completed new checkout may replace a canceled subscription.
    // An old subscription or invoice must never take over the current one.
    if (
      event.type !== "checkout.session.completed" ||
      workspace.billingStatus !== "CANCELED" ||
      billingStatus === "CANCELED"
    )
      return;
  } else if (
    workspace.stripeSubscriptionId === subscriptionId &&
    workspace.billingStatus === "CANCELED" &&
    billingStatus !== "CANCELED"
  )
    return;

  const updated = await tx.workspace.updateMany({
    where: {
      id: workspace.id,
      stripeCustomerId: workspace.stripeCustomerId,
      stripeSubscriptionId: workspace.stripeSubscriptionId,
      billingStatus: workspace.billingStatus,
      updatedAt: workspace.updatedAt,
    },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      billingStatus,
    },
  });
  if (!updated.count)
    throw new Error("Billing changed concurrently; retry reconciliation.");
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 503 },
    );
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000)
    return NextResponse.json(
      { error: "Webhook body is too large." },
      { status: 413 },
    );
  const payload = await request.text();
  if (Buffer.byteLength(payload) > 1_000_000)
    return NextResponse.json(
      { error: "Webhook body is too large." },
      { status: 413 },
    );
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifySignature(payload, signature, secret))
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe event payload." },
      { status: 400 },
    );
  }
  if (
    !isRecord(event) ||
    typeof event.id !== "string" ||
    typeof event.type !== "string"
  )
    return NextResponse.json(
      { error: "Invalid Stripe event shape." },
      { status: 400 },
    );

  try {
    if (
      await prisma.stripeWebhookEvent.findUnique({
        where: { id: event.id },
        select: { id: true },
      })
    )
      return NextResponse.json({ received: true, duplicate: true });
    const subscription = await currentSubscription(event);
    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({
        data: { id: event.id as string, type: event.type as string },
      });
      await applyEvent(tx, event as JsonRecord, subscription);
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      (await prisma.stripeWebhookEvent
        .findUnique({
          where: { id: event.id },
          select: { id: true },
        })
        .catch(() => null))
    )
      return NextResponse.json({ received: true, duplicate: true });
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json(
      { error: "Stripe event processing failed." },
      { status: 500 },
    );
  }
}
