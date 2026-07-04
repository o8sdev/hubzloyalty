import { after } from "next/server";
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
import { supabaseAdmin } from "@/lib/supabase";
import { actorFromSession, recordAudit } from "@/lib/audit";

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
      select: { id: true, name: true, suspendedAt: true },
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

    let summary: string;
    if (suspended === true) summary = `Suspended ${existing.name}`;
    else if (suspended === false) summary = `Reinstated ${existing.name}`;
    else if (parsed.data.staffLimit !== undefined)
      summary = `Set ${existing.name}'s staff limit to ${parsed.data.staffLimit}`;
    else if (loyalty) summary = `Updated ${existing.name}'s loyalty rules`;
    else summary = `Edited ${existing.name}'s profile`;
    after(() =>
      recordAudit({
        businessId: id,
        actor: actorFromSession(auth.session),
        action: "admin.business.update",
        summary,
        targetType: "business",
        targetId: id,
      })
    );

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
      select: {
        id: true,
        name: true,
        users: { select: { id: true, authId: true, isPlatformAdmin: true } },
      },
    });
    if (!existing) return notFound("Business not found");

    // Cascades remove customers, visits, reviews, rewards, campaigns.
    // Users are onDelete: SetNull — remove this business's member accounts
    // explicitly (platform admins keep theirs, just losing the business link).
    const members = existing.users.filter((u) => !u.isPlatformAdmin);
    await db.$transaction([
      db.business.delete({ where: { id } }),
      db.user.deleteMany({
        where: { id: { in: members.map((u) => u.id) }, isPlatformAdmin: false },
      }),
      // Un-link any demo request that converted into this business: clears
      // the now-dead "View business" link and reverts the lead to CONTACTED
      // so it can be re-worked or dismissed.
      db.demoRequest.updateMany({
        where: { convertedBusinessId: id },
        data: { convertedBusinessId: null, status: "CONTACTED" },
      }),
    ]);

    // Remove the members' Supabase Auth identities (best-effort; an orphaned
    // auth user cannot log in — the login gate requires a linked profile).
    for (const member of members) {
      if (member.authId) {
        await supabaseAdmin()
          .auth.admin.deleteUser(member.authId)
          .catch((e) => console.error("auth user delete failed", e));
      }
    }

    // businessId null: the business (and its cascaded audit rows) is gone —
    // this platform-level record must survive.
    after(() =>
      recordAudit({
        businessId: null,
        actor: actorFromSession(auth.session),
        action: "admin.business.delete",
        summary: `Deleted business ${existing.name}`,
        targetType: "business",
        targetId: id,
      })
    );

    return json({ ok: true });
  } catch (err) {
    console.error("admin business delete failed", err);
    return serverError("Could not delete business");
  }
}
