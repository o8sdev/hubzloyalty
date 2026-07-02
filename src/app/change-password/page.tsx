import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Card } from "@/components/ui";
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
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-slate-900">
          {forced ? "Set your password" : "Change password"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {forced
            ? "Your account was created with a one-time password. Choose your own to continue."
            : `Change the password for ${session.email}.`}
        </p>
        <div className="mt-6">
          <ChangePasswordForm
            requireCurrent={!forced}
            redirectTo={session.platformAdmin ? "/admin" : "/dashboard"}
          />
        </div>
      </Card>
    </main>
  );
}
