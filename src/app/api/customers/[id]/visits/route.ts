import { after } from "next/server";
import { db } from "@/lib/db";
import { json, notFound, parseBody, requireApiSession, serverError } from "@/lib/http";
import { visitCreateSchema } from "@/lib/validation";
import { recordLedgerRow } from "@/lib/ledger";
import { awardTierBonus, tierBonusSelect } from "@/lib/bonuses";
import { actorFromSession, recordAudit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;
  const { id } = await params;

  const parsed = await parseBody(req, visitCreateSchema);
  if (parsed.error) return parsed.error;
  const { amountCents, note } = parsed.data;

  try {
    // Multi-tenant isolation: verify the customer belongs to this business.
    // Loyalty economics (points per visit, tier thresholds) are per-business.
    const [customer, loyalty] = await Promise.all([
      db.customer.findFirst({
        where: { id, businessId },
        select: { id: true },
      }),
      db.business.findUnique({
        where: { id: businessId },
        select: {
          pointsPerVisit: true,
          silverThreshold: true,
          goldThreshold: true,
          vipThreshold: true,
          ...tierBonusSelect,
        },
      }),
    ]);
    if (!customer || !loyalty) return notFound("Customer not found");
    const tierBonus = {
      tierBonusEnabled: loyalty.tierBonusEnabled,
      tierBonusSilverPoints: loyalty.tierBonusSilverPoints,
      tierBonusGoldPoints: loyalty.tierBonusGoldPoints,
      tierBonusVipPoints: loyalty.tierBonusVipPoints,
    };

    // Tier derives from the post-increment count returned by the update, so
    // concurrent visit logs can't leave tier inconsistent with totalVisits.
    const result = await db.$transaction(async (tx) => {
      const visit = await tx.visit.create({
        data: {
          businessId,
          customerId: customer.id,
          amountCents,
          pointsEarned: loyalty.pointsPerVisit,
          note,
        },
      });
      // One statement: bump visits/spend/points AND recompute tier from the
      // live in-row count (a separate tier UPDATE from a JS-held count could
      // regress the tier under concurrent logs). RETURNING gives the exact
      // post-move balance for the ledger row.
      // Lock the row and read the pre-update tier under the lock, so concurrent
      // visit logs for the same customer can't both see the pre-promotion tier
      // and double-award the tier bonus (they serialize on this lock).
      const locked = await tx.$queryRaw<{ tier: string }[]>`
        SELECT "tier" FROM "Customer" WHERE id = ${customer.id} FOR UPDATE`;
      const oldTier = locked[0]?.tier ?? "BRONZE";

      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          firstName: string;
          lastName: string | null;
          loyaltyPoints: number;
          newTier: string;
        }>
      >`
        UPDATE "Customer" SET
          "totalVisits"     = "totalVisits" + 1,
          "totalSpendCents" = "totalSpendCents" + ${amountCents},
          "loyaltyPoints"   = "loyaltyPoints" + ${loyalty.pointsPerVisit},
          "lastVisitAt"     = now(),
          "updatedAt"       = now(),
          "tier" = CASE
            WHEN "totalVisits" + 1 >= ${loyalty.vipThreshold} THEN 'VIP'
            WHEN "totalVisits" + 1 >= ${loyalty.goldThreshold} THEN 'GOLD'
            WHEN "totalVisits" + 1 >= ${loyalty.silverThreshold} THEN 'SILVER'
            ELSE 'BRONZE'
          END
        WHERE id = ${customer.id}
        RETURNING "id", "firstName", "lastName", "loyaltyPoints", "tier" AS "newTier"`;
      const row = rows[0];

      // Same earn, same ledger: a manual visit posts an EARN entry so the
      // cache stays equal to SUM(delta).
      await recordLedgerRow(tx, {
        businessId,
        customerId: customer.id,
        type: "EARN",
        delta: loyalty.pointsPerVisit,
        balanceAfter: row?.loyaltyPoints ?? loyalty.pointsPerVisit,
        sourceType: "VISIT",
        sourceId: visit.id,
        createdByUserId: auth.session.userId,
        note: note ?? "Manual visit",
      });

      // Tier-up bonus (once, on the promoting visit) — same transaction.
      if (row) {
        await awardTierBonus(tx, {
          businessId,
          customerId: customer.id,
          oldTier,
          newTier: row.newTier,
          config: tierBonus,
          sourceId: visit.id,
        });
      }
      return row;
    });

    after(() =>
      recordAudit({
        businessId,
        actor: actorFromSession(auth.session),
        action: "visit.create",
        summary: `Logged a manual visit for ${[result.firstName, result.lastName].filter(Boolean).join(" ")}`,
        targetType: "customer",
        targetId: customer.id,
      })
    );
    return json(result);
  } catch (err) {
    console.error("visit create failed", err);
    return serverError("Could not log visit");
  }
}
