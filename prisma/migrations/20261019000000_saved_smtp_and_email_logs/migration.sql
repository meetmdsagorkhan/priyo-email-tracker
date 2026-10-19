BEGIN;
-- CreateTable
CREATE TABLE "WorkspaceSmtpSettings" (
    "workspaceId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "replyTo" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSmtpSettings_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "deliveryId" TEXT,
    "kind" TEXT NOT NULL,
    "campaignName" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromAddress" TEXT,
    "replyTo" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "messageId" TEXT,
    "lastError" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailLog_deliveryId_key" ON "EmailLog"("deliveryId");

-- CreateIndex
CREATE INDEX "EmailLog_workspaceId_queuedAt_id_idx" ON "EmailLog"("workspaceId", "queuedAt", "id");

-- CreateIndex
CREATE INDEX "EmailLog_workspaceId_kind_queuedAt_idx" ON "EmailLog"("workspaceId", "kind", "queuedAt");

-- CreateIndex
CREATE INDEX "EmailLog_campaignId_idx" ON "EmailLog"("campaignId");

-- AddForeignKey
ALTER TABLE "WorkspaceSmtpSettings" ADD CONSTRAINT "WorkspaceSmtpSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "CampaignDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Preserve historical campaign sending records. No SMTP credentials or test
-- messages were stored by the old app, so they cannot be reconstructed here.
INSERT INTO "EmailLog" (
    "id", "workspaceId", "campaignId", "deliveryId", "kind", "campaignName",
    "toEmail", "subject", "status", "attempts", "messageId", "lastError",
    "queuedAt", "sentAt", "updatedAt"
)
SELECT 'delivery_' || d."id", d."workspaceId", d."campaignId", d."id", 'CAMPAIGN', c."name",
       r."email", COALESCE(c."subject", c."name"), d."status", d."attempts",
       d."providerMessageId", CASE WHEN d."lastError" IS NOT NULL THEN 'Historical send failed or was canceled; inspect provider logs for details.' ELSE NULL END, d."queuedAt", d."sentAt", d."updatedAt"
FROM "CampaignDelivery" d
JOIN "Campaign" c ON c."id" = d."campaignId"
JOIN "Recipient" r ON r."id" = d."recipientId";

COMMIT;
