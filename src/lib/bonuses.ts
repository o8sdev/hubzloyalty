import type { Prisma } from "@prisma/client";
import { postLedgerEntry } from "@/lib/ledger";

// ---------------------------------------------------------------------------
// Automatic tier-up bonus. Awarded the moment a visit promotes a customer to a
// higher tier — inside the SAME transaction that credited the visit, so the
// ledger reconciliation (cache == SUM(delta)) always holds. See the daily
// cron (src/lib/loyalty-cron.ts) for the birthday bonus and points expiry.
// ---------------------------------------------------------------------------

export type TierBonusConfig = {
  tierBonusEnabled: boolean;
  tierBonusSilverPoints: number;
  tierBonusGoldPoints: number;
  tierBonusVipPoints: number;
};

/** Business columns to select wherever a path may award a tier-up bonus. */
export const tierBonusSelect = {
  tierBonusEnabled: true,
  tierBonusSilverPoints: true,
  tierBonusGoldPoints: true,
  tierBonusVipPoints: true,
} as const;

const TIER_RANK: Record<string, number> = {
  BRONZE: 0,
  SILVER: 1,
  GOLD: 2,
  VIP: 3,
};

function pointsForTier(cfg: TierBonusConfig, tier: string): number {
  switch (tier) {
    case "SILVER":
      return cfg.tierBonusSilverPoints;
    case "GOLD":
      return cfg.tierBonusGoldPoints;
    case "VIP":
      return cfg.tierBonusVipPoints;
    default:
      return 0;
  }
}

/**
 * Award a one-time tier-up bonus when a visit promotes a customer from oldTier
 * to a strictly higher newTier. Idempotent BY CONSTRUCTION: it only fires on
 * the transition (rank increased), which happens exactly once per tier as
 * visits accumulate — so a bulk tier recompute (applyLoyaltyConfig, which never
 * routes through here) can't trigger it, and re-crediting the same visit can't
 * double-award. Posts a TIER_BONUS ledger row. Returns the points awarded (0
 * when disabled, not a promotion, or the tier has no configured bonus).
 */
export async function awardTierBonus(
  tx: Prisma.TransactionClient,
  opts: {
    businessId: string;
    customerId: string;
    oldTier: string;
    newTier: string;
    config: TierBonusConfig;
    /** The visit that caused the promotion (recorded on the ledger row). */
    sourceId?: string | null;
  }
): Promise<number> {
  if (!opts.config.tierBonusEnabled) return 0;
  if ((TIER_RANK[opts.newTier] ?? 0) <= (TIER_RANK[opts.oldTier] ?? 0)) return 0;

  const points = pointsForTier(opts.config, opts.newTier);
  if (points <= 0) return 0;

  await postLedgerEntry(tx, {
    businessId: opts.businessId,
    customerId: opts.customerId,
    type: "TIER_BONUS",
    delta: points,
    sourceType: "SYSTEM",
    sourceId: opts.sourceId ?? null,
    note: `Reached ${opts.newTier} — tier bonus`,
  });
  return points;
}
