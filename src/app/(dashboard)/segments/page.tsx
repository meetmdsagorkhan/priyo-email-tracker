import { requirePageUser } from "@/lib/access";
import { canManageCampaigns } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SegmentsClient } from "@/components/segments/SegmentsClient";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const user = await requirePageUser();
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  return (
    <SegmentsClient
      campaigns={campaigns}
      canManage={canManageCampaigns(user.role)}
    />
  );
}
