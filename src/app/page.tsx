import Link from "next/link";
import { LinkButton } from "@/components/ui";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-20 text-center">
        <div className="mb-6 flex items-center gap-2 text-xl font-bold text-brand-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-black text-white">
            L
          </span>
          LoyaltyCRM
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Turn one-time guests into regulars.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-600">
          A QR code on your counter that collects Google reviews, catches
          complaints before they go public, and quietly builds the customer
          list your café never had.
        </p>
        <div className="mt-8 flex gap-3">
          <LinkButton href="/register" size="lg">
            Start free
          </LinkButton>
          <LinkButton href="/login" variant="secondary" size="lg">
            Log in
          </LinkButton>
        </div>
        <div className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "More Google reviews",
              body: "Every guest gets a one-tap path to your Google listing. Watch the count climb.",
            },
            {
              title: "Complaints stay private",
              body: "Unhappy guests can message you directly — you fix it before it becomes a 1-star review.",
            },
            {
              title: "A customer list you own",
              body: "Names, numbers and birthdays with real marketing consent, captured at the table.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-xs text-slate-400">
          Review collection is fully ungated and compliant with Google review
          policies — every guest is offered the same public review option.
        </p>
        <p className="mt-2 text-xs text-slate-300">
          <Link href="/r/demo-cafe" className="underline">
            See the guest experience
          </Link>
        </p>
      </div>
    </main>
  );
}
