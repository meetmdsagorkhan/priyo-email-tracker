import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  refreshCampaignStatus,
  retryFailedDeliveries,
} from "@/lib/mailer";
import type { SmtpConfig } from "@/lib/mailer";

export const maxDuration = 60;

function isSmtpConfig(value: unknown): value is SmtpConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  return (
    typeof config.host === "string" &&
    config.host.length > 0 &&
    config.host.length <= 255 &&
    Number.isInteger(config.port) &&
    Number(config.port) >= 1 &&
    Number(config.port) <= 65535 &&
    typeof config.user === "string" &&
    config.user.length > 0 &&
    config.user.length <= 254 &&
    typeof config.pass === "string" &&
    config.pass.length > 0 &&
    config.pass.length <= 1024 &&
    (config.from === undefined ||
      (typeof config.from === "string" && config.from.length <= 254)) &&
    (config.secure === undefined || typeof config.secure === "boolean")
  );
}

async function runDeliveryWorker(
  request: Request,
  customConfig?: SmtpConfig,
) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Delivery worker is not configured." },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== "Bearer " + secret)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const now = new Date();
  const stale = await prisma.campaignDelivery.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
    },
    select: {
      id: true,
      campaignId: true,
      workspaceId: true,
      attempts: true,
    },
    take: 100,
  });
  for (const delivery of stale) {
    const shouldRetry = delivery.attempts < 5;
    const recovered = await prisma.campaignDelivery.updateMany({
      where: {
        id: delivery.id,
        workspaceId: delivery.workspaceId,
        status: "SENDING",
        updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
      },
      data: {
        status: "FAILED",
        lastError:
          "Delivery worker lease expired. SMTP delivery may be uncertain; a retry can result in a duplicate.",
        nextAttemptAt: shouldRetry ? now : null,
      },
    });
    if (recovered.count)
      await refreshCampaignStatus(delivery.campaignId, delivery.workspaceId);
  }

  try {
    const processed = await retryFailedDeliveries(100, customConfig);
    return NextResponse.json({
      processed,
      staleDeliveriesRecovered: stale.length,
    });
  } catch (error) {
    console.error("Scheduled delivery retry failed:", error);
    return NextResponse.json(
      { error: "Unable to process the delivery retry queue." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runDeliveryWorker(request);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const text = await request.text();
  if (text.length > 10_000)
    return NextResponse.json(
      { error: "Worker body is too large." },
      { status: 413 },
    );
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid worker body." }, { status: 400 });
  }
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid worker body." }, { status: 400 });
  const config = (body as Record<string, unknown>).smtpConfig;
  if (!isSmtpConfig(config))
    return NextResponse.json(
      { error: "Valid SMTP settings are required for this worker request." },
      { status: 400 },
    );
  return runDeliveryWorker(request, config);
}
