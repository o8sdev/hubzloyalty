import { db } from "@/lib/db";
import type { LoyaltyConfig } from "@/lib/validation";

/**
 * Write a business's loyalty config and recompute every customer's stored
 * tier in the same transaction (tiers live on Customer rows so lists and
 * filters stay cheap). Shared by the owner settings API and the admin panel.
 */
export async function applyLoyaltyConfig(
  businessId: string,
  config: LoyaltyConfig
): Promise<LoyaltyConfig> {
  const { pointsPerVisit, silverThreshold, goldThreshold, vipThreshold } = config;

  return db.$transaction(async (tx) => {
    const updated = await tx.business.update({
      where: { id: businessId },
      data: { pointsPerVisit, silverThreshold, goldThreshold, vipThreshold },
      select: {
        pointsPerVisit: true,
        silverThreshold: true,
        goldThreshold: true,
        vipThreshold: true,
      },
    });

    await tx.customer.updateMany({
      where: { businessId, totalVisits: { gte: vipThreshold } },
      data: { tier: "VIP" },
    });
    await tx.customer.updateMany({
      where: { businessId, totalVisits: { gte: goldThreshold, lt: vipThreshold } },
      data: { tier: "GOLD" },
    });
    await tx.customer.updateMany({
      where: {
        businessId,
        totalVisits: { gte: silverThreshold, lt: goldThreshold },
      },
      data: { tier: "SILVER" },
    });
    await tx.customer.updateMany({
      where: { businessId, totalVisits: { lt: silverThreshold } },
      data: { tier: "BRONZE" },
    });

    return updated;
  });
}
