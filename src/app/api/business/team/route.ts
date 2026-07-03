import { db } from "@/lib/db";
import {
  badRequest,
  forbidden,
  json,
  parseBody,
  requireApiSession,
  serverError,
} from "@/lib/http";
import { teamInviteSchema } from "@/lib/validation";
import { generateOneTimePassword } from "@/lib/onetime";
import { buildClaims, supabaseAdmin } from "@/lib/supabase";

/**
 * Owner/admin invites a STAFF member for their own business. Same one-time
 * password pattern as platform provisioning: the OTP appears ONLY in this
 * response; the staffer must set their own password at first login. Staff
 * can confirm counter codes but keep the member role's limited settings.
 */
export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const { businessId, role } = auth.session;
  if (role !== "OWNER" && role !== "ADMIN") return forbidden();

  const parsed = await parseBody(req, teamInviteSchema);
  if (parsed.error) return parsed.error;
  const { name, email } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return badRequest("A user with this email already exists");

    const oneTimePassword = generateOneTimePassword();

    const { data: created, error: authError } =
      await supabaseAdmin().auth.admin.createUser({
        email,
        password: oneTimePassword,
        email_confirm: true,
        user_metadata: { name },
      });
    if (authError || !created.user) {
      if (authError?.code === "email_exists") {
        return badRequest("A user with this email already exists");
      }
      console.error("staff auth create failed", authError);
      return serverError("Could not create the staff account");
    }
    const authId = created.user.id;

    let user;
    try {
      user = await db.user.create({
        data: {
          name,
          email,
          authId,
          role: "STAFF",
          businessId,
          mustChangePassword: true,
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
    if (claimsError) console.error("staff claim sync failed", claimsError);

    return json({ ok: true, userId: user.id, email, oneTimePassword }, { status: 201 });
  } catch (err) {
    console.error("staff invite failed", err);
    return serverError("Could not invite the staff member");
  }
}
