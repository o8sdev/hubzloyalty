import Link from "next/link";
import { redirect } from "next/navigation";
import { getGuestSession } from "@/lib/session";
import { HubzWordmark } from "@/components/brand";
import { GuestAuthForm } from "../auth-form";

export default async function GuestRegisterPage() {
  if (await getGuestSession()) redirect("/guest/discover");
  return (
    <div className="pt-4">
      <HubzWordmark variant="light" imgClassName="h-6 w-auto" showTag={false} />
      <h1 className="mt-6 text-2xl font-bold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-faint">
        Discover places, check in, and collect points wherever you go.
      </p>
      <div className="mt-6">
        <GuestAuthForm mode="register" />
      </div>
      <p className="mt-5 text-center text-sm text-ink-faint">
        Already have an account?{" "}
        <Link href="/guest/login" className="font-semibold text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
