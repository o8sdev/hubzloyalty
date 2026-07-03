import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  serverError,
  unauthorized,
} from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation";
import { getSession } from "@/lib/session";
import {
  invalidateVerifiedAuthUser,
  supabaseServer,
  syncAuthClaims,
} from "@/lib/supabase";

/**
 * Change the signed-in user's own password.
 *
 * Uses getSession() directly (not requireApiSession) because platform admins
 * have businessId "" and must still be able to change their password.
 *
 * currentPassword is required for voluntary changes; while the account still
 * has mustChangePassword set (invite-only onboarding: the user just proved
 * the one-time password at login), it is skipped.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = await parseBody(req, changePasswordSchema);
  if (parsed.error) return parsed.error;
  const { currentPassword, newPassword } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { id: session.userId } });
    if (!user) return unauthorized();

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return badRequest("Current password is required");
      }
      // Verify by re-authenticating against Supabase with a throwaway
      // client (no cookie persistence — the minted session is discarded).
      const probe = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { error: probeError } = await probe.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (probeError) return badRequest("Current password is incorrect");
    }

    if (currentPassword !== undefined && currentPassword === newPassword) {
      return badRequest(
        "New password must be different from your current password"
      );
    }

    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return badRequest(error.message);

    const updated = await db.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    });
    // Mirror the cleared flag so the session stops routing to /change-password.
    await syncAuthClaims(updated);
    invalidateVerifiedAuthUser();

    return json({ ok: true });
  } catch (err) {
    console.error("change password failed", err);
    return serverError();
  }
}
