import { db } from "@/lib/db";
import { badRequest, json, parseBody, serverError, unauthorized } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  invalidateVerifiedAuthUser,
  supabaseServer,
  syncAuthClaims,
} from "@/lib/supabase";

/**
 * Sets a new password for the CURRENT session — reached via the emailed
 * recovery link (/auth/confirm established the session). Proving control of
 * the email supersedes the one-time-password requirement, so a pending
 * forced change is cleared too.
 */
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `auth:reset:${clientIp(req)}`,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, resetPasswordSchema);
  if (parsed.error) return parsed.error;
  const { password } = parsed.data;

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return badRequest("This reset link is invalid or has expired");
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      return badRequest(
        error.message.includes("different")
          ? "New password must be different from your current password"
          : error.message
      );
    }

    // Clear a pending forced change on the profile + mirrored claims.
    const profile = await db.user.findUnique({ where: { authId: user.id } });
    if (profile && profile.mustChangePassword) {
      const updated = await db.user.update({
        where: { id: profile.id },
        data: { mustChangePassword: false },
      });
      await syncAuthClaims(updated);
    }

    // Password change rotates sessions server-side; drop stale cache entries.
    invalidateVerifiedAuthUser();

    return json({ ok: true });
  } catch (err) {
    console.error("password reset failed", err);
    return serverError();
  }
}

// Old clients may still probe with tokens; give them a clear answer.
export async function GET() {
  return unauthorized();
}
