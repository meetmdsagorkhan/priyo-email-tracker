// Isolated integration regression. No SMTP connections or production services.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const base = new URL(process.env.TEST_BASE_URL || "http://localhost:3150").origin;
const database = new URL(process.env.DATABASE_URL || "");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname) && database.pathname === "/signalpost_ui_test", "Use only the dedicated local test database.");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local application.");
const db = new PrismaClient();
const prefix = "groups-test-" + crypto.randomUUID();
const password = crypto.randomBytes(20).toString("hex");
const users = [], workspaces = [], campaigns = [];
let checks = 0;
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function client() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (cookies.size) headers.set("cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
    for (const raw of response.headers.getSetCookie()) { const pair = raw.split(";")[0], i = pair.indexOf("="); cookies.set(pair.slice(0, i), pair.slice(i + 1)); }
    return response;
  };
}
async function json(client, method, path, body, status = 200) {
  const response = await client(path, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  equal(response.status, status, `${method} ${path}: ${await response.clone().text()}`);
  return response.json();
}
async function account(role, suffix) {
  const user = await db.user.create({ data: { email: `${prefix}-${suffix}@example.invalid`, password: await bcrypt.hash(password, 10), role, emailVerifiedAt: new Date() } });
  users.push(user.id); return user;
}
async function login(user) {
  const request = client(); const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: user.email, password, json: "true", callbackUrl: base }) });
  equal((await (await request("/api/auth/session")).json()).user.email, user.email, "Authenticated fixture");
  return request;
}
try {
  const admin = await account("ADMIN", "admin");
  const viewer = await account("VIEWER", "viewer");
  const other = await account("ADMIN", "other");
  const workspace = await db.workspace.create({ data: { name: prefix, slug: prefix, ownerId: admin.id, memberships: { create: [{ userId: admin.id, role: "ADMIN" }, { userId: viewer.id, role: "VIEWER" }] } } }); workspaces.push(workspace.id);
  const foreignWorkspace = await db.workspace.create({ data: { name: prefix + "-foreign", slug: prefix + "-foreign", ownerId: other.id, memberships: { create: { userId: other.id, role: "ADMIN" } } } }); workspaces.push(foreignWorkspace.id);
  const recipients = await Promise.all(["first", "second", "third", "unknown", "out", "suppressed", "ungrouped", "foreign"].map((name, i) => db.recipient.create({ data: {
    workspaceId: i === 7 ? foreignWorkspace.id : workspace.id, email: `${prefix}-${name}@example.invalid`,
    consentStatus: i === 3 ? "UNKNOWN" : i === 4 ? "OPTED_OUT" : "OPTED_IN", ...(i === 4 ? { unsubscribedAt: new Date() } : {}),
  } })));
  const [first, second, third, unknown, out, suppressed, ungrouped, foreign] = recipients;
  await db.suppression.create({ data: { workspaceId: workspace.id, email: suppressed.email, reason: "LOCAL_TEST" } });
  const adminClient = await login(admin), viewerClient = await login(viewer), otherClient = await login(other);
  const api = "/api/recipient-groups";
  await json(client(), "POST", api, { name: "No auth" }, 401);
  await json(viewerClient, "POST", api, { name: "No permission" }, 403);
  await json(adminClient, "POST", api, { name: "  " }, 400);
  await json(adminClient, "POST", api, { name: "Bad IDs", recipientIds: [first.id, foreign.id] }, 404);
  equal(await db.segment.count({ where: { workspaceId: workspace.id } }), 0, "Invalid mixed-tenant creation is atomic");
  const group = await json(adminClient, "POST", api, { name: " Priyo Agency ", recipientIds: [first.id, first.id, unknown.id, out.id, suppressed.id] }, 201);
  equal(group.name, "Priyo Agency", "Trim names");
  await json(adminClient, "POST", api, { name: "Priyo Agency" }, 409);
  let groups = await json(viewerClient, "GET", api);
  equal(groups[0].memberCount, 4, "Membership deduplicates without changing consent");
  equal(groups[0].audienceCount, 1, "Eligibility excludes unknown, opt-out, suppression");
  equal(await json(otherClient, "GET", api), [], "Groups are tenant isolated");
  await json(otherClient, "PATCH", api, { id: group.id, action: "add", recipientIds: [foreign.id] }, 404);
  await json(adminClient, "PATCH", api, { id: group.id, action: "add", recipientIds: [second.id, foreign.id] }, 404);
  equal((await db.segment.findUnique({ where: { id: group.id } })).definition.recipientIds.includes(second.id), false, "Mixed-tenant update makes no changes");
  await Promise.all([second, third].map(r => json(adminClient, "PATCH", api, { id: group.id, action: "add", recipientIds: [r.id] })));
  groups = await json(adminClient, "GET", api);
  equal(groups[0].memberCount, 6, "Concurrent additions are both preserved");
  equal(groups[0].audienceCount, 3, "Group eligible count reflects added contacts");
  await json(adminClient, "PATCH", api, { id: group.id, action: "remove", recipientIds: [third.id] });
  equal(await db.recipient.count({ where: { id: third.id } }), 1, "Removing a membership keeps the contact");
  await json(adminClient, "PATCH", api, { id: group.id, action: "rename", name: "Priyo clients" });
  equal((await json(adminClient, "GET", api))[0].name, "Priyo clients", "Rename persists");
  const segment = await db.segment.create({ data: { workspaceId: workspace.id, name: "Engaged", definition: { campaignId: "unused", engagement: "OPENED" } } });
  await json(adminClient, "PATCH", api, { id: segment.id, action: "add", recipientIds: [first.id] }, 404);
  await db.segment.delete({ where: { id: segment.id } });
  equal(await json(adminClient, "GET", "/api/segments"), [], "Static groups do not break dynamic segment listing");
  const campaign = await db.campaign.create({ data: { workspaceId: workspace.id, createdById: admin.id, name: "Group campaign", subject: "Group update", type: "PRODUCT_UPDATE", recipientMode: "BULK" } }); campaigns.push(campaign.id);
  const sendPath = `/api/campaigns/${campaign.id}/send-blast`;
  const htmlContent = '<html><body>Agency news<a href="https://example.invalid">Details</a></body></html>';
  await json(adminClient, "POST", sendPath, { htmlContent, groupId: group.id, segmentId: "ambiguous" }, 400);
  await json(otherClient, "POST", sendPath, { htmlContent, groupId: group.id }, 404);
  await json(adminClient, "POST", sendPath, { htmlContent, groupId: "missing", recipients: [{ email: ungrouped.email }] }, 404);
  const emptyGroup = await json(adminClient, "POST", api, { name: "Empty group" }, 201);
  await json(adminClient, "POST", sendPath, { htmlContent, groupId: emptyGroup.id }, 400);
  equal(await db.campaignDelivery.count({ where: { campaignId: campaign.id } }), 0, "Empty group cannot fall back to all contacts");
  await json(adminClient, "DELETE", api, { id: emptyGroup.id });
  const queued = await json(adminClient, "POST", sendPath, { htmlContent, groupId: group.id, recipients: [{ email: ungrouped.email }] }, 202);
  equal(queued.queued, 2, "Group replaces campaign/default/explicit audience");
  equal((await db.campaignDelivery.findMany({ where: { campaignId: campaign.id }, select: { recipientId: true } })).map(d => d.recipientId).sort(), [first.id, second.id].sort(), "Only eligible group recipients are queued");
  equal((await db.recipient.findUnique({ where: { id: unknown.id } })).consentStatus, "UNKNOWN", "Membership never grants consent");
  await json(viewerClient, "DELETE", api, { id: group.id }, 403);
  await json(otherClient, "DELETE", api, { id: group.id }, 404);
  await json(adminClient, "DELETE", api, { id: group.id });
  equal(await db.campaignDelivery.count({ where: { campaignId: campaign.id } }), 2, "Deleting group preserves frozen queued recipients");
  equal(await db.recipient.count({ where: { workspaceId: workspace.id } }), 7, "Deleting group preserves all contacts");
  equal(await json(adminClient, "GET", api), [], "Deleted group no longer listed");
  await db.recipient.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ workspaceId: workspace.id, email: `${prefix}-page-${i}@example.invalid` })) });
  const page1 = await json(adminClient, "GET", "/api/recipients");
  const page2 = await json(adminClient, "GET", `/api/recipients?cursor=${page1.at(-1).id}`);
  equal(page1.length, 100, "First directory page is bounded");
  equal(page2.length, 8, "Older recipients remain accessible");
  equal(new Set([...page1, ...page2].map(r => r.id)).size, 108, "Pagination has no overlap or omissions");
  await json(adminClient, "GET", `/api/recipients?cursor=${foreign.id}`, undefined, 404);
  console.log(`Passed ${checks} group, bulk membership, campaign audience, permissions, consent, concurrency, and pagination checks.`);
} finally {
  await db.trackingEvent.deleteMany({ where: { campaignId: { in: campaigns } } });
  await db.campaignDelivery.deleteMany({ where: { campaignId: { in: campaigns } } });
  await db.campaignLink.deleteMany({ where: { campaignId: { in: campaigns } } });
  await db.campaignRecipient.deleteMany({ where: { campaignId: { in: campaigns } } });
  await db.campaign.deleteMany({ where: { id: { in: campaigns } } });
  await db.workspace.deleteMany({ where: { id: { in: workspaces } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}
