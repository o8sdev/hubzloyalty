import { db } from "@/lib/db";
import { json, parseBody, serverError } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { supabaseServer } from "@/lib/supabase";
import { appUrl } from "@/lib/mail";

/**
 * PUBLIC endpoint. Sends a Supabase Auth recovery email. Always answers
 * { ok: true } regardless of whether the email exists — anything else is a
 * user-enumeration oracle. The emailed link hits /auth/confirm, which
 * exchanges the token for a session and lands on /reset-password.
 */
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `auth:forgot:${clientIp(req)}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, forgotPasswordSchema);
  if (parsed.error) return parsed.error;
  const { email } = parsed.data;

  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: appUrl("/auth/confirm?next=/reset-password"),
    });
    if (error) console.error("resetPasswordForEmail failed", error.message);

    // Keep the admin email log complete (only for known accounts; the
    // response below is identical either way).
    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (user && !error) {
      await db.emailLog
        .create({
          data: {
            to: email,
            subject: "Reset your password (Supabase Auth)",
            kind: "PASSWORD_RESET",
            status: "SENT",
          },
        })
        .catch(() => {});
    }

    return json({ ok: true });
  } catch (err) {
    console.error("forgot password failed", err);
    return serverError();
  }
}
