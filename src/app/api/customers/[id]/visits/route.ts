import { after } from "next/server";
import { db } from "@/lib/db";
import { json, notFound, parseBody, requireApiSession, serverError } from "@/lib/http";
import { tierForVisits, visitCreateSchema } from "@/lib/validation";
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
        },
      }),
    ]);
    if (!customer || !loyalty) return notFound("Customer not found");

    // Tier derives from the post-increment count returned by the update, so
    // concurrent visit logs can't leave tier inconsistent with totalVisits.
    const result = await db.$transaction(async (tx) => {
      await tx.visit.create({
        data: {
          businessId,
          customerId: customer.id,
          amountCents,
          pointsEarned: loyalty.pointsPerVisit,
          note,
        },
      });
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalVisits: { increment: 1 },
          totalSpendCents: { increment: amountCents },
          loyaltyPoints: { increment: loyalty.pointsPerVisit },
          lastVisitAt: new Date(),
        },
      });
      return tx.customer.update({
        where: { id: customer.id },
        data: { tier: tierForVisits(updated.totalVisits, loyalty) },
      });
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
