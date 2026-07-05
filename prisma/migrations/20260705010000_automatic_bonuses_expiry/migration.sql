-- Automatic loyalty mechanics: birthday bonus, tier-up bonus, points expiry.
-- All per-business config on Business; the movements post to PointsLedger
-- (types BIRTHDAY_BONUS / TIER_BONUS / EXPIRE, source SYSTEM).

-- AlterTable
ALTER TABLE "Business"
  ADD COLUMN     "birthdayBonusEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "birthdayBonusPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "tierBonusEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN     "tierBonusSilverPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "tierBonusGoldPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "tierBonusVipPoints" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN     "pointsExpiryMonths" INTEGER NOT NULL DEFAULT 0;
