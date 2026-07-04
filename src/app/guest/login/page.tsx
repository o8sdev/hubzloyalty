import Link from "next/link";
import { redirect } from "next/navigation";
import { getGuestSession } from "@/lib/session";
import { HubzWordmark } from "@/components/brand";
import { GuestAuthForm } from "../auth-form";

export default async function GuestLoginPage() {
  if (await getGuestSession()) redirect("/guest/discover");
  return (
    <div className="pt-4">
      <HubzWordmark variant="light" imgClassName="h-6 w-auto" showTag={false} />
      <h1 className="mt-6 text-2xl font-bold text-ink">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Sign in to check in and track your points.
      </p>
      <div className="mt-6">
        <GuestAuthForm mode="login" />
      </div>
      <p className="mt-5 text-center text-sm text-ink-faint">
        New to HUBz?{" "}
        <Link href="/guest/register" className="font-semibold text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
