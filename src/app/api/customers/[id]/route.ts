import { db } from "@/lib/db";
import { json, notFound, parseBody, requireApiSession, serverError } from "@/lib/http";
import { arrayToTags, customerUpdateSchema } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const customer = await db.customer.findFirst({
      where: { id, businessId: auth.session.businessId },
      include: {
        visits: { orderBy: { visitedAt: "desc" }, take: 10 },
        reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!customer) return notFound("Customer not found");
    return json(customer);
  } catch (err) {
    console.error("customer get failed", err);
    return serverError("Could not load customer");
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = await parseBody(req, customerUpdateSchema);
  if (parsed.error) return parsed.error;
  const { tags, ...data } = parsed.data;

  try {
    // Multi-tenant isolation: verify the record belongs to this business.
    const existing = await db.customer.findFirst({
      where: { id, businessId: auth.session.businessId },
      select: { id: true },
    });
    if (!existing) return notFound("Customer not found");

    const customer = await db.customer.update({
      where: { id },
      // Undefined fields are ignored by Prisma, so a partial body only
      // touches the provided fields. Tags are stored comma-separated.
      data: {
        ...data,
        ...(tags !== undefined ? { tags: arrayToTags(tags) } : {}),
      },
    });
    return json(customer);
  } catch (err) {
    console.error("customer update failed", err);
    return serverError("Could not update customer");
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const existing = await db.customer.findFirst({
      where: { id, businessId: auth.session.businessId },
      select: { id: true },
    });
    if (!existing) return notFound("Customer not found");

    // The UI promises "permanently removes their visits and feedback", so
    // delete their reviews too (the schema's onDelete: SetNull would keep
    // them anonymized otherwise). GDPR-friendly full erasure.
    await db.$transaction([
      db.review.deleteMany({
        where: { customerId: id, businessId: auth.session.businessId },
      }),
      db.customer.delete({ where: { id } }),
    ]);
    return json({ ok: true });
  } catch (err) {
    console.error("customer delete failed", err);
    return serverError("Could not delete customer");
  }
}
