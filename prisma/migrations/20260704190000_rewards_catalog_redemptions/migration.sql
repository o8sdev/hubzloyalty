-- DropForeignKey
ALTER TABLE "Redemption" DROP CONSTRAINT "Redemption_rewardId_fkey";

-- DropIndex
DROP INDEX "Reward_businessId_idx";

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "costValueCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Redemption" ADD COLUMN     "businessId" TEXT NOT NULL,
ADD COLUMN     "redeemedByUserId" TEXT,
ADD COLUMN     "rewardName" TEXT NOT NULL,
ADD COLUMN     "valueCents" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "rewardId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Reward_businessId_active_idx" ON "Reward"("businessId", "active");

-- CreateIndex
CREATE INDEX "Redemption_businessId_redeemedAt_idx" ON "Redemption"("businessId", "redeemedAt");

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
