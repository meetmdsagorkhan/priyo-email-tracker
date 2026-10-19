// Rehearse the migration against an isolated local DB with historical deliveries.
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/signalpost_email_migration_test", "Use only the dedicated local migration database.");
const db = new PrismaClient({ datasourceUrl: url.toString() });
const latest = "20261019000000_saved_smtp_and_email_logs";
const root = resolve(".");
const temp = mkdtempSync(join(tmpdir(), "signalpost-email-migration-"));
let checks = 0;
function equal(a,b,message) { assert.deepEqual(a,b,message);checks++; }
function migrate(schema) {
  const result=spawnSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","deploy","--schema",schema],{env:{...process.env,DATABASE_URL:url.toString()},encoding:"utf8"});
  assert.equal(result.status,0,"Local migration failed: "+result.stdout+result.stderr);
}
try {
  const existing=await db.$queryRaw`SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'`;
  equal(existing[0].count,0,"Migration rehearsal requires a fresh empty database");
  cpSync(join(root,"prisma"),temp,{recursive:true});
  rmSync(join(temp,"migrations",latest),{recursive:true});
  // Replay the checked-in previous release, not a guessed schema.
  const baseline=spawnSync("git",["show","HEAD:prisma/schema.prisma"],{encoding:"utf8"});
  assert.equal(baseline.status,0);writeFileSync(join(temp,"schema.prisma"),baseline.stdout);
  migrate(join(temp,"schema.prisma"));
  const user=await db.user.create({data:{id:"migration-user",email:"migration@example.invalid",password:"fixture-not-for-login",role:"ADMIN"}});
  const workspace=await db.workspace.create({data:{id:"migration-workspace",slug:"migration-workspace",name:"Historical workspace",ownerId:user.id}});
  const recipient=await db.recipient.create({data:{id:"migration-recipient",workspaceId:workspace.id,email:"old-recipient@example.invalid",consentStatus:"OPTED_IN"}});
  const campaign=await db.campaign.create({data:{id:"migration-campaign",workspaceId:workspace.id,createdById:user.id,name:"Historical campaign",subject:"Historical subject",type:"OTHER",recipientMode:"BULK"},select:{id:true}});
  const mapping=await db.campaignRecipient.create({data:{id:"migration-mapping",campaignId:campaign.id,recipientId:recipient.id,trackingToken:"historical-unique-token"}});
  const oldTime=new Date("2026-10-01T12:00:00Z");
  await db.campaignDelivery.create({data:{id:"migration-delivery",workspaceId:workspace.id,campaignId:campaign.id,recipientId:recipient.id,campaignRecipientId:mapping.id,status:"SENT",attempts:1,queuedAt:oldTime,sentAt:oldTime,providerMessageId:"old-message-id"}});
  const migrationSql=readFileSync(join(root,"prisma/migrations",latest,"migration.sql"),"utf8");
  assert.ok(migrationSql.startsWith("BEGIN;") && migrationSql.trim().endsWith("COMMIT;"));checks++;
  migrate(join(root,"prisma/schema.prisma"));
  const log=await db.emailLog.findUniqueOrThrow({where:{deliveryId:"migration-delivery"}});
  equal(log.toEmail,"old-recipient@example.invalid","Recipient history backfilled");
  equal(log.subject,"Historical subject","Subject preserved");
  equal(log.status,"SENT","Historical acceptance retained");
  equal(log.messageId,"old-message-id","Provider reference retained");
  equal(log.queuedAt.toISOString(),oldTime.toISOString(),"Original queue timestamp retained");
  equal(log.sentAt.toISOString(),oldTime.toISOString(),"Original SMTP acceptance retained");
  equal(await db.campaignDelivery.count(),1,"Existing deliveries not changed");
  equal(await db.campaignRecipient.count(),1,"Tracking token mapping preserved");
  equal(await db.workspaceSmtpSettings.count(),0,"No credentials invented during migration");
  equal(log.replyTo,null,"Historical emails do not invent a Reply-To header");
  migrate(join(root,"prisma/schema.prisma"));
  equal(await db.emailLog.count(),1,"Repeated migrate deploy does not duplicate historical logs");
  console.log(`Passed ${checks} migration preservation and repeat-deploy checks.`);
} finally {
  rmSync(temp,{recursive:true,force:true});await db.$disconnect();
}
