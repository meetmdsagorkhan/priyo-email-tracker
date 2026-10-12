DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "User")
       AND (
           EXISTS (SELECT 1 FROM "Invitation")
           OR EXISTS (SELECT 1 FROM "Campaign")
           OR EXISTS (SELECT 1 FROM "Recipient")
           OR EXISTS (SELECT 1 FROM "Template")
       )
    THEN
        RAISE EXCEPTION 'Cannot create the legacy workspace because existing records have no user to own it.';
    END IF;
END
$$;

CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'BUSINESS');
CREATE TYPE "BillingStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');
CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'OPTED_IN', 'OPTED_OUT');
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELED');

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'ACTIVE',
    "trialEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StripeWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignDelivery" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "campaignRecipientId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "providerMessageId" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Suppression" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
CREATE UNIQUE INDEX "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");
CREATE UNIQUE INDEX "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE UNIQUE INDEX "WorkspaceMembership_workspaceId_userId_key" ON "WorkspaceMembership"("workspaceId", "userId");
CREATE INDEX "WorkspaceMembership_userId_idx" ON "WorkspaceMembership"("userId");
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");
CREATE INDEX "EmailVerification_userId_expiresAt_idx" ON "EmailVerification"("userId", "expiresAt");
CREATE UNIQUE INDEX "CampaignDelivery_campaignRecipientId_key" ON "CampaignDelivery"("campaignRecipientId");
CREATE UNIQUE INDEX "CampaignDelivery_campaignId_recipientId_key" ON "CampaignDelivery"("campaignId", "recipientId");
CREATE INDEX "CampaignDelivery_workspaceId_status_nextAttemptAt_idx" ON "CampaignDelivery"("workspaceId", "status", "nextAttemptAt");
CREATE UNIQUE INDEX "Segment_workspaceId_name_key" ON "Segment"("workspaceId", "name");
CREATE UNIQUE INDEX "Suppression_workspaceId_email_key" ON "Suppression"("workspaceId", "email");
CREATE INDEX "Suppression_workspaceId_createdAt_idx" ON "Suppression"("workspaceId", "createdAt");
CREATE INDEX "CampaignDelivery_workspaceId_sentAt_idx" ON "CampaignDelivery"("workspaceId", "sentAt");

INSERT INTO "Workspace" ("id", "name", "slug", "ownerId", "updatedAt")
SELECT 'legacy-priyo-workspace', 'Priyo Workspace', 'priyo-workspace', "id", CURRENT_TIMESTAMP
FROM "User"
ORDER BY "createdAt", "id"
LIMIT 1;

INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role")
SELECT 'legacy-membership-' || "id", 'legacy-priyo-workspace', "id", "role"
FROM "User"
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'legacy-priyo-workspace');

ALTER TABLE "Invitation" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = "createdAt";
UPDATE "Invitation" SET "workspaceId" = 'legacy-priyo-workspace'
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'legacy-priyo-workspace');
ALTER TABLE "Campaign" ADD COLUMN "workspaceId" TEXT;
UPDATE "Campaign" SET "workspaceId" = 'legacy-priyo-workspace'
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'legacy-priyo-workspace');
ALTER TABLE "Recipient" ADD COLUMN "workspaceId" TEXT;
UPDATE "Recipient" SET "workspaceId" = 'legacy-priyo-workspace'
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'legacy-priyo-workspace');
ALTER TABLE "Recipient" ADD COLUMN "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Recipient" ADD COLUMN "consentSource" TEXT;
ALTER TABLE "Recipient" ADD COLUMN "consentedAt" TIMESTAMP(3);
ALTER TABLE "Recipient" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);
ALTER TABLE "Recipient" ADD COLUMN "unsubscribeToken" TEXT;
UPDATE "Recipient" SET "unsubscribeToken" = md5(random()::text || clock_timestamp()::text || "id");
ALTER TABLE "Recipient" ALTER COLUMN "unsubscribeToken" SET NOT NULL;
ALTER TABLE "Recipient" ADD COLUMN "customFields" JSONB;
ALTER TABLE "Template" ADD COLUMN "workspaceId" TEXT;
UPDATE "Template" SET "workspaceId" = 'legacy-priyo-workspace'
WHERE EXISTS (SELECT 1 FROM "Workspace" WHERE "id" = 'legacy-priyo-workspace');
ALTER TABLE "Campaign" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "sendStartedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "sendCompletedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "htmlContent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "workspaceId" TEXT;

ALTER TABLE "Invitation" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Campaign" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Recipient" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX "Recipient_email_key";
CREATE UNIQUE INDEX "Recipient_workspaceId_email_key" ON "Recipient"("workspaceId", "email");
CREATE UNIQUE INDEX "Recipient_unsubscribeToken_key" ON "Recipient"("unsubscribeToken");
CREATE INDEX "Recipient_workspaceId_createdAt_idx" ON "Recipient"("workspaceId", "createdAt");
CREATE INDEX "Campaign_workspaceId_createdAt_idx" ON "Campaign"("workspaceId", "createdAt");

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Template" ADD CONSTRAINT "Template_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignDelivery" ADD CONSTRAINT "CampaignDelivery_campaignRecipientId_fkey" FOREIGN KEY ("campaignRecipientId") REFERENCES "CampaignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
