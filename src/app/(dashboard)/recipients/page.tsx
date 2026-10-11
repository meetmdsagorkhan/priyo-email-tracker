import { prisma } from "@/lib/prisma";
import { RecipientsClient } from "@/components/recipients/RecipientsClient";

export const dynamic = "force-dynamic";

export default async function RecipientsPage() {
  let recipients: any[] = [];
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
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <RecipientsClient initialRecipients={recipients} />
    </div>
  );
}
