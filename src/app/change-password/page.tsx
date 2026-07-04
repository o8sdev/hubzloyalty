import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AuthShell } from "@/components/marketing/auth";
import { ChangePasswordForm } from "@/components/change-password-form";

/**
 * Standalone password-change page. Serves both the forced first-login flow
 * (mustChangePassword: skip the current-password check — the user just
 * authenticated with the one-time password) and a plain change-password page
 * for any signed-in account, including platform admins without a business.
 */
export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Read the forced-flow flag from the DB (source of truth), NOT the cached
  // app_metadata claim. Right after an OTP login the claim can briefly lag
  // the DB; trusting it would render the voluntary form (with a current-
  // password field) while the API — which reads the DB — expects the forced
  // form, producing a misleading "Current password is required" error.
  const dbUser = await db.user.findUnique({
    where: { id: session.userId },
    select: { mustChangePassword: true },
  });
  const forced = dbUser?.mustChangePassword ?? false;

  return (
    <AuthShell
      eyebrow={forced ? "one last thing" : "account"}
      title={
        forced ? (
          <>
            Make it <span className="italic text-ember">yours.</span>
          </>
        ) : (
          <>
            Change your <span className="italic text-ember">password.</span>
          </>
        )
      }
      subtitle={
        forced
          ? "Your account was created with a one-time password. Choose your own to continue — takes ten seconds."
          : `Set a new password for ${session.email}.`
      }
    >
      <ChangePasswordForm
        variant="mkt"
        requireCurrent={!forced}
        redirectTo={session.platformAdmin ? "/admin" : "/dashboard"}
      />
    </AuthShell>
  );
}
