import { db } from "@/lib/db";
import { forbidden, json, parseBody, requireApiSession, serverError } from "@/lib/http";
import { loyaltySettingsSchema } from "@/lib/validation";

/**
 * Update the business's loyalty program configuration. Because tiers are
 * stored on customers (so lists/filters stay cheap), changing thresholds
 * recomputes every customer's tier in the same transaction using ranged
 * bulk updates.
 */
export async function PATCH(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, role } = auth.session;
  if (role !== "OWNER" && role !== "ADMIN") return forbidden();

  const parsed = await parseBody(req, loyaltySettingsSchema);
  if (parsed.error) return parsed.error;
  const { pointsPerVisit, silverThreshold, goldThreshold, vipThreshold } =
    parsed.data;

  try {
    const business = await db.$transaction(async (tx) => {
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
        where: {
          businessId,
          totalVisits: { gte: goldThreshold, lt: vipThreshold },
        },
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

    return json({ ok: true, loyalty: business });
  } catch (err) {
    console.error("loyalty settings update failed", err);
    return serverError("Could not update loyalty settings");
  }
}
