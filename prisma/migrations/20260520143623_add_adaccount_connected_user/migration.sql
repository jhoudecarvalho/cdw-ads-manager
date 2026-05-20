-- AlterTable
ALTER TABLE "ad_accounts" ADD COLUMN     "connectedExternalUserId" TEXT;

-- CreateIndex
CREATE INDEX "ad_accounts_platform_connectedExternalUserId_idx" ON "ad_accounts"("platform", "connectedExternalUserId");
