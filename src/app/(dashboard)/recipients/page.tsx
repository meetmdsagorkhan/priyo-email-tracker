import type { Prisma } from "@prisma/client";
import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RecipientsClient } from "@/components/recipients/RecipientsClient";

export const dynamic = "force-dynamic";

export default async function RecipientsPage() {
  const user = await requirePageUser();
  let recipients: Prisma.RecipientGetPayload<{
    include: { _count: { select: { campaigns: true } } };
  }>[] = [];
  try {
    recipients = await prisma.recipient.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        _count: {
          select: { campaigns: true },
        },
      },
    });
  } catch (e) {
    console.error("DB error loading recipients:", e);
    throw new Error("Unable to load workspace data. Please try again.");
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <RecipientsClient
        canManage={canManageCampaigns(user.role)}
        initialRecipients={recipients.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
