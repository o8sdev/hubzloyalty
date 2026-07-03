import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
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

  const forced = session.mustChangePassword;

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
