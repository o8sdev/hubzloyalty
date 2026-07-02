import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  badRequest,
  json,
  parseBody,
  serverError,
  unauthorized,
} from "@/lib/http";
import { changePasswordSchema } from "@/lib/validation";
import { createSession, getSession } from "@/lib/session";

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
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return badRequest("Current password is incorrect");
    }

    if (currentPassword !== undefined && currentPassword === newPassword) {
      return badRequest(
        "New password must be different from your current password"
      );
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
      },
    });

    // Re-issue the session cookie so the mustChangePassword JWT claim updates
    // (otherwise the (app) layout would keep redirecting to /change-password).
    await createSession({
      userId: updated.id,
      businessId: updated.businessId ?? "",
      role: updated.role,
      platformAdmin: updated.isPlatformAdmin,
      mustChangePassword: false,
      name: updated.name,
      email: updated.email,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("change password failed", err);
    return serverError();
  }
}
