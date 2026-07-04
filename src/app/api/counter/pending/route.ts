import { db } from "@/lib/db";
import { json, requireApiSession } from "@/lib/http";
import { formatRewardCode } from "@/lib/onetime";

/**
 * Live queue of check-ins awaiting confirmation — the waiter-venue surface:
 * staff confirm from the list (by table/name) instead of typing a code.
 */
export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const pending = await db.checkin.findMany({
    where: {
      businessId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      code: true,
      tableNumber: true,
      createdAt: true,
      customer: {
        select: {
          firstName: true,
          lastName: true,
          totalVisits: true,
          tier: true,
        },
      },
    },
  });

  return json({
    pending: pending.map((p) => ({
      code: formatRewardCode(p.code),
      rawCode: p.code,
      tableNumber: p.tableNumber,
      createdAt: p.createdAt,
      customer: p.customer,
    })),
  });
}
