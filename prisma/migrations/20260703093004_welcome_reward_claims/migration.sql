-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "welcomeRewardEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "welcomeRewardExpiryDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "welcomeRewardText" TEXT;

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'WELCOME',
    "code" TEXT NOT NULL,
    "rewardText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_code_key" ON "RewardClaim"("code");

-- CreateIndex
CREATE INDEX "RewardClaim_businessId_status_createdAt_idx" ON "RewardClaim"("businessId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_customerId_kind_key" ON "RewardClaim"("customerId", "kind");

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the project convention: RLS on every table (Prisma connects as
-- table owner and is unaffected; this blocks Supabase's auto data API).
ALTER TABLE "RewardClaim" ENABLE ROW LEVEL SECURITY;
