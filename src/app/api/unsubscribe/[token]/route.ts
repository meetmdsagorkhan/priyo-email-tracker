import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function confirmationPage(token: string) {
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body style="font:16px system-ui;max-width:36rem;margin:10vh auto;padding:1rem"><h1>Unsubscribe from emails</h1><p>Confirm that you no longer want to receive marketing email from this sender.</p><form method="post"><input type="hidden" name="token" value="${token}"><button type="submit">Unsubscribe</button></form></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(token))
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  const recipient = await prisma.recipient.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });
  if (!recipient)
    return new NextResponse("This unsubscribe link is invalid or expired.", {
      status: 404,
    });
  return confirmationPage(token);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  if (!/^[a-zA-Z0-9_-]{20,80}$/.test(token))
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  const recipient = await prisma.recipient.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true, workspaceId: true },
  });
  if (!recipient)
    return new NextResponse("This unsubscribe link is invalid or expired.", {
      status: 404,
    });

  await prisma.$transaction(async (tx) => {
    await tx.recipient.update({
      where: { id: recipient.id },
      data: { consentStatus: "OPTED_OUT", unsubscribedAt: new Date() },
    });
    await tx.suppression.upsert({
      where: {
        workspaceId_email: {
          workspaceId: recipient.workspaceId,
          email: recipient.email,
        },
      },
      create: {
        workspaceId: recipient.workspaceId,
        email: recipient.email,
        reason: "UNSUBSCRIBED",
      },
      update: { reason: "UNSUBSCRIBED" },
    });
  });
  return new NextResponse(
    "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Unsubscribed</title><body style=\"font:16px system-ui;max-width:36rem;margin:10vh auto;padding:1rem\"><h1>You are unsubscribed</h1><p>This email address will no longer receive marketing emails from this workspace.</p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
