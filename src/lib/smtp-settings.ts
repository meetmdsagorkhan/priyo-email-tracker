import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import addressparser from "nodemailer/lib/addressparser";
import { prisma } from "./prisma";
import type { SmtpConfig } from "./mailer";

export function emailStorageNeedsMigration(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && ["P2021", "P2022"].includes(String(error.code)));
}
export const EMAIL_MIGRATION_MESSAGE = "Email sending setup requires a database update. Apply pending Prisma migrations before using saved SMTP or email logs.";

export class SmtpSettingsError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

function encryptionKey(workspaceId: string) {
  const secret = process.env.SMTP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new SmtpSettingsError("Saving SMTP requires SMTP_ENCRYPTION_KEY or NEXTAUTH_SECRET with at least 32 characters on the server.", 503);
  return createHash("sha256").update(`signalpost:smtp:v1:${workspaceId}:${secret}`).digest();
}
export function encryptSmtpPassword(password: string, workspaceId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(workspaceId), iv);
  cipher.setAAD(Buffer.from(workspaceId));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptSmtpPassword(encrypted: string, workspaceId: string) {
  try {
    const [version, iv, tag, data] = encrypted.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error("Invalid ciphertext");
    const cipher = createDecipheriv("aes-256-gcm", encryptionKey(workspaceId), Buffer.from(iv, "base64url"));
    cipher.setAAD(Buffer.from(workspaceId));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8");
  } catch {
    throw new SmtpSettingsError("Saved SMTP credentials cannot be decrypted. Ask your admin to save the password again after checking the server encryption key.", 503);
  }
}

export function validMailAddress(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 320 || /[\r\n\0]/.test(value) || !value.trim()) return false;
  const parsed = addressparser(value, { flatten: true });
  return parsed.length === 1 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(parsed[0].address);
}
export function parseReplyTo(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (!validMailAddress(value)) throw new SmtpSettingsError("Reply-To must be one valid email address, optionally with a display name.");
  return value.trim();
}

export function validateSmtpConfig(value: unknown, requirePassword = true): SmtpConfig {
  if (!value || typeof value !== "object") throw new SmtpSettingsError("Provide SMTP settings.");
  const item = value as Record<string, unknown>;
  if (typeof item.host !== "string" || !/^[a-z\d][a-z\d._-]{0,253}$/i.test(item.host) ||
      !Number.isInteger(item.port) || Number(item.port) < 1 || Number(item.port) > 65535 ||
      typeof item.user !== "string" || !item.user.trim() || item.user.length > 254 || /[\r\n\0]/.test(item.user) ||
      (item.secure !== undefined && typeof item.secure !== "boolean") ||
      (item.pass !== undefined && (typeof item.pass !== "string" || item.pass.length > 4096)) ||
      (requirePassword && (typeof item.pass !== "string" || !item.pass)) || !validMailAddress(item.from))
    throw new SmtpSettingsError("Provide a valid SMTP host, port (1–65535), username, password, and single From address.");
  return { host: item.host.trim(), port: Number(item.port), secure: item.secure === true || Number(item.port) === 465,
    user: item.user.trim(), pass: typeof item.pass === "string" ? item.pass : undefined,
    from: (item.from as string).trim(), replyTo: parseReplyTo(item.replyTo) };
}

export async function resolveWorkspaceSmtp(workspaceId: string): Promise<SmtpConfig | undefined> {
  const settings = await prisma.workspaceSmtpSettings.findUnique({ where: { workspaceId } });
  if (!settings) return undefined; // The mailer uses existing server SMTP defaults.
  return { host: settings.host, port: settings.port, secure: settings.secure, user: settings.username,
    pass: decryptSmtpPassword(settings.encryptedPassword, workspaceId), from: settings.fromAddress,
    replyTo: settings.replyTo || undefined };
}

// Do not return provider errors verbatim: providers may echo authentication data.
export function smtpFailureMessage(error: unknown) {
  const info = error as { code?: string; responseCode?: number } | null;
  const response = typeof info?.responseCode === "number" ? ` (SMTP ${info.responseCode})` : "";
  if (info?.code === "EAUTH") return `SMTP authentication failed${response}. Check the saved username and password/app password.`;
  if (info?.code === "EENVELOPE" || info?.code === "EMESSAGE") return `SMTP rejected the sender, recipient, or message${response}. Check provider restrictions and sender verification.`;
  if (["ECONNECTION", "ESOCKET", "ETIMEDOUT", "ECONNREFUSED", "EDNS", "ENOTFOUND"].includes(info?.code || ""))
    return "Unable to connect to SMTP. Check the saved host, port, TLS mode, and provider availability.";
  if (error instanceof SmtpSettingsError) return error.message;
  return `Email was not confirmed as accepted by SMTP${response}. Check sending settings and provider logs before retrying.`;
}
