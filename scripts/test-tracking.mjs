// End-to-end regression: local SMTP capture, manual exports, and durable attribution.
// Never run this against the production database or an external application.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import * as cheerio from "cheerio";

const base = new URL(process.env.TEST_BASE_URL || "http://localhost:3140")
  .origin;
const trackingOrigin = new URL(
  process.env.TEST_TRACKING_ORIGIN || "https://tracking.example.invalid",
).origin;
const database = new URL(process.env.DATABASE_URL || "");
assert.ok(
  ["127.0.0.1", "localhost"].includes(database.hostname),
  "A local database is required.",
);
assert.ok(
  ["/signalpost_tracking_test", "/signalpost_ui_test"].includes(
    database.pathname,
  ),
  "Use a dedicated Signalpost test database.",
);
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "A local application is required.",
);
assert.ok(
  ["tracking.example.invalid", "127.0.0.1", "localhost"].includes(
    new URL(trackingOrigin).hostname,
  ),
  "Use only the reserved test tracking origin or a loopback address.",
);
assert.ok(
  process.env.CRON_SECRET,
  "Set the same local CRON_SECRET in the app and regression process.",
);
const prisma = new PrismaClient();
const prefix = `tracking-test-${crypto.randomUUID()}`;
const password = crypto.randomBytes(24).toString("hex");
const workspaceIds = [];
const campaignIds = [];
const userIds = [];
const captured = [];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const equal = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks++;
};

const smtp = net.createServer((socket) => {
  let buffer = "",
    inData = false,
    message = "";
  socket.write("220 localhost Signalpost tracking test\r\n");
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (inData) {
        if (line === ".") {
          captured.push(message);
          message = "";
          inData = false;
          socket.write("250 Accepted\r\n");
        } else message += line.replace(/^\.\./, ".") + "\r\n";
      } else if (line.startsWith("EHLO"))
        socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH")) socket.write("235 Authenticated\r\n");
      else if (line === "DATA") {
        inData = true;
        socket.write("354 Send data\r\n");
      } else if (line === "QUIT") socket.end("221 Bye\r\n");
      else socket.write("250 OK\r\n");
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
  from: "tracking@example.invalid",
};
function decodedMail(raw) {
  return raw
    .replace(/=\r\n/g, "")
    .replace(/=([a-f\d]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}
function trackingUrls(html) {
  const $ = cheerio.load(html);
  return {
    pixels: $("img")
      .toArray()
      .map((node) => $(node).attr("src"))
      .filter((src) => src?.includes("/api/track/open/")),
    clicks: $("a")
      .toArray()
      .map((node) => $(node).attr("href"))
      .filter((href) => href?.includes("/api/track/click/")),
  };
}
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
      const pair = raw.split(";")[0],
        separator = pair.indexOf("=");
      cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  };
}
async function requestJson(request, path, status, body, method = "POST") {
  const response = await request(path, {
    method,
    ...(body !== undefined
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  equal(
    response.status,
    status,
    `${method} ${path}: ${await response.clone().text()}`,
  );
  return response;
}
async function visit(url, status) {
  const target = new URL(url);
  equal(
    target.origin,
    trackingOrigin,
    "Generated tracking must use the current configured origin.",
  );
  // A production build requires public tracking URLs. Route their paths to the
  // isolated local server without resolving or contacting any external host.
  const response = await fetch(base + target.pathname + target.search, {
    redirect: "manual",
    headers: { "user-agent": "Signalpost Local Regression/1.0" },
  });
  equal(response.status, status);
  return response;
}
async function makeCampaign(
  workspaceId,
  userId,
  mode = "SELECTED",
  flags = {},
) {
  const campaign = await prisma.campaign.create({
    data: {
      name: prefix,
      type: "PRODUCT_UPDATE",
      recipientMode: mode,
      workspaceId,
      createdById: userId,
      ...flags,
    },
  });
  campaignIds.push(campaign.id);
  return campaign;
}

try {
  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: `${prefix}@example.invalid`,
      password: hash,
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  userIds.push(user.id);
  const workspace = await prisma.workspace.create({
    data: { name: prefix, slug: prefix, ownerId: user.id },
  });
  workspaceIds.push(workspace.id);
  await prisma.workspaceMembership.create({
    data: { userId: user.id, workspaceId: workspace.id, role: "ADMIN" },
  });
  const otherWorkspace = await prisma.workspace.create({
    data: {
      name: `${prefix}-other`,
      slug: `${prefix}-other`,
      ownerId: user.id,
    },
  });
  workspaceIds.push(otherWorkspace.id);
  const [recipient, second, unknown, optedOut, suppressed, foreign] =
    await Promise.all(
      [
        ["first", "OPTED_IN", workspace.id],
        ["second", "OPTED_IN", workspace.id],
        ["unknown", "UNKNOWN", workspace.id],
        ["out", "OPTED_OUT", workspace.id],
        ["suppressed", "OPTED_IN", workspace.id],
        ["foreign", "OPTED_IN", otherWorkspace.id],
      ].map(([name, consentStatus, workspaceId]) =>
        prisma.recipient.create({
          data: {
            email: `${prefix}-${name}@example.invalid`,
            firstName: name,
            workspaceId,
            consentStatus,
            ...(consentStatus === "OPTED_IN"
              ? { consentedAt: new Date(), consentSource: "LOCAL_REGRESSION" }
              : {}),
          },
        }),
      ),
    );
  await prisma.suppression.create({
    data: {
      workspaceId: workspace.id,
      email: suppressed.email,
      reason: "LOCAL_REGRESSION",
    },
  });

  const signedIn = client();
  const csrf = await (await signedIn("/api/auth/csrf")).json();
  await signedIn("/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: base,
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: user.email,
      password,
      json: "true",
      callbackUrl: base,
    }),
  });
  equal(
    (await (await signedIn("/api/auth/session")).json()).user?.email,
    user.email,
    "The local fixture must authenticate.",
  );

  const rawHtml =
    '<html><body><h1>Product news</h1><!-- /api/track/ is not proof of instrumentation --><a href="https://example.invalid/product">Read the update</a><a href="mailto:hello@example.invalid">Contact</a></body></html>';
  const manual = await makeCampaign(workspace.id, user.id);
  const api = `/api/campaigns/${manual.id}`;
  const generated = await (
    await requestJson(signedIn, api + "/generate-html", 200, {
      htmlContent: rawHtml,
    })
  ).json();
  equal(trackingUrls(generated.processedHtml).pixels.length, 1);
  check(
    generated.processedHtml.includes("{{SIGNALPOST_TRACKING_TOKEN}}"),
    "Selected templates must retain the documented merge placeholder.",
  );
  const oldHostHtml = generated.processedHtml.replaceAll(
    trackingOrigin,
    "https://retired.example.invalid",
  );
  const regenerated = await (
    await requestJson(signedIn, api + "/generate-html", 200, {
      htmlContent: oldHostHtml,
    })
  ).json();
  const again = await (
    await requestJson(signedIn, api + "/generate-html", 200, {
      htmlContent: regenerated.processedHtml,
    })
  ).json();
  equal(
    trackingUrls(again.processedHtml).pixels.length,
    1,
    "Repeated generation must not duplicate open pixels.",
  );
  equal(
    await prisma.campaignLink.count({ where: { campaignId: manual.id } }),
    1,
    "Repeated generation must not wrap tracking redirects inside new links.",
  );
  check(
    !again.processedHtml.includes("retired.example.invalid"),
    "Old tracking domains must be replaced.",
  );

  await requestJson(client(), api + "/recipient-html", 401, {
    recipientId: recipient.id,
    htmlContent: rawHtml,
  });
  await requestJson(signedIn, api + "/recipient-html", 404, {
    recipientId: foreign.id,
    htmlContent: rawHtml,
  });
  for (const excluded of [unknown, optedOut, suppressed]) {
    const response = await signedIn(api + "/recipient-html", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientId: excluded.id, htmlContent: rawHtml }),
    });
    check(
      [400, 409, 422].includes(response.status),
      "Recipient HTML must enforce opt-in and suppressions.",
    );
  }
  const personalized = await (
    await requestJson(signedIn, api + "/recipient-html", 200, {
      recipientId: recipient.id,
      htmlContent: oldHostHtml,
    })
  ).json();
  equal(personalized.trackingMode, "RECIPIENT");
  equal(personalized.recipient.email, recipient.email);
  const urls = trackingUrls(personalized.html);
  equal(urls.pixels.length, 1);
  equal(urls.clicks.length, 1);
  check(
    !personalized.html.includes("TRACKING_TOKEN}}"),
    "Manual exports must contain a real persisted token, not a placeholder.",
  );
  check(
    personalized.html.includes(
      `/api/unsubscribe/${recipient.unsubscribeToken}`,
    ),
    "Personalized manual HTML must retain an unsubscribe option.",
  );
  const token = new URL(urls.pixels[0]).pathname.split("/").at(-1);
  const mapping = await prisma.campaignRecipient.findUnique({
    where: { trackingToken: token },
  });
  equal(
    mapping?.recipientId,
    recipient.id,
    "Exported HTML must persist the recipient-token mapping.",
  );
  await visit(urls.pixels[0], 200);
  const click = await visit(urls.clicks[0], 302);
  equal(click.headers.get("location"), "https://example.invalid/product");
  equal(
    await prisma.trackingEvent.count({
      where: { campaignRecipientId: mapping.id, eventType: "OPEN" },
    }),
    1,
  );
  equal(
    await prisma.trackingEvent.count({
      where: { campaignRecipientId: mapping.id, eventType: "CLICK" },
    }),
    1,
  );
  const activity = await (
    await requestJson(
      signedIn,
      api + "/analytics/recipients",
      200,
      undefined,
      "GET",
    )
  ).json();
  const activityRow = activity.recipients.find(
    (item) => item.email === recipient.email,
  );
  check(
    activityRow?.openedAt && activityRow?.clickedAt,
    "Manually exported recipient engagement must appear without an SMTP delivery record.",
  );
  equal(
    activityRow.deliveryStatus,
    "EXTERNAL",
    "Manual exports must not invent a provider delivery result.",
  );
  equal(activityRow.sentAt, null);

  const secondHtml = await (
    await requestJson(signedIn, api + "/recipient-html", 200, {
      recipientId: second.id,
      htmlContent: personalized.html,
    })
  ).json();
  const secondUrls = trackingUrls(secondHtml.html);
  equal(
    secondUrls.clicks.length,
    1,
    "Unsubscribe links must stay direct and must not count as engagement.",
  );
  check(
    secondHtml.html.includes(`/api/unsubscribe/${second.unsubscribeToken}`) &&
      !secondHtml.html.includes(
        `/api/unsubscribe/${recipient.unsubscribeToken}`,
      ),
    "Re-personalization must replace another recipient's unsubscribe link.",
  );
  check(
    secondUrls.pixels[0] !== urls.pixels[0],
    "Copying personalized HTML to another selected recipient must replace identity.",
  );
  const secondMapping = await prisma.campaignRecipient.findUnique({
    where: {
      trackingToken: new URL(secondUrls.pixels[0]).pathname.split("/").at(-1),
    },
  });
  equal(secondMapping?.recipientId, second.id);
  const csv = await (
    await requestJson(
      signedIn,
      api + "/export-admin-csv",
      200,
      undefined,
      "GET",
    )
  ).text();
  check(
    csv.includes(recipient.email) && csv.includes(second.email),
    "CSV must contain eligible campaign recipients.",
  );
  check(
    !csv.includes(unknown.email) &&
      !csv.includes(optedOut.email) &&
      !csv.includes(suppressed.email) &&
      !csv.includes(foreign.email),
    "CSV must not export ineligible or foreign recipients.",
  );

  const testResult = await (
    await requestJson(signedIn, api + "/send-test", 200, {
      toEmail: recipient.email,
      htmlContent: secondHtml.html,
      smtpConfig,
    })
  ).json();
  equal(testResult.trackingMode, "RECIPIENT");
  const testMail = decodedMail(captured.at(-1));
  const testUrls = trackingUrls(testMail);
  check(
    testMail.includes(`/api/unsubscribe/${recipient.unsubscribeToken}`) &&
      !testMail.includes(`/api/unsubscribe/${second.unsubscribeToken}`),
    "A test must not inherit a different recipient's unsubscribe identity.",
  );
  equal(testUrls.pixels.length, 1);
  equal(new URL(testUrls.pixels[0]).searchParams.get("test"), "1");
  equal(new URL(testUrls.clicks[0]).searchParams.get("test"), "1");
  await visit(testUrls.pixels[0], 200);
  await visit(testUrls.clicks[0], 302);
  equal(
    await prisma.trackingEvent.count({
      where: {
        campaignRecipientId: mapping.id,
        metadata: { path: ["is_test"], equals: true },
      },
    }),
    2,
    "Test events must be labeled and separated from campaign results.",
  );
  const afterTest = await (
    await requestJson(
      signedIn,
      api + "/analytics/recipients",
      200,
      undefined,
      "GET",
    )
  ).json();
  const afterTestRow = afterTest.recipients.find(
    (item) => item.email === recipient.email,
  );
  equal(
    afterTestRow.openedAt,
    activityRow.openedAt,
    "Test events must not overwrite production engagement timestamps.",
  );
  check(
    afterTestRow.testOpenedAt && afterTestRow.testClickedAt,
    "Recipient activity must expose test confirmation separately.",
  );
  const priorRecipients = await prisma.recipient.count({
    where: { workspaceId: workspace.id },
  });
  const anonymous = await (
    await requestJson(signedIn, api + "/send-test", 200, {
      toEmail: `${prefix}-external@example.invalid`,
      htmlContent: personalized.html,
      smtpConfig,
    })
  ).json();
  equal(anonymous.trackingMode, "ANONYMOUS_TEST");
  const anonymousUrls = trackingUrls(decodedMail(captured.at(-1)));
  check(
    !decodedMail(captured.at(-1)).includes(
      `/api/unsubscribe/${recipient.unsubscribeToken}`,
    ),
    "An anonymous test must not expose a real audience member's unsubscribe action.",
  );
  const anonymousMapping = await prisma.campaignRecipient.findUnique({
    where: {
      trackingToken: new URL(anonymousUrls.pixels[0]).pathname
        .split("/")
        .at(-1),
    },
  });
  equal(anonymousMapping?.recipientId, null);
  equal(
    await prisma.recipient.count({ where: { workspaceId: workspace.id } }),
    priorRecipients,
    "Sending a test must not create audience members or consent.",
  );
  await visit(anonymousUrls.pixels[0], 200);
  const unknownTest = await (
    await requestJson(signedIn, api + "/send-test", 200, {
      toEmail: unknown.email,
      htmlContent: rawHtml,
      smtpConfig,
    })
  ).json();
  equal(unknownTest.trackingMode, "ANONYMOUS_TEST");
  equal(
    (await prisma.recipient.findUnique({ where: { id: unknown.id } }))
      .consentStatus,
    "UNKNOWN",
    "A test must not silently grant audience consent.",
  );
  for (const excluded of [optedOut, suppressed])
    await requestJson(signedIn, api + "/send-test", 400, {
      toEmail: excluded.email,
      htmlContent: rawHtml,
      smtpConfig,
    });

  const bulk = await makeCampaign(workspace.id, user.id, "BULK");
  const bulkHtml = await (
    await requestJson(
      signedIn,
      `/api/campaigns/${bulk.id}/generate-html`,
      200,
      { htmlContent: rawHtml },
    )
  ).json();
  const bulkToken = new URL(
    trackingUrls(bulkHtml.processedHtml).pixels[0],
  ).pathname
    .split("/")
    .at(-1);
  equal(
    (
      await prisma.campaignRecipient.findUnique({
        where: { trackingToken: bulkToken },
      })
    )?.recipientId,
    null,
    "Shared bulk exports must remain anonymous; directory membership alone cannot identify an opener.",
  );

  const queued = await makeCampaign(workspace.id, user.id, "BULK");
  const queuedApi = `/api/campaigns/${queued.id}`;
  const queueTemplate = await (
    await requestJson(signedIn, queuedApi + "/generate-html", 200, {
      htmlContent: rawHtml,
    })
  ).json();
  const stale = cheerio.load(
    queueTemplate.processedHtml.replaceAll(
      trackingOrigin,
      "https://retired.example.invalid",
    ),
  );
  stale("body").append(
    `<a href="${trackingOrigin}/api/unsubscribe/${recipient.unsubscribeToken}">Unsubscribe</a>`,
  );
  stale("a[href],img[src]").each((_, node) => {
    const attribute = node.tagName === "a" ? "href" : "src";
    const value = stale(node).attr(attribute);
    if (value?.includes("/api/track/")) {
      const url = new URL(value);
      url.searchParams.set("test", "1");
      stale(node).attr(attribute, url.toString());
    }
  });
  const send = await (
    await requestJson(signedIn, queuedApi + "/send-blast", 202, {
      htmlContent: stale.html(),
      recipients: [
        { email: recipient.email },
        { email: second.email },
        { email: unknown.email },
        { email: suppressed.email },
      ],
    })
  ).json();
  equal(send.queued, 2);
  equal(send.skipped, 2);
  await requestJson(signedIn, queuedApi + "/generate-html", 409, {
    htmlContent: rawHtml,
  });
  equal(
    (await prisma.campaign.findUnique({ where: { id: queued.id } })).status,
    "ACTIVE",
    "Generating HTML must not reset the active send lock.",
  );
  const beforeWorker = captured.length;
  const worker = await signedIn("/api/cron/deliveries", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ smtpConfig }),
  });
  equal(worker.status, 200);
  equal(
    captured.length - beforeWorker,
    2,
    "Both eligible queued emails must reach local SMTP.",
  );
  const deliveries = await prisma.campaignDelivery.findMany({
    where: { campaignId: queued.id },
    include: { campaignRecipient: true, recipient: true },
  });
  equal(deliveries.length, 2);
  const deliveredTokens = new Set();
  for (const mail of captured.slice(beforeWorker)) {
    const html = decodedMail(mail),
      mailUrls = trackingUrls(html);
    equal(mailUrls.pixels.length, 1);
    check(
      !html.includes("retired.example.invalid") &&
        !html.includes("TRACKING_TOKEN}}"),
      "Delivery must refresh old hostnames and replace placeholders.",
    );
    const pixelToken = new URL(mailUrls.pixels[0]).pathname.split("/").at(-1);
    equal(new URL(mailUrls.clicks[0]).searchParams.get("t"), pixelToken);
    equal(
      new URL(mailUrls.pixels[0]).searchParams.get("test"),
      null,
      "Production sends must clear a stale test marker.",
    );
    check(
      deliveries.some(
        (delivery) =>
          delivery.campaignRecipient.trackingToken === pixelToken &&
          delivery.status === "SENT",
      ),
    );
    const delivered = deliveries.find(
      (delivery) => delivery.campaignRecipient.trackingToken === pixelToken,
    );
    const parsed = cheerio.load(html);
    const unsubscribeTokens = parsed("a[href]")
      .toArray()
      .map((node) => parsed(node).attr("href"))
      .filter((href) => href?.includes("/api/unsubscribe/"))
      .map((href) => new URL(href).pathname.split("/").at(-1));
    equal(
      [...new Set(unsubscribeTokens)],
      [delivered.recipient.unsubscribeToken],
      "Every unsubscribe action in a queued message must belong to its recipient.",
    );
    check(
      html.includes("/api/unsubscribe/") &&
        mail.includes("List-Unsubscribe-Post"),
    );
    deliveredTokens.add(pixelToken);
    await visit(mailUrls.pixels[0], 200);
  }
  equal(
    deliveredTokens.size,
    2,
    "Each queued recipient must receive an independent token, including BULK campaigns.",
  );

  const disabled = await makeCampaign(workspace.id, user.id, "SELECTED", {
    openTracking: false,
    clickTracking: false,
  });
  const disabledLink = await prisma.campaignLink.create({
    data: {
      campaignId: disabled.id,
      originalUrl: "https://example.invalid/product",
      trackingToken: crypto.randomBytes(16).toString("hex"),
    },
  });
  const disabledHtml = `<a href="${base}/api/track/click/${disabledLink.trackingToken}?t=old">Read</a><img src="${base}/api/track/open/old">`;
  const disabledExport = await (
    await requestJson(
      signedIn,
      `/api/campaigns/${disabled.id}/recipient-html`,
      200,
      { recipientId: recipient.id, htmlContent: disabledHtml },
    )
  ).json();
  equal(
    trackingUrls(disabledExport.html),
    { pixels: [], clicks: [] },
    "Tracking opt-out flags must also remove previously instrumented links and pixels.",
  );
  check(disabledExport.html.includes('href="https://example.invalid/product"'));
  console.log(
    `Passed ${checks} recipient attribution, manual export, SMTP, consent, isolation, and tracking checks.`,
  );
} finally {
  // Delete only this run's random-prefix fixtures; the database is dedicated local.
  await prisma.trackingEvent.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignDelivery.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignLink.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignRecipient.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
  await new Promise((resolve) => smtp.close(resolve));
}
