-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "askTableNumber" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "earnCooldownHours" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "maxEarnPerDay" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "Checkin" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reviewId" TEXT,
    "code" TEXT NOT NULL,
    "tableNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_reviewId_key" ON "Checkin"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Checkin_code_key" ON "Checkin"("code");

-- CreateIndex
CREATE INDEX "Checkin_businessId_status_createdAt_idx" ON "Checkin"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Checkin_customerId_status_idx" ON "Checkin"("customerId", "status");

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the project convention: RLS on every table.
ALTER TABLE "Checkin" ENABLE ROW LEVEL SECURITY;
