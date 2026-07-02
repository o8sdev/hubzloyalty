import { db } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminBusinessUpdateSchema } from "@/lib/validation";
import { applyLoyaltyConfig } from "@/lib/loyalty";

/**
 * ADMIN endpoints for a single business: edit any field (including slug,
 * suspension, and loyalty config with tier recompute) or delete the tenant.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = await parseBody(req, adminBusinessUpdateSchema);
  if (parsed.error) return parsed.error;
  const { socialLinks, slug, suspended, loyalty, ...rest } = parsed.data;

  try {
    const existing = await db.business.findUnique({
      where: { id },
      select: { id: true, suspendedAt: true },
    });
    if (!existing) return notFound("Business not found");

    if (slug) {
      const slugTaken = await db.business.findFirst({
        where: { slug, id: { not: id } },
        select: { id: true },
      });
      if (slugTaken) return badRequest(`The slug "${slug}" is already taken`);
    }

    const business = await db.business.update({
      where: { id },
      data: {
        ...rest,
        ...(slug ? { slug } : {}),
        ...(socialLinks !== undefined
          ? { socialLinks: JSON.stringify(socialLinks) }
          : {}),
        ...(suspended !== undefined
          ? { suspendedAt: suspended ? existing.suspendedAt ?? new Date() : null }
          : {}),
      },
    });

    if (loyalty) await applyLoyaltyConfig(id, loyalty);

    return json({ ok: true, businessId: business.id });
  } catch (err) {
    console.error("admin business update failed", err);
    return serverError("Could not update business");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  try {
    const existing = await db.business.findUnique({
      where: { id },
      select: { id: true, users: { select: { id: true } } },
    });
    if (!existing) return notFound("Business not found");

    // Cascades remove customers, visits, reviews, rewards, campaigns.
    // Users are onDelete: SetNull — remove this business's member accounts
    // explicitly (platform admins keep theirs, just losing the business link).
    const memberIds = existing.users.map((u) => u.id);
    await db.$transaction([
      db.business.delete({ where: { id } }),
      db.user.deleteMany({
        where: { id: { in: memberIds }, isPlatformAdmin: false },
      }),
    ]);

    return json({ ok: true });
  } catch (err) {
    console.error("admin business delete failed", err);
    return serverError("Could not delete business");
  }
}
