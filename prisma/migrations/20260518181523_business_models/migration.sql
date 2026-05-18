-- CreateEnum
CREATE TYPE "FranchiseStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('GOOGLE_ADS', 'META_ADS');

-- CreateEnum
CREATE TYPE "AdAccountStatus" AS ENUM ('CONNECTED', 'TOKEN_EXPIRED', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REMOVED', 'ENDED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('USER_LOGIN', 'USER_SIGNUP', 'USER_LOGOUT', 'USER_ROLE_CHANGED', 'AD_ACCOUNT_CONNECTED', 'AD_ACCOUNT_DISCONNECTED', 'DATA_EXPORTED', 'DATA_DELETED', 'TERMS_ACCEPTED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "eventType" "AuditEventType" NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" CHAR(2) NOT NULL,
    "city" TEXT NOT NULL,
    "status" "FranchiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_franchises" (
    "userId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_franchises_pkey" PRIMARY KEY ("userId","franchiseId")
);

-- CreateTable
CREATE TABLE "user_regions" (
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_regions_pkey" PRIMARY KEY ("userId","regionId")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "status" "AdAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_metrics_daily" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "spend" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "conversionValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reach" INTEGER,
    "frequency" DECIMAL(8,4),
    "platformExtras" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_metrics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "platform" "Platform" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncStatus" NOT NULL,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_occurredAt_idx" ON "audit_logs"("tenantId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_idx" ON "audit_logs"("actorUserId");

-- CreateIndex
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");

-- CreateIndex
CREATE INDEX "regions_tenantId_idx" ON "regions"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "regions_tenantId_name_key" ON "regions"("tenantId", "name");

-- CreateIndex
CREATE INDEX "franchises_tenantId_idx" ON "franchises"("tenantId");

-- CreateIndex
CREATE INDEX "franchises_tenantId_regionId_idx" ON "franchises"("tenantId", "regionId");

-- CreateIndex
CREATE INDEX "franchises_tenantId_status_idx" ON "franchises"("tenantId", "status");

-- CreateIndex
CREATE INDEX "user_franchises_tenantId_idx" ON "user_franchises"("tenantId");

-- CreateIndex
CREATE INDEX "user_franchises_franchiseId_idx" ON "user_franchises"("franchiseId");

-- CreateIndex
CREATE INDEX "user_regions_tenantId_idx" ON "user_regions"("tenantId");

-- CreateIndex
CREATE INDEX "user_regions_regionId_idx" ON "user_regions"("regionId");

-- CreateIndex
CREATE INDEX "ad_accounts_tenantId_idx" ON "ad_accounts"("tenantId");

-- CreateIndex
CREATE INDEX "ad_accounts_franchiseId_idx" ON "ad_accounts"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_tenantId_platform_externalAccountId_key" ON "ad_accounts"("tenantId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_idx" ON "campaigns"("tenantId");

-- CreateIndex
CREATE INDEX "campaigns_franchiseId_idx" ON "campaigns"("franchiseId");

-- CreateIndex
CREATE INDEX "campaigns_adAccountId_idx" ON "campaigns"("adAccountId");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_platform_idx" ON "campaigns"("tenantId", "platform");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_adAccountId_externalId_key" ON "campaigns"("adAccountId", "externalId");

-- CreateIndex
CREATE INDEX "campaign_metrics_daily_tenantId_date_idx" ON "campaign_metrics_daily"("tenantId", "date");

-- CreateIndex
CREATE INDEX "campaign_metrics_daily_campaignId_date_idx" ON "campaign_metrics_daily"("campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_metrics_daily_campaignId_date_key" ON "campaign_metrics_daily"("campaignId", "date");

-- CreateIndex
CREATE INDEX "sync_logs_tenantId_startedAt_idx" ON "sync_logs"("tenantId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "sync_logs_adAccountId_idx" ON "sync_logs"("adAccountId");

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_franchises" ADD CONSTRAINT "user_franchises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_franchises" ADD CONSTRAINT "user_franchises_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_regions" ADD CONSTRAINT "user_regions_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_metrics_daily" ADD CONSTRAINT "campaign_metrics_daily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
