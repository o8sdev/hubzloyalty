import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Parallax, Reveal } from "@/components/marketing/motion";

export const metadata: Metadata = {
  title: "About — LoyaltyCRM",
  description:
    "Why we built an ungated review funnel and a CRM that belongs to the café, not the platform.",
};

const VALUES = [
  {
    n: "№1",
    title: "Guests before graphs.",
    body: "Every feature starts at the table, not the dashboard. If it doesn't make a guest's next visit more likely, it doesn't ship.",
  },
  {
    n: "№2",
    title: "Compliance isn't optional.",
    body: "Review gating is cheating, and cheating gets cafés delisted and fined. We'd rather win slower and keep every review real.",
  },
  {
    n: "№3",
    title: "Owners own the list.",
    body: "Names, birthdays, consent — captured for you, exportable by you, never held hostage. Platforms come and go; your list shouldn't.",
  },
  {
    n: "№4",
    title: "Software that pours quietly.",
    body: "No dashboards demanding attention. One QR, one weekly email, alerts only when something needs a human. The best tool is the one you forget is working.",
  },
] as const;

const TIMELINE = [
  {
    phase: "Phase 1",
    status: "served",
    title: "The wedge",
    body: "The ungated review funnel, the feedback inbox, the auto-built CRM, the dashboard. The QR earns its spot on the counter.",
  },
  {
    phase: "Phase 2",
    status: "served",
    title: "Notifications & trust",
    body: "Complaint alerts in the owner's inbox within the minute, the Monday digest, password resets, rate limiting — the plumbing of reliability.",
  },
  {
    phase: "Phase 3",
    status: "brewing",
    title: "Loyalty rewards",
    body: "A rewards catalog and staff-verifiable redemptions on top of the visit-driven tiers owners already control.",
  },
  {
    phase: "Phase 4",
    status: "on the menu",
    title: "Campaigns",
    body: "Winback, birthday and VIP automations over email, SMS and WhatsApp — consent-first, quiet-hours aware, with honest ROI numbers.",
  },
  {
    phase: "Phase 5",
    status: "on the menu",
    title: "A quiet AI sous-chef",
    body: "Suggested replies to complaints and a weekly “what guests actually said” summary. Drafts, not decisions — the owner stays the voice.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mkt mkt-grain">
      <SiteNav />

      <main>
        {/* ============================ MANIFESTO HERO */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="mkt-ring absolute -right-20 top-24 h-72 w-72 opacity-60" />
          <div aria-hidden className="mkt-ring absolute -left-24 bottom-0 h-56 w-56 opacity-40" />

          <div className="mx-auto max-w-4xl px-5 pb-20 pt-36 text-center sm:px-8 lg:pb-28 lg:pt-44">
            <p className="mkt-eyebrow mkt-fade-up text-ember" style={{ "--d": "80ms" } as React.CSSProperties}>
              about loyaltycrm
            </p>
            <h1 className="f-display mkt-fade-up mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl" style={{ "--d": "200ms" } as React.CSSProperties}>
              Hospitality&apos;s oldest habit,
              <br />
              <span className="italic text-ember">finally in software.</span>
            </h1>
            <p className="mkt-fade-up mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-ink-soft" style={{ "--d": "380ms" } as React.CSSProperties}>
              Great owners have always known their regulars — the orders, the
              birthdays, the bad day that needed a free refill. Chains bought
              software to fake that memory. Independents deserve the real
              thing, minus the enterprise price tag.
            </p>
          </div>
        </section>

        {/* ============================ ORIGIN STORY */}
        <section className="border-y border-ink/10 bg-cream py-20 lg:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal direction="left">
              <Parallax speed={-0.05}>
                <div className="relative mx-auto max-w-xs rotate-[-2deg]">
                  <div className="rounded-3xl border border-ink/10 bg-paper p-7 shadow-[0_40px_80px_-40px_rgb(33_23_17/0.4)]">
                    <p className="f-mono text-[10px] uppercase tracking-[0.2em] text-ember">tuesday · 21:47</p>
                    <div className="mt-3 flex gap-1 text-2xl" aria-hidden>
                      <span className="text-gold">★</span>
                      <span className="text-ink/15">★★★★</span>
                    </div>
                    <p className="f-display mt-3 text-lg italic leading-snug text-ink">
                      “Waited 25 minutes. Nobody even acknowledged us. Never
                      coming back.”
                    </p>
                    <div className="mkt-rule mt-5 text-ink" />
                    <p className="f-mono mt-3 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      seen by the owner: 3 days later
                    </p>
                    <p className="f-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-faint">
                      seen by everyone else: forever
                    </p>
                  </div>
                </div>
              </Parallax>
            </Reveal>

            <Reveal direction="right" delay={120}>
              <p className="mkt-eyebrow text-ember">why we exist</p>
              <h2 className="f-display mt-4 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-4xl">
                It started with a review the owner read three days too late.
              </h2>
              <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
                <p>
                  The guest had a bad night. The kitchen was slammed, nobody
                  noticed her table, and the apology she deserved never came —
                  so the internet got it instead. One star, permanent, public.
                  The owner would have fixed it in ninety seconds with a warm
                  refill and a “this one&apos;s on us.” He just never got the chance.
                </p>
                <p>
                  LoyaltyCRM is that chance, systematized. A QR at the table
                  that gives every guest a direct line to the owner <em>and</em> a
                  public option — both, always, in that order of speed. The
                  complaint arrives while the guest is still parking. The
                  praise flows to Google. And every check-in quietly builds the
                  guest book great owners always kept in their heads.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ============================ PRINCIPLE (moss) */}
        <section className="bg-moss py-20 text-cream lg:py-24">
          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
            <Reveal>
              <p className="mkt-eyebrow text-gold">the line we won&apos;t cross</p>
              <blockquote className="f-display mt-6 text-3xl font-medium italic leading-snug sm:text-4xl">
                “If a tool only works by hiding your unhappy guests, it isn&apos;t
                reputation management — it&apos;s reputation fraud. We built the
                version that survives an audit.”
              </blockquote>
              <p className="f-mono mt-6 text-[10px] uppercase tracking-[0.2em] text-cream/50">
                — the founding note, line one
              </p>
            </Reveal>
          </div>
        </section>

        {/* ============================ VALUES */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <p className="mkt-eyebrow text-ember">house rules</p>
            <h2 className="f-display mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Four rules on the kitchen wall.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {VALUES.map((v, i) => (
              <Reveal key={v.n} delay={i * 110}>
                <div className="group h-full rounded-3xl border border-ink/10 bg-cream p-8 transition-all duration-500 hover:-translate-y-2 hover:border-ember/40 hover:shadow-[0_30px_60px_-30px_rgb(33_23_17/0.3)]">
                  <p className="f-mono text-xs tracking-[0.2em] text-ember">{v.n}</p>
                  <h3 className="f-display mt-3 text-2xl font-semibold">{v.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink-soft">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ============================ TIMELINE */}
        <section className="bg-paper-deep/60 py-24 lg:py-32">
          <div className="mx-auto max-w-4xl px-5 sm:px-8">
            <Reveal>
              <p className="mkt-eyebrow text-ember">the menu ahead</p>
              <h2 className="f-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Built in courses, not promises.
              </h2>
              <p className="mt-4 max-w-xl text-ink-soft">
                Each phase ships when real owners ask for it — usage triggers,
                not roadmap theater.
              </p>
            </Reveal>

            <div className="relative mt-14">
              {/* spine */}
              <div aria-hidden className="absolute bottom-4 left-[7px] top-2 w-px border-l border-dashed border-ink/25 sm:left-[9px]" />
              <div className="space-y-8">
                {TIMELINE.map((item, i) => (
                  <Reveal key={item.phase} delay={i * 90}>
                    <div className="relative pl-10 sm:pl-14">
                      <span
                        aria-hidden
                        className={`absolute left-0 top-1.5 flex h-4 w-4 items-center justify-center rounded-full sm:h-5 sm:w-5 ${
                          item.status === "served" ? "bg-moss" : item.status === "brewing" ? "bg-ember mkt-pulse" : "border-2 border-ink/30 bg-paper"
                        }`}
                      >
                        {item.status === "served" ? <span className="text-[9px] font-bold text-cream">✓</span> : null}
                      </span>
                      <div className="flex flex-wrap items-baseline gap-3">
                        <p className="f-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">{item.phase}</p>
                        <span
                          className={`f-mono rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${
                            item.status === "served"
                              ? "bg-moss/10 text-moss"
                              : item.status === "brewing"
                                ? "bg-ember/10 text-ember"
                                : "bg-ink/5 text-ink-faint"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <h3 className="f-display mt-2 text-2xl font-semibold">{item.title}</h3>
                      <p className="mt-2 max-w-xl leading-relaxed text-ink-soft">{item.body}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================ CTA */}
        <section className="relative overflow-hidden bg-ink py-24 text-cream lg:py-28">
          <Parallax speed={0.12} className="absolute -right-4 top-8">
            <p aria-hidden className="f-display text-9xl text-cream/10">★</p>
          </Parallax>
          <div className="mx-auto max-w-3xl px-5 text-center sm:px-8">
            <Reveal>
              <h2 className="f-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Come be a founding café<span className="text-ember">.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-cream/70">
                Free during the pilot, a lifetime discount after it, and a
                direct line to the people building your software.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-4">
                <Link href="/request-demo" className="mkt-btn mkt-btn-primary px-8 py-4 text-base">
                  Request a demo →
                </Link>
                <Link
                  href="/r/demo-cafe"
                  className="mkt-btn px-8 py-4 text-base"
                  style={{ border: "1.5px solid rgb(251 247 238 / 0.4)", color: "var(--color-cream)" }}
                >
                  Try the guest flow
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
