import { db } from "@/lib/db";
import { json, notFound, parseBody, requireApiSession, serverError } from "@/lib/http";
import { reviewUpdateSchema } from "@/lib/validation";

/** Update a review's status (e.g. mark a low-rating item RESOLVED). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId } = auth.session;

  const { id } = await params;
  const parsed = await parseBody(req, reviewUpdateSchema);
  if (parsed.error) return parsed.error;

  try {
    // Multi-tenant isolation: only reviews belonging to this business.
    const review = await db.review.findFirst({ where: { id, businessId } });
    if (!review) return notFound("Review not found");

    const updated = await db.review.update({
      where: { id: review.id },
      data: { status: parsed.data.status },
    });
    return json(updated);
  } catch (err) {
    console.error("review update failed", err);
    return serverError();
  }
}
