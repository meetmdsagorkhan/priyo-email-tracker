// Local-only SMTP capture. Never sends email to an external provider.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const database = new URL(process.env.DATABASE_URL || "");
const base = new URL(process.env.TEST_BASE_URL || "http://localhost:3150").origin;
assert.ok(["127.0.0.1", "localhost"].includes(database.hostname) && database.pathname === "/signalpost_ui_test", "Use only the dedicated local test database.");
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname), "Use a local application.");
const db = new PrismaClient();
const prefix = "email-test-" + crypto.randomUUID();
const password = crypto.randomBytes(20).toString("hex");
const smtpPassword = crypto.randomBytes(32).toString("hex");
const smtpUser = "local-sender@example.invalid";
const users = [], workspaces = [], campaigns = [], captured = [];
let failureMode = "", checks = 0;
const triggerName = "email_confirm_" + crypto.randomBytes(8).toString("hex");
let triggerInstalled = false;
function equal(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }
function check(condition, message) { assert.ok(condition, message); checks++; }
const smtp = net.createServer(socket => {
  let buffer = "", message = "", inData = false;
  socket.write("220 localhost Signalpost capture\r\n");
  socket.on("data", chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (inData) {
        if (line === ".") {
          captured.push(message); message = ""; inData = false;
          socket.write("250 2.0.0 accepted locally\r\n");
        } else message += line.replace(/^\.\./, ".") + "\r\n";
      } else if (line.startsWith("EHLO")) socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH PLAIN ")) {
        const decoded = Buffer.from(line.slice(11), "base64").toString().split("\0");
        const valid = decoded.at(-2) === smtpUser && decoded.at(-1) === smtpPassword;
        socket.write(failureMode === "auth" || !valid ? `535 Authentication refused ${smtpPassword}\r\n` : "235 Authenticated\r\n");
      } else if (line.startsWith("RCPT TO") && failureMode === "recipient") socket.write(`550 Recipient rejected ${smtpPassword}\r\n`);
      else if (line === "DATA") { inData = true; socket.write("354 Send data\r\n"); }
      else if (line === "QUIT") socket.end("221 Bye\r\n");
      else socket.write("250 OK\r\n");
    }
  });
});
await new Promise(resolve => smtp.listen(0, "127.0.0.1", resolve));
const config = { host: "127.0.0.1", port: smtp.address().port, secure: false, user: smtpUser, pass: smtpPassword,
  from: "Agency Team <sender@example.invalid>", replyTo: "replies@example.invalid" };
function client() {
  const cookies = new Map();
  return async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (cookies.size) headers.set("cookie", [...cookies].map(([k,v]) => `${k}=${v}`).join("; "));
    const response = await fetch(base + path, { ...options, headers, redirect: "manual" });
    for (const raw of response.headers.getSetCookie()) { const pair = raw.split(";")[0], i = pair.indexOf("="); cookies.set(pair.slice(0,i), pair.slice(i+1)); }
    return response;
  };
}
async function json(request, method, path, body, status = 200) {
  const response = await request(path, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const result = await response.json();
  equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  check(!JSON.stringify(result).includes(smtpPassword), "Never expose SMTP credentials in API results");
  return result;
}
async function login(user) {
  const request = client(); const csrf = await (await request("/api/auth/csrf")).json();
  await request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base },
    body: new URLSearchParams({csrfToken: csrf.csrfToken, email: user.email, password, json: "true", callbackUrl: base}) });
  equal((await (await request("/api/auth/session")).json()).user.email, user.email, "Fixture authenticates"); return request;
}
function decode(raw) { return raw.replace(/=\r\n/g, "").replace(/=([a-f\d]{2})/gi, (_,h) => String.fromCharCode(parseInt(h,16))).replace(/\r\n[ \t]+/g, " "); }
try {
  const hash = await bcrypt.hash(password, 10);
  for (const role of ["ADMIN", "CAMPAIGN_MANAGER", "VIEWER", "ADMIN"]) {
    const user = await db.user.create({data:{email:`${prefix}-${users.length}@example.invalid`,password:hash,role,emailVerifiedAt:new Date()}});users.push(user);
  }
  const workspace = await db.workspace.create({data:{name:prefix,slug:prefix,ownerId:users[0].id,memberships:{create:users.slice(0,3).map(u=>({userId:u.id,role:u.role}))}}});workspaces.push(workspace.id);
  const otherWorkspace = await db.workspace.create({data:{name:prefix+"-other",slug:prefix+"-other",ownerId:users[3].id,memberships:{create:{userId:users[3].id,role:"ADMIN"}}}});workspaces.push(otherWorkspace.id);
  const [admin,manager,viewer,other] = await Promise.all(users.map(login));
  const recipients = await Promise.all(["first","second"].map(name=>db.recipient.create({data:{workspaceId:workspace.id,email:`${prefix}-${name}@example.invalid`,consentStatus:"OPTED_IN"}})));
  async function campaign(workspaceId = workspace.id, creator = users[0].id) {
    const c = await db.campaign.create({data:{workspaceId,createdById:creator,name:"Agency update",subject:"Agency news",type:"PRODUCT_UPDATE",recipientMode:"BULK"}});campaigns.push(c.id);return c;
  }
  const current = await campaign();
  const foreign = await campaign(otherWorkspace.id, users[3].id);
  const settings = "/api/settings/smtp", logs = "/api/email-logs", api = `/api/campaigns/${current.id}`;
  await json(client(),"GET",settings,undefined,401);
  await json(manager,"PUT",settings,config,403);
  await json(viewer,"PUT",settings,config,403);
  await json(admin,"PUT",settings,{...config,replyTo:"reply@example.invalid\r\nBcc: bad@example.invalid"},400);
  await json(admin,"PUT",settings,{...config,from:"one@example.invalid,two@example.invalid"},400);
  await json(admin,"PUT",settings,{...config,port:0},400);
  await json(admin,"PUT",settings,{...config,pass:undefined},400);
  await json(admin,"PUT",settings,config);
  const stored = await db.workspaceSmtpSettings.findUniqueOrThrow({where:{workspaceId:workspace.id}});
  check(stored.encryptedPassword.startsWith("v1."),"Versioned encrypted storage");
  check(!stored.encryptedPassword.includes(smtpPassword),"Password is encrypted at rest");
  const publicSettings = await json(admin,"GET",settings);
  equal(publicSettings.hasPassword,true,"Password existence is exposed without its value");
  equal(publicSettings.source,"WORKSPACE","Saved configuration selected");
  check(!("encryptedPassword" in publicSettings) && !("pass" in publicSettings),"No secret fields in settings API");
  const managerSettings = await json(manager,"GET",settings);
  equal(managerSettings.canEdit,false,"Manager cannot edit credential configuration");
  equal(managerSettings.from,config.from,"Managers can see sending identity");
  check(!("user" in managerSettings),"Non-admin metadata excludes SMTP username");
  equal((await json(other,"GET",settings)).source === "WORKSPACE",false,"Other workspace cannot reuse these saved settings");
  await json(admin,"PUT",settings,{...config,pass:undefined,replyTo:"updated-replies@example.invalid"});
  equal((await db.workspaceSmtpSettings.findUniqueOrThrow({where:{workspaceId:workspace.id}})).encryptedPassword,stored.encryptedPassword,"Blank password retains encrypted secret");
  await json(admin,"PUT",settings,{...config,pass:undefined,host:"smtp.example.invalid"},400);
  const htmlContent='<html><body><h1>Agency update</h1><a href="https://example.invalid/news">Read news</a></body></html>';
  await json(viewer,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent},403);
  await json(other,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent},404);
  await json(manager,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent});
  equal(captured.length,1,"Saved SMTP reused without credentials in send request");
  const mail = decode(captured[0]);
  check(mail.includes("From: Agency Team <sender@example.invalid>"),"Saved From address on the wire");
  check(mail.includes("Reply-To: updated-replies@example.invalid"),"Default Reply-To on the wire");
  check(mail.includes("/api/track/open/"),"Saved SMTP test retains tracking");
  let list = await json(viewer,"GET",logs);
  equal(list.items.length,1,"Read-only user can inspect sending history");
  equal(list.items[0].status,"SENT","Test acceptance logged");
  equal(list.items[0].attempts,1,"Attempt count is recorded");
  check(Boolean(list.items[0].messageId && list.items[0].sentAt),"SMTP message ID and acceptance timestamp logged");
  await json(manager,"POST",api+"/send-test",{toEmail:recipients[1].email,htmlContent,replyTo:"override@example.invalid"});
  check(decode(captured[1]).includes("Reply-To: override@example.invalid"),"Per-send Reply-To overrides saved default");
  await json(admin,"PUT",settings,{...config,pass:undefined,replyTo:""});
  equal((await json(admin,"GET",settings)).replyTo,"","Clearing workspace Reply-To does not inherit a server default");
  await json(manager,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent});
  check(!decode(captured.at(-1)).includes("Reply-To:"),"Empty saved Reply-To uses From address");
  const before = captured.length;
  await json(admin,"POST",api+"/send-blast",{htmlContent,recipients:recipients.map(r=>({email:r.email})),replyTo:"campaign-replies@example.invalid"},202);
  equal(captured.length,before,"Admission queues without sending inside transaction");
  list = await json(admin,"GET",logs+"?kind=CAMPAIGN&status=QUEUED");
  equal(list.items.length,2,"Each queued recipient has a log before processing");
  equal(list.items.every(log=>log.attempts===0),true,"Queued messages do not claim SMTP attempts");
  const batch = await json(admin,"POST",api+"/process-batch",{batchSize:10});
  equal(batch.sent,2,"Background/batch worker reuses workspace credentials");
  equal(captured.length,before+2,"One separate email per recipient");
  const campaignMails=captured.slice(before).map(decode);
  check(campaignMails.every(mail=>mail.includes("Reply-To: campaign-replies@example.invalid")),"Campaign Reply-To persisted for worker");
  const tokens=campaignMails.map(mail=>mail.match(/\/api\/track\/open\/([a-zA-Z\d_-]+)/)?.[1]);
  check(tokens.every(Boolean) && new Set(tokens).size===2,"Each campaign recipient has unique tracking");
  list=await json(admin,"GET",logs+`?kind=CAMPAIGN&status=SENT&campaignId=${current.id}`);
  equal(list.items.length,2,"Campaign logs show actual SMTP acceptance");
  equal(list.counts.SENT,2,"Counts use campaign filters");
  check(list.items.every(log=>log.fromAddress===config.from && log.replyTo==="campaign-replies@example.invalid"),"Header identities retained in logs");
  await db.emailLog.updateMany({where:{campaignId:current.id,kind:"CAMPAIGN"},data:{status:"QUEUED"}});
  equal((await json(admin,"GET",logs+"?kind=CAMPAIGN&status=SENT")).items.length,2,"Authoritative delivery state overrides stale cached log state");
  equal((await json(admin,"GET",logs+"?kind=CAMPAIGN&status=QUEUED")).items.length,0,"Filters use authoritative state too");
  const foreignLog=await db.emailLog.create({data:{workspaceId:otherWorkspace.id,campaignId:foreign.id,kind:"TEST",toEmail:"private@example.invalid",subject:"Private",status:"SENT"}});
  equal((await json(admin,"GET",logs+`?campaignId=${foreign.id}`)).items.length,0,"Foreign campaign logs remain hidden");
  await json(admin,"GET",logs+`?cursor=${foreignLog.id}`,undefined,404);
  failureMode="auth";
  await json(manager,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent},502);
  let failed=await json(admin,"GET",logs+"?kind=TEST&status=FAILED");
  equal(failed.items.length,1,"Failed tests remain in history");
  check(failed.items[0].lastError.startsWith("SMTP authentication failed"),"Actionable sanitized auth failure");
  failureMode="recipient";
  await json(manager,"POST",api+"/send-test",{toEmail:recipients[0].email,htmlContent},502);
  failed=await json(admin,"GET",logs+"?kind=TEST&status=FAILED");
  equal(failed.items.length,2,"SMTP recipient rejection is not reported as success");
  const retryCampaign = await campaign();
  const retryApi = `/api/campaigns/${retryCampaign.id}`;
  failureMode="auth";
  await json(admin,"POST",retryApi+"/send-blast",{htmlContent,recipients:[{email:recipients[0].email}]},202);
  const failedBatch=await json(admin,"POST",retryApi+"/process-batch",{batchSize:1});
  equal(failedBatch.retrying,1,"Campaign SMTP failure schedules a retry");
  const retryLog=(await json(admin,"GET",logs+`?campaignId=${retryCampaign.id}`)).items[0];
  equal(retryLog.status,"FAILED","Campaign failure visible in logs");
  equal(retryLog.attempts,1,"First failed delivery attempt counted");
  await db.campaignDelivery.updateMany({where:{campaignId:retryCampaign.id},data:{nextAttemptAt:new Date(Date.now()-1000)}});
  failureMode="";
  await json(admin,"POST",retryApi+"/process-batch",{batchSize:1});
  const recovered=(await json(admin,"GET",logs+`?campaignId=${retryCampaign.id}`)).items;
  equal(recovered.length,1,"Retries reuse the same logical email log");
  equal(recovered[0].status,"SENT","Successful retry updates log acceptance");
  equal(recovered[0].attempts,2,"All delivery attempts counted");
  // Inject a confirmation-write failure after local SMTP acceptance. The
  // email must be held as uncertain, not automatically queued for duplication.
  const uncertainCampaign=await campaign();
  const uncertainApi=`/api/campaigns/${uncertainCampaign.id}`;
  await json(admin,"POST",uncertainApi+"/send-blast",{htmlContent,recipients:[{email:recipients[0].email}]},202);
  const safeCampaignId=uncertainCampaign.id.replaceAll("'", "''");
  await db.$executeRawUnsafe(`CREATE FUNCTION "${triggerName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."campaignId" = '${safeCampaignId}' AND NEW."status" = 'SENT' THEN RAISE EXCEPTION 'Local injected confirmation failure'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "${triggerName}" BEFORE UPDATE ON "EmailLog" FOR EACH ROW EXECUTE FUNCTION "${triggerName}"()`);
  triggerInstalled=true;
  const uncertain=await json(admin,"POST",uncertainApi+"/process-batch",{batchSize:1});
  equal(uncertain.failed,1,"Confirmation failure is surfaced as terminal/held");
  const uncertainLog=(await json(admin,"GET",logs+`?campaignId=${uncertainCampaign.id}`)).items[0];
  check(uncertainLog.lastError.startsWith("SMTP accepted the email, but saving its confirmation failed"),"Known acceptance ambiguity is explained");
  equal(uncertainLog.nextAttemptAt,null,"Known accepted message is not automatically retried");
  equal((await db.campaignDelivery.findFirst({where:{campaignId:uncertainCampaign.id}})).nextAttemptAt,null,"Worker queue also holds uncertain message");
  await db.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "EmailLog"`);
  await db.$executeRawUnsafe(`DROP FUNCTION "${triggerName}"()`);
  triggerInstalled=false;
  const capturedBeforeForeignTest=captured.length;
  await db.workspaceSmtpSettings.create({data:{...stored,workspaceId:otherWorkspace.id}});
  await json(other,"POST",`/api/campaigns/${foreign.id}/send-test`,{toEmail:"foreign@example.invalid",htmlContent},503);
  equal(captured.length,capturedBeforeForeignTest,"Ciphertext cannot be reused in another workspace");
  await db.emailLog.createMany({data:Array.from({length:53},(_,i)=>({workspaceId:workspace.id,kind:"TEST",toEmail:`page-${i}@example.invalid`,subject:"Paging fixture",status:"FAILED",lastError:`raw sensitive provider output ${smtpPassword}`}))});
  const first=await json(admin,"GET",logs+"?search=Paging%20fixture");
  const second=await json(admin,"GET",logs+`?search=Paging%20fixture&cursor=${first.nextCursor}`);
  equal(first.items.length,50,"Log pagination is bounded");equal(second.items.length,3,"Next page accessible");
  equal(new Set([...first.items,...second.items].map(log=>log.id)).size,53,"Stable pagination without duplicates");
  equal(first.total,53,"Filtered total count");
  check(first.items.every(log=>!log.lastError.includes(smtpPassword)),"Raw historical/provider error text is withheld");
  await json(admin,"GET",logs+"?status=INVALID",undefined,400);
  await json(manager,"DELETE",settings,undefined,403);
  await json(admin,"DELETE",settings);
  equal((await json(admin,"GET",settings)).source === "WORKSPACE",false,"Removing workspace configuration restores server defaults");
  equal(await db.emailLog.count({where:{workspaceId:workspace.id}}),62,"Removing SMTP preserves email history");
  console.log(`Passed ${checks} saved SMTP, encryption, Reply-To, per-recipient delivery, logging, failure, filtering, permission, and isolation checks. SMTP capture was local only.`);
} finally {
  if (triggerInstalled) { await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "EmailLog"`); await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${triggerName}"()`); }
  await db.trackingEvent.deleteMany({where:{campaignId:{in:campaigns}}});
  await db.campaignDelivery.deleteMany({where:{campaignId:{in:campaigns}}});
  await db.campaignLink.deleteMany({where:{campaignId:{in:campaigns}}});
  await db.campaignRecipient.deleteMany({where:{campaignId:{in:campaigns}}});
  await db.campaign.deleteMany({where:{id:{in:campaigns}}});
  await db.workspace.deleteMany({where:{id:{in:workspaces}}});
  await db.auditLog.deleteMany({where:{workspaceId:{in:workspaces}}});
  await db.user.deleteMany({where:{id:{in:users.map(u=>u.id)}}});
  await db.$disconnect();await new Promise(resolve=>smtp.close(resolve));
}
