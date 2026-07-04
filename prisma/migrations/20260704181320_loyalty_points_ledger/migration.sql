-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "welcomeRewardValueCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RewardClaim" ADD COLUMN     "valueCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "valueCents" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointsLedger_businessId_createdAt_idx" ON "PointsLedger"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsLedger_customerId_createdAt_idx" ON "PointsLedger"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "PointsLedger_businessId_type_createdAt_idx" ON "PointsLedger"("businessId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsLedger" ADD CONSTRAINT "PointsLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: block Supabase's auto PostgREST API. Prisma connects as
-- the table owner and is unaffected. (Project convention — every new table.)
ALTER TABLE "PointsLedger" ENABLE ROW LEVEL SECURITY;
