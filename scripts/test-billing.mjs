// Local-only billing regression checks. All database and Stripe operations are
// in-memory fakes; this script never connects to a database or remote service.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { BillingStatus, DeliveryStatus, Plan, Prisma } from "@prisma/client";
import ts from "typescript";

function load(path, dependencies = {}) {
  const filename = new URL(path, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const loadedModule = { exports: {} };
  const require = createRequire(filename);
  new Function("require", "module", "exports", compiled)(
    (name) =>
      Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    loadedModule,
    loadedModule.exports,
  );
  return loadedModule.exports;
}

let checks = 0;
function equal(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
}
// A small query interpreter lets fixtures exercise actual Prisma filter
// behavior rather than assert that production code spells a query a certain way.
function matches(row, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === "AND")
      return [expected].flat().every((item) => matches(row, item));
    if (field === "OR") return expected.some((item) => matches(row, item));
    if (field === "NOT")
      return ![expected].flat().some((item) => matches(row, item));
    const actual = row[field];
    if (expected instanceof Date)
      return actual instanceof Date && actual.getTime() === expected.getTime();
    if (
      expected &&
      typeof expected === "object" &&
      !(expected instanceof Date)
    ) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === "equals") return actual === value;
        if (operator === "not") return actual !== value;
        if (operator === "in") return value.includes(actual);
        if (operator === "notIn") return !value.includes(actual);
        if (operator === "gte") return actual >= value;
        if (operator === "lt") return actual < value;
        throw new Error(`Unsupported test query operator: ${operator}`);
      });
    }
    return actual === expected;
  });
}

function fakeDatabase(workspaces) {
  let state = { workspaces: structuredClone(workspaces), events: new Map() };
  const calls = { transactions: 0, reads: 0, writes: 0 };
  function client(current) {
    const find = async ({ where, select }) => {
      calls.reads++;
      const row = current.workspaces.find((item) => matches(item, where));
      if (!row) return null;
      return structuredClone(
        select
          ? Object.fromEntries(
              Object.keys(select)
                .filter((key) => select[key])
                .map((key) => [key, row[key]]),
            )
          : row,
      );
    };
    return {
      workspace: {
        findUnique: find,
        findFirst: find,
        async updateMany({ where, data }) {
          let count = 0;
          for (const row of current.workspaces) {
            if (!matches(row, where)) continue;
            if (
              ["stripeCustomerId", "stripeSubscriptionId"].some(
                (key) =>
                  data[key] &&
                  current.workspaces.some(
                    (other) => other.id !== row.id && other[key] === data[key],
                  ),
              )
            ) {
              throw new Prisma.PrismaClientKnownRequestError(
                "Duplicate local billing identity",
                {
                  code: "P2002",
                  clientVersion: "local-test",
                },
              );
            }
            Object.assign(row, structuredClone(data));
            row.updatedAt = new Date(row.updatedAt.getTime() + 1);
            count++;
          }
          calls.writes += count;
          return { count };
        },
      },
      stripeWebhookEvent: {
        async findUnique({ where, select }) {
          calls.reads++;
          const row = current.events.get(where.id);
          return row
            ? structuredClone(
                select
                  ? Object.fromEntries(
                      Object.keys(select)
                        .filter((key) => select[key])
                        .map((key) => [key, row[key]]),
                    )
                  : row,
              )
            : null;
        },
        async create({ data }) {
          if (current.events.has(data.id)) {
            throw new Prisma.PrismaClientKnownRequestError(
              "Duplicate local webhook event",
              {
                code: "P2002",
                clientVersion: "local-test",
              },
            );
          }
          current.events.set(data.id, structuredClone(data));
          return data;
        },
      },
    };
  }
  const prisma = {
    stripeWebhookEvent: {
      findUnique: (query) => client(state).stripeWebhookEvent.findUnique(query),
    },
    workspace: {
      findUnique: (query) => client(state).workspace.findUnique(query),
      findFirst: (query) => client(state).workspace.findFirst(query),
      updateMany: (query) => client(state).workspace.updateMany(query),
    },
    async $transaction(callback) {
      calls.transactions++;
      const pending = structuredClone(state);
      const result = await callback(client(pending));
      state = pending;
      return result;
    },
  };
  return {
    prisma,
    calls,
    row(id = "workspace-local") {
      return structuredClone(state.workspaces.find((row) => row.id === id));
    },
    eventCount() {
      return state.events.size;
    },
  };
}

const envKeys = [
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_BUSINESS",
];
const savedEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);
const originalFetch = globalThis.fetch;
const secret = "local-only-webhook-secret";
// Even a missing dependency injection cannot send a real HTTP request.
globalThis.fetch = async () => {
  throw new Error("Network access is disabled in local billing checks.");
};
process.env.STRIPE_WEBHOOK_SECRET = secret;
process.env.STRIPE_PRICE_STARTER = "price_local_starter";
process.env.STRIPE_PRICE_GROWTH = "price_local_growth";
process.env.STRIPE_PRICE_BUSINESS = "price_local_business";

try {
  const plans = load("../src/lib/plans.ts");
  const stripe = load("../src/lib/stripe.ts");
  for (const plan of Object.values(Plan)) {
    for (const status of Object.values(BillingStatus)) {
      const entitled = status === "ACTIVE" || status === "TRIALING";
      equal(
        plans.effectivePlan(plan, status),
        entitled ? plan : "FREE",
        `${plan}/${status} must have the correct effective entitlement.`,
      );
    }
  }

  const month = new Date("2026-03-01T00:00:00.000Z");
  equal(
    plans.getUtcMonthStart(new Date("2026-03-01T01:30:00+06:00")),
    new Date("2026-02-01T00:00:00.000Z"),
    "Monthly quotas use UTC even near a local month boundary.",
  );
  const usage = plans.monthlyEmailUsageWhere("workspace-local", month);
  for (const status of Object.values(DeliveryStatus)) {
    const delivery = {
      workspaceId: "workspace-local",
      status,
      queuedAt: month,
      sentAt: null,
    };
    equal(
      matches(delivery, usage),
      status !== "CANCELED",
      `${status} reservations must consume quota unless explicitly canceled.`,
    );
    equal(
      matches(
        { ...delivery, queuedAt: new Date(month.getTime() - 1), sentAt: month },
        usage,
      ),
      false,
      "A previous-month reservation must not be charged again when it is sent this month.",
    );
  }
  equal(
    matches(
      { workspaceId: "another-workspace", status: "QUEUED", queuedAt: month },
      usage,
    ),
    false,
    "One workspace must never consume another workspace's quota.",
  );

  const freshWorkspace = (overrides = {}) => ({
    id: "workspace-local",
    plan: "FREE",
    billingStatus: "ACTIVE",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  });
  const subscription = (id = "sub_current", overrides = {}) => ({
    id,
    customer: "cus_local",
    status: "active",
    metadata: { workspaceId: "workspace-local", plan: "BUSINESS" },
    items: { data: [{ price: { id: "price_local_starter" } }] },
    ...overrides,
  });
  let sequence = 0;
  const event = (type, object) => ({
    id: `evt_local_${++sequence}`,
    type,
    data: { object },
  });
  function signedRequest(
    value,
    { timestamp = Math.floor(Date.now() / 1000), signature } = {},
  ) {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const digest = crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");
    return new Request("https://billing.example.invalid/api/billing/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": signature ?? `t=${timestamp},v1=${digest}`,
      },
    });
  }
  function webhookFixture(initial = freshWorkspace()) {
    const database = fakeDatabase(Array.isArray(initial) ? initial : [initial]);
    const snapshots = new Map();
    const reads = [];
    let unavailable = false;
    const route = load("../src/app/api/billing/webhook/route.ts", {
      "@/lib/prisma": { prisma: database.prisma },
      "@/lib/stripe": {
        ...stripe,
        async stripeGet(path) {
          reads.push(path);
          if (unavailable)
            throw new Error("Local Stripe simulation unavailable");
          assert.ok(
            path.startsWith("subscriptions/"),
            "Only a subscription snapshot should be requested.",
          );
          const id = decodeURIComponent(path.slice("subscriptions/".length));
          assert.ok(
            snapshots.has(id),
            "A local subscription snapshot must be provided.",
          );
          return structuredClone(snapshots.get(id));
        },
      },
    });
    return {
      database,
      snapshots,
      reads,
      post: (value, options) => route.POST(signedRequest(value, options)),
      setUnavailable(value) {
        unavailable = value;
      },
    };
  }
  async function processingFailure(operation) {
    const previousError = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args);
    try {
      const response = await operation();
      equal(
        response.status,
        500,
        "A reconciliation failure must ask Stripe to retry the event.",
      );
      equal(
        errors.length,
        1,
        "A reconciliation failure must remain observable in server logs.",
      );
    } finally {
      console.error = previousError;
    }
  }

  const unsigned = webhookFixture();
  const activeEvent = event("customer.subscription.updated", subscription());
  for (const options of [
    { signature: "t=0,v1=invalid" },
    { timestamp: Math.floor(Date.now() / 1000) - 601 },
    { timestamp: Math.floor(Date.now() / 1000) + 601 },
    { signature: "t=not-a-timestamp,v1=" + "0".repeat(64) },
  ]) {
    equal(
      (await unsigned.post(activeEvent, options)).status,
      400,
      "Invalid signatures must be rejected.",
    );
  }
  equal(
    unsigned.database.calls,
    { transactions: 0, reads: 0, writes: 0 },
    "An invalid signature must not touch the database.",
  );
  equal(
    unsigned.reads.length,
    0,
    "An invalid signature must not contact Stripe.",
  );
  equal(
    (await unsigned.post("{invalid-json")).status,
    400,
    "Signed malformed JSON must be rejected.",
  );
  equal(
    (await unsigned.post("x".repeat(1_000_001))).status,
    413,
    "A large body cannot bypass the limit by omitting Content-Length.",
  );
  equal(unsigned.database.calls.transactions, 0);

  const unavailable = webhookFixture();
  unavailable.snapshots.set("sub_current", subscription());
  unavailable.setUnavailable(true);
  const retriedEvent = event("customer.subscription.created", subscription());
  await processingFailure(() => unavailable.post(retriedEvent));
  equal(
    unavailable.database.eventCount(),
    0,
    "A Stripe lookup failure must not consume the event ID.",
  );
  equal(
    unavailable.database.calls.transactions,
    0,
    "No transaction should remain open while contacting Stripe.",
  );
  unavailable.setUnavailable(false);
  equal(
    (await unavailable.post(retriedEvent)).status,
    200,
    "The same event can reconcile after Stripe recovers.",
  );
  equal(unavailable.database.eventCount(), 1);

  const missingWorkspace = webhookFixture();
  missingWorkspace.snapshots.set(
    "sub_current",
    subscription("sub_current", {
      metadata: { workspaceId: "missing-workspace" },
    }),
  );
  await processingFailure(() =>
    missingWorkspace.post(
      event("customer.subscription.created", subscription()),
    ),
  );
  equal(
    missingWorkspace.database.eventCount(),
    0,
    "An unknown workspace must roll back the webhook event record.",
  );
  equal(missingWorkspace.database.row(), freshWorkspace());

  const updated = webhookFixture();
  updated.snapshots.set("sub_current", subscription());
  const activation = event("customer.subscription.created", subscription());
  equal((await updated.post(activation)).status, 200);
  equal(
    updated.database.row().plan,
    "STARTER",
    "The Stripe price controls the plan, regardless of metadata claims.",
  );
  equal(updated.database.row().billingStatus, "ACTIVE");
  const writesAfterActivation = updated.database.calls.writes;
  const duplicate = await updated.post(activation);
  equal(
    duplicate.status,
    200,
    "A correctly signed duplicate should be acknowledged.",
  );
  equal((await duplicate.json()).duplicate, true);
  equal(
    updated.database.calls.writes,
    writesAfterActivation,
    "Duplicate delivery cannot repeat a workspace mutation.",
  );
  equal(updated.database.eventCount(), 1);
  equal(
    updated.reads.length,
    1,
    "A committed duplicate can be acknowledged without another Stripe lookup.",
  );

  updated.snapshots.set(
    "sub_current",
    subscription("sub_current", { status: "past_due" }),
  );
  equal(
    (await updated.post(event("customer.subscription.updated", subscription())))
      .status,
    200,
  );
  equal(
    updated.database.row().billingStatus,
    "PAST_DUE",
    "Use the current Stripe snapshot rather than an obsolete active event payload.",
  );
  equal(
    plans.effectivePlan(
      updated.database.row().plan,
      updated.database.row().billingStatus,
    ),
    "FREE",
  );

  const checkout = webhookFixture();
  checkout.snapshots.set(
    "sub_current",
    subscription("sub_current", { status: "incomplete" }),
  );
  equal(
    (
      await checkout.post(
        event("checkout.session.completed", {
          id: "cs_local",
          mode: "subscription",
          payment_status: "paid",
          client_reference_id: "workspace-local",
          customer: "cus_local",
          subscription: "sub_current",
          metadata: { workspaceId: "workspace-local", plan: "BUSINESS" },
        }),
      )
    ).status,
    200,
  );
  equal(
    plans.effectivePlan(
      checkout.database.row().plan,
      checkout.database.row().billingStatus,
    ),
    "FREE",
    "A paid checkout claim cannot grant paid access while Stripe says the subscription is incomplete.",
  );

  const current = freshWorkspace({
    plan: "GROWTH",
    billingStatus: "ACTIVE",
    stripeCustomerId: "cus_local",
    stripeSubscriptionId: "sub_current",
  });
  const obsolete = webhookFixture(current);
  obsolete.snapshots.set(
    "sub_old",
    subscription("sub_old", { status: "past_due" }),
  );
  for (const type of [
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ]) {
    equal(
      (
        await obsolete.post(
          event(type, subscription("sub_old", { status: "canceled" })),
        )
      ).status,
      200,
    );
    equal(
      obsolete.database.row(),
      current,
      "Events for an obsolete subscription must preserve the current subscription and access.",
    );
  }
  const mismatchedCustomer = webhookFixture(current);
  mismatchedCustomer.snapshots.set(
    "sub_current",
    subscription("sub_current", { customer: "cus_foreign" }),
  );
  await processingFailure(() =>
    mismatchedCustomer.post(
      event("customer.subscription.updated", subscription()),
    ),
  );
  equal(
    mismatchedCustomer.database.row(),
    current,
    "Metadata cannot reassign a workspace to another Stripe customer.",
  );
  equal(mismatchedCustomer.database.eventCount(), 0);
  const identityConflict = webhookFixture([
    freshWorkspace(),
    freshWorkspace({ id: "workspace-foreign", stripeCustomerId: "cus_local" }),
  ]);
  identityConflict.snapshots.set("sub_current", subscription());
  await processingFailure(() =>
    identityConflict.post(
      event("customer.subscription.created", subscription()),
    ),
  );
  equal(
    identityConflict.database.eventCount(),
    0,
    "A unique billing identity conflict cannot masquerade as a duplicate webhook.",
  );
  equal(identityConflict.database.row(), freshWorkspace());

  const invoices = webhookFixture(current);
  for (const type of ["invoice.payment_failed", "invoice.payment_succeeded"]) {
    equal(
      (
        await invoices.post(
          event(type, { id: "in_one_off", customer: "cus_local" }),
        )
      ).status,
      200,
    );
    equal(
      invoices.database.row(),
      current,
      "One-off invoices cannot change subscription entitlement.",
    );
  }
  equal(
    invoices.reads.length,
    0,
    "One-off invoices do not require a subscription lookup.",
  );
  invoices.snapshots.set(
    "sub_old",
    subscription("sub_old", { status: "past_due" }),
  );
  equal(
    (
      await invoices.post(
        event("invoice.payment_failed", {
          customer: "cus_local",
          subscription: "sub_old",
        }),
      )
    ).status,
    200,
  );
  equal(
    invoices.database.row(),
    current,
    "An old subscription invoice cannot downgrade the active subscription.",
  );
  invoices.snapshots.set(
    "sub_current",
    subscription("sub_current", { status: "past_due" }),
  );
  equal(
    (
      await invoices.post(
        event("invoice.payment_succeeded", {
          customer: "cus_local",
          parent: { subscription_details: { subscription: "sub_current" } },
        }),
      )
    ).status,
    200,
  );
  equal(
    invoices.database.row().billingStatus,
    "PAST_DUE",
    "A success invoice must still respect Stripe's authoritative current subscription status.",
  );

  const canceledWorkspace = freshWorkspace({
    plan: "FREE",
    billingStatus: "CANCELED",
    stripeCustomerId: "cus_local",
    stripeSubscriptionId: "sub_current",
  });
  const canceled = webhookFixture(canceledWorkspace);
  canceled.snapshots.set("sub_current", subscription());
  equal(
    (
      await canceled.post(
        event("customer.subscription.updated", subscription()),
      )
    ).status,
    200,
  );
  equal(
    canceled.database.row(),
    canceledWorkspace,
    "A terminal cancellation cannot be revived by a late update for the same subscription.",
  );
  canceled.snapshots.set("sub_replacement", subscription("sub_replacement"));
  equal(
    (
      await canceled.post(
        event("checkout.session.completed", {
          mode: "subscription",
          subscription: "sub_replacement",
          customer: "cus_local",
          metadata: { workspaceId: "workspace-local" },
        }),
      )
    ).status,
    200,
  );
  equal(
    canceled.database.row().stripeSubscriptionId,
    "sub_replacement",
    "A new checkout may replace a canceled subscription for the same customer.",
  );
  equal(canceled.database.row().billingStatus, "ACTIVE");

  const checkoutDb = fakeDatabase([freshWorkspace()]);
  const checkoutCalls = [];
  const checkoutRoute = load("../src/app/api/billing/checkout/route.ts", {
    "@/lib/prisma": { prisma: checkoutDb.prisma },
    "@/lib/access": {
      requireApiUser: async (role) => {
        equal(
          role,
          "admin",
          "Checkout is restricted to workspace administrators.",
        );
        return {
          user: {
            workspaceId: "workspace-local",
            email: "local@example.invalid",
          },
        };
      },
    },
    "@/lib/site": {
      applicationOrigin: () => "https://billing.example.invalid",
    },
    "@/lib/stripe": {
      ...stripe,
      stripePost: async (...args) => {
        checkoutCalls.push(args);
        return {
          id: "cs_local",
          url: "https://checkout.stripe.com/c/pay/local-only",
        };
      },
    },
  });
  const checkoutRequest = (plan) =>
    new Request("https://billing.example.invalid/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
      headers: { "content-type": "application/json" },
    });
  equal((await checkoutRoute.POST(checkoutRequest("BUSINESS"))).status, 200);
  equal(
    checkoutDb.row(),
    freshWorkspace(),
    "Creating a checkout session alone must never grant paid access.",
  );
  equal(checkoutDb.calls.writes, 0);
  equal(checkoutCalls.length, 1);
  equal(checkoutCalls[0][1]["line_items[0][price]"], "price_local_business");
  equal(checkoutCalls[0][1]["metadata[workspaceId]"], "workspace-local");
  equal((await checkoutRoute.POST(checkoutRequest("FREE"))).status, 400);
  equal(
    checkoutCalls.length,
    1,
    "Invalid plans must not create Stripe sessions.",
  );
  equal((await checkoutRoute.POST(checkoutRequest("BUSINESS"))).status, 200);
  equal(
    typeof checkoutCalls[0][2],
    "string",
    "Checkout creation must supply a Stripe idempotency key.",
  );
  equal(
    checkoutCalls[1][2],
    checkoutCalls[0][2],
    "Retrying the same checkout must reuse its Stripe idempotency key.",
  );
  equal((await checkoutRoute.POST(checkoutRequest("STARTER"))).status, 200);
  equal(
    checkoutCalls[2][2] === checkoutCalls[0][2],
    false,
    "Changing plans must create a distinct checkout operation.",
  );

  for (const billingStatus of [
    "ACTIVE",
    "TRIALING",
    "PAST_DUE",
    "INCOMPLETE",
  ]) {
    const existingDb = fakeDatabase([
      freshWorkspace({ billingStatus, stripeSubscriptionId: "sub_current" }),
    ]);
    const existingRoute = load("../src/app/api/billing/checkout/route.ts", {
      "@/lib/prisma": { prisma: existingDb.prisma },
      "@/lib/access": {
        requireApiUser: async () => ({
          user: { workspaceId: "workspace-local" },
        }),
      },
      "@/lib/site": {
        applicationOrigin: () => "https://billing.example.invalid",
      },
      "@/lib/stripe": {
        ...stripe,
        stripePost: async () =>
          assert.fail("An existing subscription must use the billing portal."),
      },
    });
    equal(
      (await existingRoute.POST(checkoutRequest("GROWTH"))).status,
      409,
      `${billingStatus} subscriptions must not start a duplicate subscription checkout.`,
    );
    equal(existingDb.calls.writes, 0);
  }

  console.log(
    `Passed ${checks} local billing entitlement, quota, signature, idempotency, subscription identity, and checkout checks.`,
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
}
