import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { json, parseBody, serverError } from "@/lib/http";
import { forgotPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { appUrl, renderEmail, sendMail } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * PUBLIC endpoint. Always answers { ok: true } regardless of whether the
 * email exists — anything else is a user-enumeration oracle.
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
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const raw = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(raw).digest("hex");

      // One live token per user: a new request invalidates older links.
      await db.$transaction([
        db.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        }),
        db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
          },
        }),
      ]);

      const resetUrl = appUrl(`/reset-password?token=${raw}`);
      await sendMail({
        to: user.email,
        subject: "Reset your LoyaltyCRM password",
        kind: "PASSWORD_RESET",
        html: renderEmail({
          heading: "Reset your password",
          bodyHtml:
            `<p>Someone (hopefully you) asked to reset the password for this account.</p>` +
            `<p>The link below works once and expires in 1 hour. If you didn't ask for this, you can safely ignore this email.</p>`,
          ctaLabel: "Choose a new password",
          ctaUrl: resetUrl,
        }),
        text: `Reset your LoyaltyCRM password (valid 1 hour): ${resetUrl}`,
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("forgot password failed", err);
    return serverError();
  }
}
