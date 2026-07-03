import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  requireApiPlatformAdmin,
  serverError,
} from "@/lib/http";
import { adminUserCreateSchema } from "@/lib/validation";
import { buildClaims, supabaseAdmin } from "@/lib/supabase";

/** ADMIN endpoint. Creates a user, optionally attached to a business. */
export async function POST(req: Request) {
  const auth = await requireApiPlatformAdmin();
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, adminUserCreateSchema);
  if (parsed.error) return parsed.error;
  const { name, email, password, role, businessId, isPlatformAdmin } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return badRequest("A user with this email already exists");

    if (businessId) {
      const business = await db.business.findUnique({
        where: { id: businessId },
        select: { id: true },
      });
      if (!business) return badRequest("Business not found");
    }
    if (!businessId && !isPlatformAdmin) {
      return badRequest(
        "A user needs a business or the platform-admin flag — otherwise they cannot log in"
      );
    }

    // Identity first; compensate on profile failure.
    const { data: created, error: authError } =
      await supabaseAdmin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
    if (authError || !created.user) {
      if (authError?.code === "email_exists") {
        return badRequest("A user with this email already exists");
      }
      console.error("auth user create failed", authError);
      return serverError("Could not create user");
    }
    const authId = created.user.id;

    let user;
    try {
      user = await db.user.create({
        data: {
          name,
          email,
          authId,
          role,
          businessId: businessId ?? null,
          isPlatformAdmin,
        },
      });
    } catch (dbErr) {
      await supabaseAdmin()
        .auth.admin.deleteUser(authId)
        .catch((e) => console.error("auth compensation delete failed", e));
      throw dbErr;
    }

    const { error: claimsError } =
      await supabaseAdmin().auth.admin.updateUserById(authId, {
        app_metadata: buildClaims(user),
      });
    if (claimsError) console.error("claim sync failed", claimsError);

    return json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    console.error("admin user create failed", err);
    return serverError("Could not create user");
  }
}
