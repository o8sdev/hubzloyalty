import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { badRequest, json, parseBody, serverError } from "@/lib/http";
import { resetPasswordSchema } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/ratelimit";

/** PUBLIC endpoint. Exchanges a valid reset token for a new password. */
export async function POST(req: Request) {
  const limited = await rateLimit({
    key: `auth:reset:${clientIp(req)}`,
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (limited) return limited;

  const parsed = await parseBody(req, resetPasswordSchema);
  if (parsed.error) return parsed.error;
  const { token, password } = parsed.data;

  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = await db.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return badRequest("This reset link is invalid or has expired");
    }

    // Claim the token atomically (usedAt IS NULL compare-and-set) so a
    // double-submitted form can't apply two different passwords.
    const claimed = await db.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      return badRequest("This reset link is invalid or has expired");
    }

    // Proving control of the email supersedes the one-time-password
    // requirement, so a pending forced change is cleared too.
    await db.user.update({
      where: { id: record.userId },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: false,
      },
    });

    return json({ ok: true });
  } catch (err) {
    console.error("password reset failed", err);
    return serverError();
  }
}
