import { db } from "@/lib/db";
import {
  badRequest,
  json,
  notFound,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminUserUpdateSchema } from "@/lib/validation";
import { supabaseAdmin, syncAuthClaims } from "@/lib/supabase";

/**
 * ADMIN endpoints for a single user: edit profile/role/business/password/
 * platform-admin flag, or delete. Self-demotion and self-deletion are
 * blocked so the last admin can't lock themselves out.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  const parsed = await parseBody(req, adminUserUpdateSchema);
  if (parsed.error) return parsed.error;
  const { password, businessId, isPlatformAdmin, ...rest } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return notFound("User not found");

    if (isPlatformAdmin === false && id === auth.session.userId) {
      return badRequest("You cannot remove your own platform-admin access");
    }

    if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      });
      if (!business) return badRequest("Business not found");
    }

    const wouldHaveBusiness =
      businessId === undefined ? user.businessId !== null : businessId !== null;
    const wouldBeAdmin = isPlatformAdmin ?? user.isPlatformAdmin;
    if (!wouldHaveBusiness && !wouldBeAdmin) {
      return badRequest(
        "A user needs a business or the platform-admin flag — otherwise they cannot log in"
      );
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...rest,
        ...(businessId !== undefined ? { businessId } : {}),
        ...(isPlatformAdmin !== undefined ? { isPlatformAdmin } : {}),
      },
    });

    // Mirror identity-side changes: admin-set password and/or claims.
    if (updated.authId) {
      if (password) {
        const { error } = await supabaseAdmin().auth.admin.updateUserById(
          updated.authId,
          { password }
        );
        if (error) {
          console.error("admin password set failed", error);
          return serverError("Could not update the password");
        }
      }
      if (rest.name) {
        await supabaseAdmin()
          .auth.admin.updateUserById(updated.authId, {
            user_metadata: { name: updated.name },
          })
          .catch((e) => console.error("name sync failed", e));
      }
      await syncAuthClaims(updated);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("admin user update failed", err);
    return serverError("Could not update user");
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;

  if (id === auth.session.userId) {
    return badRequest("You cannot delete your own account");
  }

  try {
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, authId: true },
    });
    if (!user) return notFound("User not found");

    await db.user.delete({ where: { id } });
    if (user.authId) {
      await supabaseAdmin()
        .auth.admin.deleteUser(user.authId)
        .catch((e) => console.error("auth user delete failed", e));
    }
    return json({ ok: true });
  } catch (err) {
    console.error("admin user delete failed", err);
    return serverError("Could not delete user");
  }
}
