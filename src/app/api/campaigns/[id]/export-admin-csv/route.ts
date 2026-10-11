import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTrackingToken } from "@/lib/tracker";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const baseUrl = process.env.TRACKING_BASE_URL || "http://localhost:3000";

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        recipients: {
          include: { recipient: true },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // If campaign has recipients, use them. Otherwise, pull global audience
    let recipientsData: {
      email: string;
      firstName: string;
      customerId: string;
      trackingToken: string;
    }[] = [];

    if (campaign.recipients.length > 0) {
      recipientsData = campaign.recipients
        .filter((r) => r.recipient && r.recipient.email)
        .map((r) => ({
          email: r.recipient!.email,
          firstName: r.recipient!.firstName || "",
          customerId: r.recipient!.customerId || "",
          trackingToken: r.trackingToken,
        }));
    } else {
      const allRecipients = await prisma.recipient.findMany({
        take: 1000,
        orderBy: { createdAt: "desc" },
      });

      for (const rec of allRecipients) {
        let token = generateTrackingToken();
        const existing = await prisma.campaignRecipient.findFirst({
          where: { campaignId: campaign.id, recipientId: rec.id },
        });

        if (existing) {
          token = existing.trackingToken;
        } else {
          await prisma.campaignRecipient.create({
            data: {
              campaignId: campaign.id,
              recipientId: rec.id,
              trackingToken: token,
            },
          });
        }

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
    const rows = recipientsData.map((r) => [
      `"${r.email}"`,
      `"${r.firstName}"`,
      `"${r.customerId}"`,
      `"${r.trackingToken}"`,
      `"${baseUrl}/api/track/open/${r.trackingToken}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="priyo-admin-${campaign.name.toLowerCase().replace(/\s+/g, "-")}-tokens.csv"`,
      },
    });
  } catch (error: any) {
    console.error("CSV Export Error:", error);
    return NextResponse.json(
      { error: "Failed to generate Priyo Admin tokens CSV" },
      { status: 500 }
    );
  }
}
