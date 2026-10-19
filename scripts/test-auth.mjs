// Run only against a dedicated local test database and a running app instance.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
const base = process.env.TEST_BASE_URL || "http://localhost:3100";
const db = new URL(process.env.DATABASE_URL || "");
assert.ok(
  ["127.0.0.1", "localhost"].includes(db.hostname),
  "Tests require a local database.",
);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Tests require a local server.",
);
assert.ok(
  process.env.CRON_SECRET,
  "Set the same CRON_SECRET in the local server and test environment.",
);
const prisma = new PrismaClient();
const prefix = `auth-test-${crypto.randomUUID()}`;
const password = crypto.randomBytes(24).toString("hex");
let checks = 0;
const ids = [];
const campaignIds = [];
const workspaceIds = [];
const emails = [];
const capturedMail = [];
const smtp = net.createServer((socket) => {
  let buffer = "",
    data = false,
    message = "";
  socket.write("220 localhost Test SMTP\r\n");
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (data) {
        if (line === ".") {
          capturedMail.push(message);
          message = "";
          data = false;
          socket.write("250 Accepted\r\n");
        } else message += line + "\r\n";
      } else if (line.startsWith("EHLO"))
        socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH")) socket.write("235 Authenticated\r\n");
      else if (line === "DATA") {
        data = true;
        socket.write("354 Send data\r\n");
      } else if (line === "QUIT") {
        socket.end("221 Bye\r\n");
      } else socket.write("250 OK\r\n");
    }
  });
});
await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
const smtpConfig = {
  host: "127.0.0.1",
  port: smtp.address().port,
  secure: false,
  user: "local-test",
  pass: "local-test",
  from: "test@example.invalid",
};
let testWorkspaceId;

function client() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (cookies.size)
      headers.set(
        "cookie",
        [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
      );
    const response = await fetch(base + path, {
      ...options,
      headers,
      redirect: "manual",
    });
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";")[0];
      const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return response;
  };
}
async function expectStatus(request, path, status, method = "GET", body) {
  const response = await request(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  // App Router loading boundaries can flush HTTP 200 before a server-side
  // role redirect. Verify the actual redirect instruction, never accept a
  // successful page just because its transport status is 200.
  if (status === 307 && response.status === 200 && path === "/campaigns/new") {
    const body = await response.clone().text();
    assert.ok(
      body.includes("/campaigns?access=read-only") &&
        (body.includes("NEXT_REDIRECT") ||
          body.includes('http-equiv="refresh"')),
      "Read-only roles must receive a real campaign-page redirect.",
    );
    assert.ok(
      !body.includes("Configure campaign settings and proceed"),
      "Restricted campaign form must not render.",
    );
    checks++;
    return response;
  }
  assert.equal(
    response.status,
    status,
    `${method} ${path}: expected ${status}, received ${response.status}`,
  );
  checks++;
  return response;
}
async function login(request, email, pass = password) {
  const csrf = await (await request("/api/auth/csrf")).json();
  return request("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: base,
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password: pass,
      json: "true",
      callbackUrl: base + "/",
    }),
  });
}
async function makeUser(role, active = true, verified = true) {
  const email = `${prefix}-${role.toLowerCase()}-${ids.length}@example.invalid`;
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        password: await bcrypt.hash(password, 12),
        name: `Test ${role}`,
        role,
        isActive: active,
        emailVerifiedAt: verified ? new Date() : null,
      },
    });
    if (!testWorkspaceId) {
      const workspace = await tx.workspace.create({
        data: {
          name: `${prefix} workspace`,
          slug: prefix,
          ownerId: created.id,
        },
      });
      testWorkspaceId = workspace.id;
      workspaceIds.push(workspace.id);
    }
    await tx.workspaceMembership.create({
      data: {
        workspaceId: testWorkspaceId,
        userId: created.id,
        role,
        isActive: active,
      },
    });
    return created;
  });
  ids.push(user.id);
  emails.push(email);
  return user;
}
try {
  const anon = client();
  await expectStatus(anon, "/login", 200);
  await expectStatus(anon, "/favicon.svg", 200);
  await expectStatus(anon, "/invite/" + "a".repeat(64), 200);
  await expectStatus(anon, "/", 307);
  await expectStatus(anon, "/api/recipients", 401);
  await expectStatus(anon, "/api/campaigns", 401, "POST", {});
  await expectStatus(anon, "/api/admin/invite", 401);
  await expectStatus(anon, "/api/billing/checkout", 401, "POST", {});
  const crossOrigin = await anon("/api/invite/accept", {
    method: "POST",
    headers: {
      origin: "https://untrusted.example",
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(crossOrigin.status, 403);
  checks++;
  const pixel = await expectStatus(anon, "/api/track/open/missing", 200);
  assert.equal(pixel.headers.get("content-type"), "image/gif");
  checks++;
  const adminUser = await makeUser("ADMIN");
  const isolatedEmail = `${prefix}-isolated@example.invalid`;
  const isolated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: isolatedEmail,
        password: await bcrypt.hash(password, 12),
        name: "Isolated workspace admin",
        role: "ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: `${prefix} isolated`,
        slug: `${prefix}-isolated`,
        ownerId: user.id,
      },
    });
    await tx.workspaceMembership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "ADMIN" },
    });
    return { user, workspace };
  });
  ids.push(isolated.user.id);
  emails.push(isolatedEmail);
  workspaceIds.push(isolated.workspace.id);
  const isolatedClient = client();
  await login(isolatedClient, isolatedEmail);
  assert.deepEqual(await (await isolatedClient("/api/recipients")).json(), []);
  checks++;
  const noCsrf = client();
  await noCsrf("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: base,
    },
    body: new URLSearchParams({
      email: adminUser.email,
      password,
      json: "true",
    }),
  });
  assert.ok(!(await (await noCsrf("/api/auth/session")).json()).user);
  checks++;
  const managerUser = await makeUser("CAMPAIGN_MANAGER");
  const viewerUser = await makeUser("VIEWER");
  const memberUser = await makeUser("MEMBER");
  const inactiveUser = await makeUser("ADMIN", false);
  const unverifiedUser = await makeUser("MEMBER", true, false);
  const admin = client(),
    manager = client(),
    viewer = client(),
    member = client(),
    inactive = client();
  const unverified = client();
  await login(inactive, inactiveUser.email);
  assert.ok(!(await (await inactive("/api/auth/session")).json()).user);
  checks++;
  await login(unverified, unverifiedUser.email);
  assert.ok(!(await (await unverified("/api/auth/session")).json()).user);
  checks++;
  await login(viewer, viewerUser.email, "incorrect-password");
  assert.ok(!(await (await viewer("/api/auth/session")).json()).user);
  checks++;
  for (const [request, user] of [
    [admin, adminUser],
    [manager, managerUser],
    [viewer, viewerUser],
    [member, memberUser],
  ]) {
    await login(request, user.email.toUpperCase());
    const session = await (await request("/api/auth/session")).json();
    assert.equal(session.user.role, user.role);
    checks++;
    await expectStatus(request, "/api/recipients", 200);
  }
  await expectStatus(admin, "/api/admin/users", 404, "PATCH", {
    id: isolated.user.id,
    role: "MEMBER",
    isActive: true,
  });
  for (const request of [viewer, member]) {
    await expectStatus(request, "/api/campaigns", 403, "POST", {});
    await expectStatus(request, "/api/recipients", 403, "POST", {});
    await expectStatus(request, "/api/admin/invite", 403);
    await expectStatus(request, "/api/admin/users", 403, "PATCH", {});
    await expectStatus(request, "/campaigns/new", 307);
    for (const action of ["generate-html", "send-test", "send-blast"])
      await expectStatus(
        request,
        `/api/campaigns/missing/${action}`,
        403,
        "POST",
        {},
      );
    await expectStatus(request, "/api/campaigns/missing/export-admin-csv", 403);
  }
  await expectStatus(manager, "/api/admin/invite", 403);
  await expectStatus(manager, "/api/billing/checkout", 403, "POST", {
    plan: "STARTER",
  });
  await expectStatus(manager, "/api/campaigns", 400, "POST", {});
  const created = await (
    await expectStatus(manager, "/api/campaigns", 200, "POST", {
      name: prefix,
      type: "ANNOUNCEMENT",
      recipientMode: "BULK",
    })
  ).json();
  campaignIds.push(created.id);
  await expectStatus(
    manager,
    `/api/campaigns/${created.id}/send-test`,
    200,
    "POST",
    {
      toEmail: "test@example.invalid",
      htmlContent: "<p>Local SMTP smoke test</p>",
      smtpConfig,
    },
  );
  assert.equal(capturedMail.length, 1);
  checks++;
  assert.ok(capturedMail[0].includes("Local SMTP smoke test"));
  checks++;

  await expectStatus(
    manager,
    `/api/campaigns/${created.id}/send-blast`,
    400,
    "POST",
    {},
  );
  const html = await (
    await expectStatus(
      manager,
      `/api/campaigns/${created.id}/generate-html`,
      200,
      "POST",
      {
        htmlContent:
          '<html><body><a href="https://example.invalid/landing">Go</a></body></html>',
      },
    )
  ).json();
  assert.equal(html.linkCount, 1);
  checks++;
  const campaignRecipient = await prisma.campaignRecipient.findFirst({
    where: { campaignId: created.id },
  });
  await expectStatus(
    anon,
    `/api/track/open/${campaignRecipient.trackingToken}`,
    200,
  );
  const campaignLink = await prisma.campaignLink.findFirst({
    where: { campaignId: created.id },
  });
  const click = await expectStatus(
    anon,
    `/api/track/click/${campaignLink.trackingToken}?t=${campaignRecipient.trackingToken}`,
    302,
  );
  assert.equal(
    click.headers.get("location"),
    "https://example.invalid/landing",
  );
  checks++;
  assert.equal(
    await prisma.trackingEvent.count({ where: { campaignId: created.id } }),
    2,
  );
  checks++;
  const optedIn = await prisma.recipient.create({
    data: {
      workspaceId: testWorkspaceId,
      email: `${prefix}-consented@example.invalid`,
      consentStatus: "OPTED_IN",
      consentSource: "TEST_FIXTURE",
      consentedAt: new Date(),
    },
  });
  const unknownConsent = await prisma.recipient.create({
    data: {
      workspaceId: testWorkspaceId,
      email: `${prefix}-unknown@example.invalid`,
    },
  });
  const blast = await (
    await expectStatus(
      manager,
      `/api/campaigns/${created.id}/send-blast`,
      202,
      "POST",
      { htmlContent: html.processedHtml },
    )
  ).json();
  assert.equal(blast.queued, 1);
  assert.equal(blast.skipped, 1);
  checks += 2;
  const worker = await manager("/api/cron/deliveries", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ smtpConfig }),
  });
  assert.equal(
    worker.status,
    200,
    "Local delivery worker must process the queue.",
  );
  checks++;
  const delivery = await prisma.campaignDelivery.findUnique({
    where: {
      campaignId_recipientId: {
        campaignId: created.id,
        recipientId: optedIn.id,
      },
    },
  });
  assert.equal(delivery.status, "SENT");
  assert.equal(
    await prisma.campaignDelivery.count({
      where: {
        campaignId: created.id,
        recipientId: unknownConsent.id,
      },
    }),
    0,
  );
  checks += 2;
  assert.equal(capturedMail.length, 2);
  assert.ok(capturedMail[1].includes("/api/unsubscribe/"));
  assert.ok(capturedMail[1].includes("List-Unsubscribe-Post"));
  checks += 3;
  const personalizedTracking = await prisma.campaignRecipient.findFirst({
    where: { campaignId: created.id, recipientId: optedIn.id },
  });
  assert.ok(personalizedTracking);
  await expectStatus(
    anon,
    `/api/track/open/${personalizedTracking.trackingToken}`,
    200,
  );
  const savedSegment = await (
    await expectStatus(manager, "/api/segments", 201, "POST", {
      name: `${prefix} opened`,
      campaignId: created.id,
      engagement: "OPENED",
    })
  ).json();
  assert.equal(savedSegment.audienceCount, 1);
  checks++;
  await expectStatus(anon, `/api/unsubscribe/${optedIn.unsubscribeToken}`, 200);
  await expectStatus(
    anon,
    `/api/unsubscribe/${optedIn.unsubscribeToken}`,
    200,
    "POST",
  );
  assert.equal(
    (
      await prisma.recipient.findUnique({
        where: { id: optedIn.id },
        select: { consentStatus: true },
      })
    ).consentStatus,
    "OPTED_OUT",
  );
  checks++;
  assert.equal(
    (await (await manager("/api/segments")).json())[0].audienceCount,
    0,
  );
  checks++;
  for (const path of [
    "/",
    "/campaigns",
    `/campaigns/${created.id}`,
    `/analytics?campaign=${created.id}`,
    "/recipients",
    "/segments",
    "/billing",
    "/settings",
    "/templates",
  ])
    await expectStatus(viewer, path, 200);
  await expectStatus(admin, "/api/admin/invite", 200);
  await expectStatus(admin, "/api/admin/users", 409, "PATCH", {
    id: adminUser.id,
    role: "VIEWER",
    isActive: true,
  });
  await expectStatus(admin, "/api/admin/users", 200, "PATCH", {
    id: managerUser.id,
    role: "VIEWER",
    isActive: true,
  });
  await expectStatus(manager, "/api/campaigns", 401, "POST", {});
  await expectStatus(admin, "/api/admin/users", 200, "PATCH", {
    id: viewerUser.id,
    role: "VIEWER",
    isActive: false,
  });
  await expectStatus(viewer, "/api/recipients", 401);
  // Resetting a password revokes old sessions, including after reactivation.
  const resetPass = crypto.randomBytes(24).toString("hex");
  await expectStatus(admin, "/api/admin/users", 200, "PATCH", {
    id: memberUser.id,
    role: "MEMBER",
    isActive: true,
    password: resetPass,
  });
  await expectStatus(member, "/api/recipients", 401);
  const resetClient = client();
  await login(resetClient, memberUser.email);
  assert.ok(!(await (await resetClient("/api/auth/session")).json()).user);
  checks++;
  await login(resetClient, memberUser.email, resetPass);
  await expectStatus(resetClient, "/api/recipients", 200);
  await expectStatus(resetClient, "/api/account/password", 400, "POST", {
    currentPassword: "wrong",
    password,
  });
  await expectStatus(resetClient, "/api/account/password", 200, "POST", {
    currentPassword: resetPass,
    password,
  });
  await expectStatus(resetClient, "/api/recipients", 401);
  await expectStatus(admin, "/api/admin/users", 200, "PATCH", {
    id: viewerUser.id,
    role: "VIEWER",
    isActive: true,
  });
  await expectStatus(viewer, "/api/recipients", 401);
  const invitedEmail = `${prefix}-invite@example.invalid`;
  emails.push(invitedEmail);
  await expectStatus(admin, "/api/admin/invite", 400, "POST", {
    email: invitedEmail,
    name: "Invite",
    role: "INVALID",
  });
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.invitation.create({
    data: {
      email: invitedEmail,
      name: "Invite",
      role: "CAMPAIGN_MANAGER",
      token: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      invitedById: adminUser.id,
      workspaceId: testWorkspaceId,
    },
  });
  const record = await prisma.invitation.findFirst({
    where: { email: invitedEmail },
  });
  assert.notEqual(record.token, token);
  checks++;
  await expectStatus(anon, "/api/invite/accept", 400, "POST", {
    token,
    name: "Invite",
    password: "short",
  });
  const results = await Promise.all(
    [0, 1].map(() =>
      anon("/api/invite/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name: "Invited", password }),
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 1);
  checks++;
  assert.ok(results.some((r) => [409, 410].includes(r.status)));
  checks++;
  const invited = await prisma.user.findUnique({
    where: { email: invitedEmail },
  });
  ids.push(invited.id);
  assert.equal(invited.role, "CAMPAIGN_MANAGER");
  checks++;
  const revokeEmail = `${prefix}-revoke@example.invalid`;
  emails.push(revokeEmail);
  const revokeToken = crypto.randomBytes(32).toString("hex");
  await prisma.invitation.create({
    data: {
      email: revokeEmail,
      name: "Revoke",
      role: "MEMBER",
      token: crypto.createHash("sha256").update(revokeToken).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 86400000),
      invitedById: adminUser.id,
      workspaceId: testWorkspaceId,
    },
  });
  const revokeInvite = await prisma.invitation.findFirstOrThrow({
    where: { email: revokeEmail },
  });
  await expectStatus(admin, "/api/admin/invite", 200, "DELETE", {
    id: revokeInvite.id,
  });
  await expectStatus(anon, "/api/invite/accept", 410, "POST", {
    token: revokeToken,
    name: "Revoke",
    password,
  });
  // Account throttling persists across sessions and application processes.
  const locked = await makeUser("MEMBER");
  for (let i = 0; i < 10; i++) await login(anon, locked.email, "bad-password");
  await login(anon, locked.email);
  assert.ok(!(await (await anon("/api/auth/session")).json()).user);
  checks++;
  const recoveryPassword = crypto.randomBytes(24).toString("hex");
  execFileSync(process.execPath, ["scripts/reset-admin.mjs"], {
    env: {
      ...process.env,
      ADMIN_RESET_EMAIL: adminUser.email,
      ADMIN_RESET_PASSWORD: recoveryPassword,
    },
    stdio: "pipe",
  });
  await expectStatus(admin, "/api/admin/invite", 401);
  const recovered = client();
  await login(recovered, adminUser.email, recoveryPassword);
  await expectStatus(recovered, "/api/admin/invite", 200);
  console.log(
    `Passed ${checks} authentication, RBAC, invitation, tracking, and page checks.`,
  );
} finally {
  await prisma.trackingEvent.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignLink.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignDelivery.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  await prisma.invitation.deleteMany({ where: { email: { in: emails } } });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: ids } },
        ...emails.map((email) => ({
          action: "LOGIN_FAILED",
          details: {
            path: ["emailHash"],
            equals: crypto.createHash("sha256").update(email).digest("hex"),
          },
        })),
      ],
    },
  });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
  await new Promise((resolve) => smtp.close(resolve));
}
