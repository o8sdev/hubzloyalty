import { db } from "@/lib/db";
import { json, notFound, parseBody, requireApiSession, serverError } from "@/lib/http";
import { POINTS_PER_VISIT, tierForVisits, visitCreateSchema } from "@/lib/validation";

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
    const customer = await db.customer.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!customer) return notFound("Customer not found");

    // Tier derives from the post-increment count returned by the update, so
    // concurrent visit logs can't leave tier inconsistent with totalVisits.
    const result = await db.$transaction(async (tx) => {
      await tx.visit.create({
        data: {
          businessId,
          customerId: customer.id,
          amountCents,
          pointsEarned: POINTS_PER_VISIT,
          note,
        },
      });
      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: {
          totalVisits: { increment: 1 },
          totalSpendCents: { increment: amountCents },
          loyaltyPoints: { increment: POINTS_PER_VISIT },
          lastVisitAt: new Date(),
        },
      });
      return tx.customer.update({
        where: { id: customer.id },
        data: { tier: tierForVisits(updated.totalVisits) },
      });
    });

    return json(result);
  } catch (err) {
    console.error("visit create failed", err);
    return serverError("Could not log visit");
  }
}
