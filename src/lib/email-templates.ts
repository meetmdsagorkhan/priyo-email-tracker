import { roleLabels, type AppRole } from "@/lib/permissions";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function invitationEmail({
  name,
  workspaceName,
  inviterName,
  role,
  inviteUrl,
}: {
  name: string;
  workspaceName: string;
  inviterName: string;
  role: AppRole;
  inviteUrl: string;
}) {
  const safeName = escapeHtml(name);
  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeInviterName = escapeHtml(inviterName);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const roleName = roleLabels[role];
  const subject = "You're invited to Signalpost";
  const text = [
    `Hello ${name},`,
    "",
    `${inviterName} invited you to join ${workspaceName} on Signalpost as a ${roleName}.`,
    "",
    `Accept your invitation: ${inviteUrl}`,
    "",
    "This invitation expires in 7 days and can only be used once.",
    "If you were not expecting this invitation, you can ignore this email.",
    "",
    "Signalpost | Email engagement, made clear.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${safeInviterName} invited you to collaborate in ${safeWorkspaceName} on Signalpost.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f6fb;padding:36px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e6eaf0;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 36px;background-color:#172554;">
                <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.3px;">Signalpost</p>
                <p style="margin:6px 0 0;color:#cbd5e1;font-size:13px;">Email engagement, made clear.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px;">
                <p style="margin:0 0 12px;color:#667085;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Workspace invitation</p>
                <h1 style="margin:0 0 18px;color:#172033;font-size:25px;line-height:1.3;">You’re invited to collaborate</h1>
                <p style="margin:0 0 16px;color:#475467;font-size:15px;line-height:1.7;">Hello ${safeName},</p>
                <p style="margin:0 0 22px;color:#475467;font-size:15px;line-height:1.7;"><strong>${safeInviterName}</strong> invited you to join <strong>${safeWorkspaceName}</strong> on Signalpost as a <strong>${roleName}</strong>.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td align="center" style="border-radius:8px;background-color:#2563eb;">
                      <a href="${safeInviteUrl}" style="display:inline-block;padding:13px 22px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Accept invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;color:#667085;font-size:12px;line-height:1.6;">Or copy and paste this link into your browser:</p>
                <p style="margin:0 0 22px;word-break:break-all;font-size:12px;line-height:1.6;"><a href="${safeInviteUrl}" style="color:#2563eb;">${safeInviteUrl}</a></p>
                <div style="padding:14px 16px;background-color:#f8fafc;border:1px solid #e6eaf0;border-radius:10px;">
                  <p style="margin:0;color:#475467;font-size:12px;line-height:1.7;">This invitation expires in 7 days and can only be used once. If you weren’t expecting it, you can safely ignore this email.</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 36px;border-top:1px solid #e6eaf0;color:#98a2b3;font-size:11px;line-height:1.6;">
                This message was sent because an administrator invited you to Signalpost. Please don’t reply to this automated email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
