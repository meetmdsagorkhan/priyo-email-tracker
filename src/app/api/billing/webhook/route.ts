import crypto from "node:crypto";
import { Prisma, type BillingStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPaidPlan, planForPriceId } from "@/lib/stripe";

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
    return actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected);
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

async function applyEvent(tx: Prisma.TransactionClient, event: JsonRecord) {
  const type = event.type;
  const data = isRecord(event.data) ? event.data : null;
  const object = data && isRecord(data.object) ? data.object : null;
  if (typeof type !== "string" || !object) return;

  if (type === "checkout.session.completed") {
    const metadata = isRecord(object.metadata) ? object.metadata : {};
    const workspaceId =
      typeof metadata.workspaceId === "string"
        ? metadata.workspaceId
        : typeof object.client_reference_id === "string"
          ? object.client_reference_id
          : null;
    const plan = isPaidPlan(metadata.plan) ? metadata.plan : null;
    const customerId = stripeId(object.customer);
    const subscriptionId = stripeId(object.subscription);
    if (
      object.mode !== "subscription" ||
      !workspaceId ||
      !plan ||
      !customerId ||
      !subscriptionId
    )
      throw new Error("Stripe checkout event is missing workspace subscription data.");
    const updated = await tx.workspace.updateMany({
      where: { id: workspaceId },
      data: {
        plan,
        billingStatus:
          object.payment_status === "paid" ||
          object.payment_status === "no_payment_required"
            ? "ACTIVE"
            : "INCOMPLETE",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
    });
    if (!updated.count) throw new Error("Checkout workspace not found.");
    return;
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    const subscriptionId = stripeId(object.id);
    const customerId = stripeId(object.customer);
    const metadata = isRecord(object.metadata) ? object.metadata : {};
    const workspaceId =
      typeof metadata.workspaceId === "string" ? metadata.workspaceId : null;
    const items = isRecord(object.items) ? object.items.data : null;
    const firstItem =
      Array.isArray(items) && isRecord(items[0]) ? items[0] : null;
    const price = firstItem && isRecord(firstItem.price) ? firstItem.price : null;
    const plan =
      price && typeof price.id === "string" ? planForPriceId(price.id) : null;
    if (!subscriptionId || !customerId || !plan)
      throw new Error("Stripe subscription event has an unknown customer, plan, or subscription.");
    const updated = await tx.workspace.updateMany({
      where: workspaceId
        ? { id: workspaceId }
        : { stripeCustomerId: customerId },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan,
        billingStatus: subscriptionStatus(object.status),
      },
    });
    if (!updated.count) throw new Error("Subscription workspace not found.");
    return;
  }

  if (type === "customer.subscription.deleted") {
    const subscriptionId = stripeId(object.id);
    if (!subscriptionId) throw new Error("Stripe cancellation is missing a subscription ID.");
    await tx.workspace.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { plan: "FREE", billingStatus: "CANCELED" },
    });
    return;
  }

  if (
    type === "invoice.payment_failed" ||
    type === "invoice.payment_succeeded"
  ) {
    const customerId = stripeId(object.customer);
    if (!customerId) throw new Error("Stripe invoice event is missing a customer ID.");
    await tx.workspace.updateMany({
      where: { stripeCustomerId: customerId },
      data: {
        billingStatus:
          type === "invoice.payment_failed" ? "PAST_DUE" : "ACTIVE",
      },
    });
  }
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
    return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";
  if (!verifySignature(payload, signature, secret))
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe event payload." }, { status: 400 });
  }
  if (
    !isRecord(event) ||
    typeof event.id !== "string" ||
    typeof event.type !== "string"
  )
    return NextResponse.json({ error: "Invalid Stripe event shape." }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({
        data: { id: event.id as string, type: event.type as string },
      });
      await applyEvent(tx, event as JsonRecord);
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json({ received: true, duplicate: true });
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json(
      { error: "Stripe event processing failed." },
      { status: 500 },
    );
  }
}
