import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { emailStorageNeedsMigration, EMAIL_MIGRATION_MESSAGE, encryptSmtpPassword, SmtpSettingsError, validateSmtpConfig } from "@/lib/smtp-settings";

export async function GET() {
  const access = await requireApiUser("read");
  if (access.response) return access.response;
  try {
    const setting = await prisma.workspaceSmtpSettings.findUnique({ where: { workspaceId: access.user.workspaceId } });
    const admin = access.user.role === "ADMIN";
    const serverConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    return NextResponse.json({
      configured: Boolean(setting) || serverConfigured, source: setting ? "WORKSPACE" : serverConfigured ? "SERVER" : "NONE", canEdit: admin,
      from: setting?.fromAddress || process.env.SMTP_FROM || "", replyTo: setting ? setting.replyTo || "" : process.env.SMTP_REPLY_TO || "",
      ...(admin ? { host: setting?.host || process.env.SMTP_HOST || "smtp.gmail.com", port: setting?.port || Number(process.env.SMTP_PORT) || 587,
        secure: setting?.secure ?? (process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465"),
        user: setting?.username || process.env.SMTP_USER || "", hasPassword: Boolean(setting?.encryptedPassword) } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: emailStorageNeedsMigration(error) ? EMAIL_MIGRATION_MESSAGE : "Unable to load sending settings." }, { status: 503 }); }
}

export async function PUT(request: Request) {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  try {
    const body = await request.json().catch(() => null);
    const config = validateSmtpConfig(body, false);
    await prisma.$transaction(async tx => {
      const workspaceId = access.user.workspaceId;
      await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      const existing = await tx.workspaceSmtpSettings.findUnique({ where: { workspaceId } });
      if (!config.pass && !existing) throw new SmtpSettingsError("Enter your SMTP password or app password when saving for the first time.");
      if (!config.pass && existing && (existing.host !== config.host || existing.username !== config.user))
        throw new SmtpSettingsError("Enter the password again when changing the SMTP host or username.");
      const data = { host: config.host!, port: config.port!, secure: config.secure!, username: config.user!,
        fromAddress: config.from!, replyTo: config.replyTo || null,
        encryptedPassword: config.pass ? encryptSmtpPassword(config.pass, workspaceId) : existing!.encryptedPassword };
      await tx.workspaceSmtpSettings.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
      await tx.auditLog.create({ data: { workspaceId, userId: access.user.id, action: "SMTP_SETTINGS_SAVED", details: { host: config.host, passwordChanged: Boolean(config.pass) } } });
    });
    return NextResponse.json({ success: true, message: "Sending settings saved. Campaigns and test emails will reuse them automatically." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SmtpSettingsError ? error.message : emailStorageNeedsMigration(error) ? EMAIL_MIGRATION_MESSAGE : "Unable to save sending settings." }, { status: error instanceof SmtpSettingsError ? error.status : 500 });
  }
}

export async function DELETE() {
  const access = await requireApiUser("admin");
  if (access.response) return access.response;
  try {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Workspace" WHERE "id" = ${access.user.workspaceId} FOR UPDATE`;
    await tx.workspaceSmtpSettings.deleteMany({ where: { workspaceId: access.user.workspaceId } });
    await tx.auditLog.create({ data: { workspaceId: access.user.workspaceId, userId: access.user.id, action: "SMTP_SETTINGS_REMOVED" } });
  });
  return NextResponse.json({ success: true, message: "Workspace SMTP removed. Existing server defaults will be used if configured." });
  } catch { return NextResponse.json({ error: "Unable to remove saved SMTP settings." }, { status: 500 }); }
}
