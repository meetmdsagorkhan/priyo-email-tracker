import { requireApiUser } from "@/lib/access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { campaignRecipientToken } from "@/lib/tracker";
import { trackingOrigin } from "@/lib/site";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const access = await requireApiUser("manage");
    if (access.response) return access.response;
    const { id } = await context.params;
    const baseUrl = trackingOrigin();

    const campaign = await prisma.campaign.findUnique({
      where: { id, workspaceId: access.user.workspaceId },
      include: {
        recipients: {
          where: {
            recipientId: { not: null },
            recipient: { is: { workspaceId: access.user.workspaceId } },
          },
          include: { recipient: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    }
    const suppressions = await prisma.suppression.findMany({
      where: { workspaceId: access.user.workspaceId },
      select: { email: true },
    });
    const suppressed = new Set(suppressions.map(({ email }) => email));

    // If campaign has recipients, use them. Otherwise, pull global audience
    let recipientsData: {
      email: string;
      firstName: string;
      customerId: string;
      trackingToken: string;
    }[] = [];

    if (campaign.recipients.length > 0) {
      recipientsData = campaign.recipients
        .filter(
          (r) =>
            r.recipient &&
            r.recipient.email &&
            r.recipient.consentStatus === "OPTED_IN" &&
            !r.recipient.unsubscribedAt &&
            !suppressed.has(r.recipient.email),
        )
        .map((r) => ({
          email: r.recipient!.email,
          firstName: r.recipient!.firstName || "",
          customerId: r.recipient!.customerId || "",
          trackingToken: r.trackingToken,
        }));
    } else {
      const allRecipients = await prisma.recipient.findMany({
        where: {
          workspaceId: access.user.workspaceId,
          consentStatus: "OPTED_IN",
          unsubscribedAt: null,
          email: { notIn: [...suppressed] },
        },
        take: 1000,
        orderBy: { createdAt: "desc" },
      });

      for (const rec of allRecipients) {
        const token = await campaignRecipientToken(campaign.id, rec.id);

        recipientsData.push({
          email: rec.email,
          firstName: rec.firstName || "",
          customerId: rec.customerId || "",
          trackingToken: token,
        });
      }
    }

    // Build CSV string
    const headers = [
      "email",
      "first_name",
      "customer_id",
      "tracking_token",
      "open_pixel_url",
    ];
    const csvCell = (value: string) => {
      const safe = /^[=+@\-\t\r]/.test(value) ? "'" + value : value;
      return '"' + safe.replaceAll('"', '""') + '"';
    };
    const rows = recipientsData.map((r) =>
      [
        r.email,
        r.firstName,
        r.customerId,
        r.trackingToken,
        `${baseUrl}/api/track/open/${r.trackingToken}`,
      ].map(csvCell),
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="signalpost-${campaign.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}-tokens.csv"`,
      },
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json(
      { error: "Failed to generate recipient tokens CSV" },
      { status: 500 },
    );
  }
}
