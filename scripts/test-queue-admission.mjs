// Database regression for atomic admissions. It never runs a worker or sends mail.
// Run only with TEST_DATABASE_URL pointing to local signalpost_ui_test.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";

const database = new URL(process.env.TEST_DATABASE_URL || "");
assert.ok(
  ["127.0.0.1", "localhost"].includes(database.hostname),
  "A local database is required.",
);
assert.equal(
  database.pathname,
  "/signalpost_ui_test",
  "Use the dedicated signalpost_ui_test database.",
);
const clients = [0, 1, 2].map(
  () => new PrismaClient({ datasourceUrl: database.toString() }),
);
const [prisma, first, second] = clients;
const prefix = `queue-regression-${crypto.randomUUID()}`;
const workspaces = [];
const campaigns = [];
let userId;
let assertions = 0;
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  assertions++;
};

function loadSource(relative, dependencies = {}) {
  const filename = new URL(relative, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loaded = { exports: {} };
  const require = createRequire(filename);
  new Function("require", "module", "exports", compiled)(
    (name) =>
      Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const plans = loadSource("../src/lib/plans.ts");
function admission(client) {
  return loadSource("../src/lib/mailer.ts", {
    "./prisma": { prisma: client },
    "./plans": plans,
    "./smtp-settings": {},
    "@/lib/errors": { errorMessage: (error) => error.message },
    "./site": {
      trackingOrigin: () => {
        throw new Error("Tracking URL work is not part of admission.");
      },
    },
    "./tracker": {
      generateTrackingToken: () => crypto.randomBytes(16).toString("hex"),
    },
    nodemailer: {
      createTransport: () => {
        throw new Error("Regression must not create SMTP connections.");
      },
    },
  }).blastCampaignToAudience;
}
const admitA = admission(first);
const admitB = admission(second);
async function workspace(extra = {}) {
  const record = await prisma.workspace.create({
    data: {
      name: prefix,
      slug: `${prefix}-${workspaces.length}`,
      ownerId: userId,
      ...extra,
    },
  });
  workspaces.push(record.id);
  return record;
}
async function campaign(workspaceId, extra = {}) {
  const record = await prisma.campaign.create({
    data: {
      workspaceId,
      createdById: userId,
      name: prefix,
      subject: "Original subject",
      htmlContent: "Original content",
      type: "PRODUCT_UPDATE",
      recipientMode: "SELECTED",
      ...extra,
    },
  });
  campaigns.push(record.id);
  return record;
}
async function recipient(workspaceId, name, extra = {}) {
  return prisma.recipient.create({
    data: {
      workspaceId,
      email: `${prefix}-${name}@example.invalid`,
      consentStatus: "OPTED_IN",
      ...extra,
    },
  });
}
const request = (record, recipients, extra = {}) => ({
  workspaceId: record.workspaceId,
  campaignId: record.id,
  htmlContent: "Frozen admission content",
  subject: "Frozen admission subject",
  recipientList: recipients.map(({ email }) => ({ email })),
  ...extra,
});
async function rejected(promise, status) {
  await assert.rejects(promise, (error) => error.status === status);
  assertions++;
}
async function seedReservations(workspaceId, count) {
  const record = await campaign(workspaceId, { status: "COMPLETED" });
  const now = new Date();
  const previousMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  );
  const data = Array.from({ length: count + 2 }, (_, index) => ({
    id: crypto.randomUUID(),
    workspaceId,
    email: `${prefix}-reserved-${workspaceId}-${index}@example.invalid`,
    consentStatus: "OPTED_IN",
  }));
  await prisma.recipient.createMany({ data });
  const mappings = data.map((item) => ({
    id: crypto.randomUUID(),
    campaignId: record.id,
    recipientId: item.id,
    trackingToken: crypto.randomBytes(16).toString("hex"),
  }));
  await prisma.campaignRecipient.createMany({ data: mappings });
  await prisma.campaignDelivery.createMany({
    data: mappings.map((mapping, index) => ({
      campaignId: record.id,
      workspaceId,
      recipientId: mapping.recipientId,
      campaignRecipientId: mapping.id,
      status: index === count ? "CANCELED" : "SENT",
      queuedAt: index === count + 1 ? previousMonth : now,
    })),
  });
}

try {
  const owner = await prisma.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      password: "local-regression-no-login",
      isActive: false,
    },
  });
  userId = owner.id;
  const account = await workspace();
  const otherAccount = await workspace();
  const [eligible, optedOut, unknown, suppressed, unsubscribed, foreign] =
    await Promise.all([
      recipient(account.id, "eligible"),
      recipient(account.id, "out", { consentStatus: "OPTED_OUT" }),
      recipient(account.id, "unknown", { consentStatus: "UNKNOWN" }),
      recipient(account.id, "suppressed"),
      recipient(account.id, "unsubscribed", { unsubscribedAt: new Date() }),
      recipient(otherAccount.id, "foreign"),
    ]);
  await prisma.suppression.create({
    data: {
      workspaceId: account.id,
      email: suppressed.email,
      reason: "LOCAL_REGRESSION",
    },
  });
  const eligibleCampaign = await campaign(account.id);
  const results = await admitA(
    request(eligibleCampaign, [
      eligible,
      optedOut,
      unknown,
      suppressed,
      unsubscribed,
      foreign,
      { email: `${prefix}-missing@example.invalid` },
      { email: eligible.email.toUpperCase() },
    ]),
  );
  equal(
    results.length,
    7,
    "Normalized duplicate addresses must not inflate totals.",
  );
  equal(
    results.filter((item) => item.success).length,
    1,
    "Only eligible workspace recipients are admitted.",
  );
  equal(
    results.filter((item) => !item.success).length,
    6,
    "Every explicit exclusion must be reported truthfully.",
  );
  equal(
    await prisma.campaignDelivery.count({
      where: { campaignId: eligibleCampaign.id },
    }),
    1,
  );
  const before = await prisma.campaign.findUnique({
    where: { id: eligibleCampaign.id },
  });
  equal(before.status, "ACTIVE");
  equal(before.htmlContent, "Frozen admission content");
  await rejected(
    admitB(
      request(eligibleCampaign, [eligible], {
        htmlContent: "Must never replace accepted content",
      }),
    ),
    409,
  );
  const after = await prisma.campaign.findUnique({
    where: { id: eligibleCampaign.id },
  });
  equal(
    after.htmlContent,
    before.htmlContent,
    "Duplicate sends cannot change accepted content.",
  );
  equal(
    after.sendStartedAt,
    before.sendStartedAt,
    "Duplicate sends cannot reset admission time.",
  );

  const duplicateCampaign = await campaign(account.id);
  const duplicates = await Promise.allSettled([
    admitA(request(duplicateCampaign, [eligible])),
    admitB(request(duplicateCampaign, [eligible])),
  ]);
  equal(
    duplicates.filter((item) => item.status === "fulfilled").length,
    1,
    "Concurrent duplicate admission accepts one request.",
  );
  equal(
    duplicates.find((item) => item.status === "rejected").reason.status,
    409,
  );
  equal(
    await prisma.campaignDelivery.count({
      where: { campaignId: duplicateCampaign.id },
    }),
    1,
  );

  const noneCampaign = await campaign(account.id);
  const none = await admitA(request(noneCampaign, [unknown, suppressed]));
  equal(none.filter((item) => item.success).length, 0);
  equal(
    (await prisma.campaign.findUnique({ where: { id: noneCampaign.id } }))
      .status,
    "COMPLETED",
    "An all-excluded campaign must not be left actively waiting.",
  );
  equal(
    await prisma.campaignDelivery.count({
      where: { campaignId: noneCampaign.id },
    }),
    0,
  );

  const capped = await workspace();
  await seedReservations(capped.id, 499);
  equal(
    await prisma.campaignDelivery.count({
      where: plans.monthlyEmailUsageWhere(capped.id),
    }),
    499,
    "Canceled and previous UTC month reservations do not consume this month's quota.",
  );
  const capRecipient = await recipient(capped.id, "cap");
  const capCampaigns = await Promise.all([
    campaign(capped.id),
    campaign(capped.id),
  ]);
  const quota = await Promise.allSettled([
    admitA(request(capCampaigns[0], [capRecipient])),
    admitB(request(capCampaigns[1], [capRecipient])),
  ]);
  equal(
    quota.filter((item) => item.status === "fulfilled").length,
    1,
    "Concurrent campaigns cannot reserve the same last email quota.",
  );
  equal(quota.find((item) => item.status === "rejected").reason.status, 402);
  equal(
    await prisma.campaignDelivery.count({
      where: plans.monthlyEmailUsageWhere(capped.id),
    }),
    500,
  );
  const rejectedCampaign =
    capCampaigns[quota.findIndex((item) => item.status === "rejected")];
  const untouched = await prisma.campaign.findUnique({
    where: { id: rejectedCampaign.id },
  });
  equal(untouched.status, "DRAFT");
  equal(
    untouched.htmlContent,
    "Original content",
    "Quota rejection must preserve campaign content.",
  );
  equal(
    await prisma.campaignRecipient.count({
      where: { campaignId: rejectedCampaign.id },
    }),
    0,
  );

  const billing = await workspace({
    plan: "BUSINESS",
    billingStatus: "INCOMPLETE",
  });
  await seedReservations(billing.id, 499);
  const billRecipients = await Promise.all([
    recipient(billing.id, "billing-first"),
    recipient(billing.id, "billing-second"),
  ]);
  const billCampaign = await campaign(billing.id);
  await rejected(admitA(request(billCampaign, billRecipients)), 402);
  const fitting = await admitA(
    request(billCampaign, [
      billRecipients[0],
      { email: `${prefix}-not-present@example.invalid` },
    ]),
  );
  equal(
    fitting.filter((item) => item.success).length,
    1,
    "Only actual queue reservations count against remaining free entitlement.",
  );

  const rollbackCampaign = await campaign(account.id);
  // Fail after the campaign claim and recipient-map insert, at durable delivery
  // insertion, using a proxy over the real interactive transaction. No app hooks.
  const failureClient = new Proxy(first, {
    get(target, key) {
      if (key !== "$transaction") return Reflect.get(target, key);
      return (callback, options) =>
        target.$transaction(
          (transaction) =>
            callback(
              new Proxy(transaction, {
                get(tx, name) {
                  if (name !== "campaignDelivery") return Reflect.get(tx, name);
                  return new Proxy(tx.campaignDelivery, {
                    get(delegate, operation) {
                      if (operation === "createMany")
                        return async () => {
                          throw new Error(
                            "LOCAL_FAULT_AFTER_RECIPIENT_MAPPING",
                          );
                        };
                      return Reflect.get(delegate, operation);
                    },
                  });
                },
              }),
            ),
          options,
        );
    },
  });
  await assert.rejects(
    admission(failureClient)(request(rollbackCampaign, [eligible])),
    /LOCAL_FAULT_AFTER_RECIPIENT_MAPPING/,
  );
  assertions++;
  const rolledBack = await prisma.campaign.findUnique({
    where: { id: rollbackCampaign.id },
  });
  equal(rolledBack.status, "DRAFT");
  equal(rolledBack.htmlContent, "Original content");
  equal(rolledBack.subject, "Original subject");
  equal(rolledBack.sendStartedAt, null);
  equal(
    await prisma.campaignRecipient.count({
      where: { campaignId: rollbackCampaign.id },
    }),
    0,
    "A failed admission must not leave partial recipient mappings.",
  );
  equal(
    await prisma.campaignDelivery.count({
      where: { campaignId: rollbackCampaign.id },
    }),
    0,
  );
  equal(
    (await admitB(request(rollbackCampaign, [eligible]))).filter(
      (item) => item.success,
    ).length,
    1,
    "A rolled-back admission can be safely retried.",
  );

  const oversized = await campaign(account.id);
  await rejected(
    admitA(
      request(
        oversized,
        Array.from({ length: 1001 }, (_, i) => ({
          email: `${prefix}-${i}@example.invalid`,
        })),
      ),
    ),
    400,
  );
  equal(
    (await prisma.campaign.findUnique({ where: { id: oversized.id } })).status,
    "DRAFT",
  );
  console.log(
    `Queue admission regression passed: ${assertions} assertions; concurrent quota/duplicate claims, eligibility, billing state, UTC reservation accounting, and full rollback/retry. No email sent.`,
  );
} finally {
  await prisma.campaignDelivery.deleteMany({
    where: { workspaceId: { in: workspaces } },
  });
  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: { in: campaigns } },
  });
  await prisma.campaign.deleteMany({ where: { id: { in: campaigns } } });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaces } } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await Promise.all(clients.map((client) => client.$disconnect()));
}
