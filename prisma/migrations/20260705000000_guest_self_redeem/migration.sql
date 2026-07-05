-- Guest self-redeem: extend Redemption with a PENDING bearer-code lifecycle.
-- Staff-instant redemptions stay born-CONFIRMED (default) with no code; guest
-- self-redeemed ones start PENDING with a code and move points only when staff
-- confirm the code at the counter.

-- AlterTable
ALTER TABLE "Redemption"
  ADD COLUMN     "code" TEXT,
  ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN     "expiresAt" TIMESTAMP(3),
  ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill createdAt to the original redemption time for existing (settled) rows.
UPDATE "Redemption" SET "createdAt" = "redeemedAt" WHERE "createdAt" > "redeemedAt";

-- redeemedAt is null while a code is PENDING; drop the NOT NULL + default.
ALTER TABLE "Redemption" ALTER COLUMN "redeemedAt" DROP NOT NULL;
ALTER TABLE "Redemption" ALTER COLUMN "redeemedAt" DROP DEFAULT;

-- CreateIndex: unique bearer code (NULLs are distinct in Postgres, so the many
-- code-less staff rows don't collide).
CREATE UNIQUE INDEX "Redemption_code_key" ON "Redemption"("code");

-- CreateIndex: at most one live PENDING redemption code per customer (the guest
-- must confirm/cancel/expire the current one before minting another).
CREATE UNIQUE INDEX "Redemption_customerId_pending_key" ON "Redemption"("customerId") WHERE "status" = 'PENDING';

-- CreateIndex
CREATE INDEX "Redemption_businessId_status_createdAt_idx" ON "Redemption"("businessId", "status", "createdAt");
