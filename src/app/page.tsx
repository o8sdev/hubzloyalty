import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Counter, Parallax, Reveal } from "@/components/marketing/motion";
import { FunnelDemo } from "@/components/marketing/funnel-demo";

// ---------------------------------------------------------------------------
// Public landing page — "café print" editorial: paper, espresso ink, burnt
// ember, awning moss. Display serif + grotesk body + receipt mono.
// ---------------------------------------------------------------------------

const MARQUEE_REVIEWS = [
  { stars: 5, text: "best flat white in the neighborhood" },
  { stars: 5, text: "the staff remembers my order" },
  { stars: 4, text: "cozy spot, fast service" },
  { stars: 5, text: "my daily stop before work" },
  { stars: 5, text: "seasonal menu is fantastic" },
  { stars: 4, text: "packed but never chaotic" },
  { stars: 5, text: "they fixed my order before I even asked" },
] as const;

const STEPS = [
  {
    n: "01",
    title: "Stick the code where trays land.",
    body: "Print your QR from Settings and put it on the counter, the receipts, table 12. No app for guests to download, no hardware to buy — a phone camera is the whole install.",
    tag: "print · place · pour",
  },
  {
    n: "02",
    title: "Guests rate in ten seconds.",
    body: "One tap on the stars. Every guest — delighted or furious — sees the same two doors: a public Google review and a private line to you. Complaints reach your inbox and your email before they reach the internet.",
    tag: "ungated, always",
  },
  {
    n: "03",
    title: "Your list grows while you pour.",
    body: "Guests can join your loyalty list right in the flow: name, birthday, real marketing consent. Visits become points, points become tiers, tiers become people who come back.",
    tag: "consent-first CRM",
  },
] as const;

const FEATURES = [
  {
    eyebrow: "Feedback inbox",
    title: "Bad nights knock privately.",
    body: "A 2-star tap emails you within the minute and files the note in a work-through inbox. Resolve it with a coffee on the house, not a public apology under a 1-star review.",
    bullets: ["Instant complaint alert emails", "New / resolved workflow", "Rating-neutral by design"],
  },
  {
    eyebrow: "Customer CRM",
    title: "A guest list you actually own.",
    body: "Every check-in builds a real database — names, birthdays, visit counts, tags, spend. Search it, segment it, export it as CSV. It never belongs to a platform.",
    bullets: ["Auto-built from the funnel", "Tags, notes, birthdays", "One-click CSV export"],
  },
  {
    eyebrow: "Loyalty rules",
    title: "Your café, your economics.",
    body: "Points per visit, Silver, Gold and VIP thresholds — you set them, per business. Change the rules and every guest's tier recalculates on the spot.",
    bullets: ["Per-business configuration", "Visit-driven tiers", "Never points-for-reviews"],
  },
  {
    eyebrow: "Weekly digest",
    title: "Monday morning, the numbers pour themselves.",
    body: "Scans, average rating, Google clicks, new contacts — one email a week. You live in your inbox, not in dashboards. We meet you there.",
    bullets: ["Scans & average rating", "Google review clicks", "New loyalty contacts"],
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      "A regular had a terrible Tuesday — wrong order, twice. I knew before she left the parking lot and called her. She's still a regular.",
    name: "Maya K.",
    role: "owner, corner café · pilot",
  },
  {
    quote:
      "We went from begging for reviews to 30-something a month. The QR does the asking so my staff doesn't have to.",
    name: "Dario R.",
    role: "restaurant manager · pilot",
  },
  {
    quote:
      "The list is the thing. Eight hundred names with real consent — that's mine now, not an aggregator's.",
    name: "Lin T.",
    role: "bakery owner · pilot",
  },
] as const;

const FAQS = [
  {
    q: "Is this review gating? That's against Google's rules.",
    a: "No — and that's the point. Review gating (only steering happy customers to Google) violates Google policy and the FTC's rule on consumer reviews. Our funnel shows every guest both options at every rating. Emphasis adapts; options never change. It's compliant by architecture, not by promise.",
  },
  {
    q: "What does a guest actually have to do?",
    a: "Point their phone camera at the QR, tap a star count, done. Leaving a comment, clicking through to Google, or joining your loyalty list are optional extras in the same 20-second flow. No app, no account.",
  },
  {
    q: "What hardware do I need?",
    a: "None. Print the QR (we generate it, sized for counters and receipts) and place it. Guests bring the hardware in their pockets.",
  },
  {
    q: "Who owns the customer data?",
    a: "You do. Names, birthdays, visit history and consent flags are your records — export everything as CSV whenever you like. Marketing consent is explicit opt-in and is never flipped by the public funnel.",
  },
  {
    q: "How long does setup take?",
    a: "About ten minutes: create your account, paste your Google review link, print the QR. The customer list starts building with the first scan.",
  },
  {
    q: "Can I cancel?",
    a: "Anytime. Export your list first — it leaves with you.",
  },
] as const;

function Stars({ count, className = "h-3.5 w-3.5" }: { count: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={`${className} ${i <= count ? "fill-gold" : "fill-ink/15"}`} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

function HeroWords({ text, startDelay = 0, className }: { text: string; startDelay?: number; className?: string }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i}>
          <span className="mkt-word">
            <span style={{ "--d": `${startDelay + i * 90}ms` } as React.CSSProperties}>{word}</span>
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect(session.platformAdmin && !session.businessId ? "/admin" : "/dashboard");

  return (
    <div className="mkt mkt-grain">
      <SiteNav />

      <main>
        {/* ================================================== HERO */}
        <section className="relative overflow-hidden">
          {/* décor: coffee rings */}
          <div aria-hidden className="mkt-ring absolute -left-24 top-40 h-72 w-72 opacity-70" />
          <div aria-hidden className="mkt-ring absolute -right-16 -top-10 h-56 w-56 opacity-50" />

          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:pb-28 lg:pt-40">
            <div>
              <p className="mkt-eyebrow mkt-fade-up text-ember" style={{ "--d": "80ms" } as React.CSSProperties}>
                for cafés, restaurants &amp; the people who run them
              </p>

              <h1 className="f-display mt-5 text-[2.9rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-[4.4rem]">
                <HeroWords text="Turn one-time guests" startDelay={150} />
                <br />
                <HeroWords text="into" startDelay={600} />{" "}
                <span className="mkt-word">
                  <span className="italic text-ember" style={{ "--d": "700ms" } as React.CSSProperties}>
                    regulars.
                  </span>
                </span>
              </h1>

              <p className="mkt-fade-up mt-6 max-w-xl text-lg leading-relaxed text-ink-soft" style={{ "--d": "900ms" } as React.CSSProperties}>
                A QR code on your counter that collects Google reviews, catches
                complaints before they go public, and quietly builds the
                customer list your café never had.
              </p>

              <div className="mkt-fade-up mt-9 flex flex-wrap items-center gap-4" style={{ "--d": "1050ms" } as React.CSSProperties}>
                <Link href="/register" className="mkt-btn mkt-btn-primary px-7 py-3.5 text-base">
                  Start free
                  <span aria-hidden>→</span>
                </Link>
                <Link href="/r/demo-cafe" className="mkt-btn mkt-btn-ghost px-7 py-3.5 text-base">
                  Scan the live demo
                </Link>
              </div>

              <div className="mkt-fade-up mt-10 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ "--d": "1200ms" } as React.CSSProperties}>
                <span className="flex items-center gap-2 text-sm text-ink-soft">
                  <Stars count={5} /> ungated &amp; policy-compliant
                </span>
                <span className="f-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                  10-second guest flow · no app · no hardware
                </span>
              </div>
            </div>

            {/* Phone demo + floating chips */}
            <div className="relative">
              <Parallax speed={-0.06}>
                <Reveal direction="scale" delay={250}>
                  <FunnelDemo />
                </Reveal>
              </Parallax>

              <Parallax speed={0.12} className="absolute -left-6 top-8 hidden sm:block lg:-left-14">
                <div className="mkt-bob rounded-2xl border border-ink/10 bg-cream px-4 py-3 shadow-[0_18px_40px_-20px_rgb(33_23_17/0.4)]" style={{ "--tilt": "-4deg" } as React.CSSProperties}>
                  <p className="f-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">this month</p>
                  <p className="f-display text-2xl font-semibold text-ink">+38 <span className="text-sm font-normal">Google reviews</span></p>
                </div>
              </Parallax>

              <Parallax speed={0.2} className="absolute -right-2 bottom-24 hidden sm:block lg:-right-10">
                <div className="mkt-bob rounded-2xl bg-moss px-4 py-3 text-cream shadow-[0_18px_40px_-20px_rgb(23_54_39/0.6)]" style={{ "--tilt": "3deg", "--d": "600ms" } as React.CSSProperties}>
                  <p className="f-mono text-[10px] uppercase tracking-[0.14em] text-cream/60">table 12</p>
                  <p className="text-sm font-semibold">Sofia checked in · 🎂 saved</p>
                </div>
              </Parallax>

              <Parallax speed={0.16} className="absolute -bottom-4 left-4 hidden sm:block">
                <div className="mkt-bob rounded-full bg-ember px-4 py-2 text-cream shadow-[0_14px_30px_-14px_rgb(212_85_30/0.8)]" style={{ "--tilt": "-2deg", "--d": "300ms" } as React.CSSProperties}>
                  <p className="f-mono text-[10px] uppercase tracking-[0.14em]">complaint intercepted ✓</p>
                </div>
              </Parallax>
            </div>
          </div>
        </section>

        {/* ================================================== MARQUEE */}
        <section aria-label="Guest reviews ticker" className="border-y border-ink/10 bg-cream py-4">
          <div className="overflow-hidden">
            <div className="mkt-marquee gap-10">
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-10">
                  {MARQUEE_REVIEWS.map((r, i) => (
                    <span key={`${copy}-${i}`} className="flex items-center gap-3 whitespace-nowrap">
                      <Stars count={r.stars} />
                      <span className="f-display text-lg italic text-ink-soft">“{r.text}”</span>
                      <span aria-hidden className="text-ember">✳</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================== HOW IT WORKS */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <p className="mkt-eyebrow text-ember">how it works</p>
            <h2 className="f-display mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Three steps. Zero new habits<span className="text-ember">.</span>
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-6 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 140} className="group relative">
                <div className="relative h-full rounded-3xl border border-ink/10 bg-cream p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_-30px_rgb(33_23_17/0.35)]">
                  <p className="f-display text-[5.5rem] font-semibold leading-none text-ember/15 transition-colors duration-500 group-hover:text-ember/30">
                    {step.n}
                  </p>
                  <h3 className="f-display mt-2 text-2xl font-semibold leading-snug">{step.title}</h3>
                  <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">{step.body}</p>
                  <div className="mkt-rule mt-6 text-ink" />
                  <p className="f-mono mt-4 text-[10px] uppercase tracking-[0.2em] text-ink-faint">{step.tag}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================================================== PRODUCT TOUR */}
        <section id="product" className="bg-paper-deep/60 py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal>
              <p className="mkt-eyebrow text-ember">the product</p>
              <h2 className="f-display mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                Software that works the room while you work the pass.
              </h2>
            </Reveal>

            <div className="mt-16 space-y-6">
              {FEATURES.map((f, i) => (
                <Reveal key={f.eyebrow} delay={80}>
                  <div className={`grid items-center gap-8 rounded-3xl border border-ink/10 bg-cream p-8 sm:p-10 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                    <div>
                      <p className="mkt-eyebrow text-moss">{f.eyebrow}</p>
                      <h3 className="f-display mt-3 text-3xl font-semibold leading-tight">{f.title}</h3>
                      <p className="mt-4 leading-relaxed text-ink-soft">{f.body}</p>
                      <ul className="mt-6 space-y-2.5">
                        {f.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-3 text-[0.95rem] text-ink-soft">
                            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-moss text-[9px] font-bold text-cream">✓</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CSS product vignette */}
                    <div className="relative">
                      {i === 0 ? (
                        <div className="space-y-3">
                          <div className="rounded-2xl border border-ink/10 bg-paper p-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <Stars count={2} />
                              <span className="f-mono rounded-full bg-ember/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-ember">new</span>
                            </div>
                            <p className="mt-2 text-sm text-ink-soft">“Waited 25 minutes for two lattes…”</p>
                            <p className="f-mono mt-2 text-[9px] uppercase tracking-[0.14em] text-ink-faint">alert emailed · 42s ago</p>
                          </div>
                          <div className="rounded-2xl border border-ink/10 bg-paper p-4 opacity-70 shadow-sm">
                            <div className="flex items-center justify-between">
                              <Stars count={3} />
                              <span className="f-mono rounded-full bg-moss/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-moss">resolved</span>
                            </div>
                            <p className="mt-2 text-sm text-ink-soft">“Music way too loud and my croissant…”</p>
                            <p className="f-mono mt-2 text-[9px] uppercase tracking-[0.14em] text-ink-faint">coffee on the house · closed</p>
                          </div>
                        </div>
                      ) : i === 1 ? (
                        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper shadow-sm">
                          {[
                            { n: "Sofia M.", v: "23 visits", t: "VIP", tone: "bg-ember text-cream" },
                            { n: "Omar K.", v: "12 visits", t: "GOLD", tone: "bg-gold/80 text-ink" },
                            { n: "Yuki T.", v: "6 visits", t: "SILVER", tone: "bg-ink/10 text-ink" },
                            { n: "Priya S.", v: "2 visits", t: "BRONZE", tone: "bg-paper-deep text-ink-soft" },
                          ].map((row, ri) => (
                            <div key={row.n} className={`flex items-center justify-between px-4 py-3 ${ri > 0 ? "border-t border-ink/10" : ""}`}>
                              <div className="flex items-center gap-3">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-moss/15 text-xs font-bold text-moss">{row.n[0]}</span>
                                <div>
                                  <p className="text-sm font-semibold">{row.n}</p>
                                  <p className="f-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">{row.v} · consented ✓</p>
                                </div>
                              </div>
                              <span className={`f-mono rounded-full px-2 py-1 text-[9px] font-bold tracking-[0.1em] ${row.tone}`}>{row.t}</span>
                            </div>
                          ))}
                        </div>
                      ) : i === 2 ? (
                        <div className="rounded-2xl border border-ink/10 bg-paper p-6 shadow-sm">
                          <p className="f-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">loyalty ladder — yours to set</p>
                          <div className="mt-4 flex items-end gap-3">
                            {[
                              { t: "Bronze", h: "h-12", visits: "0+", tone: "bg-paper-deep" },
                              { t: "Silver", h: "h-20", visits: "5+", tone: "bg-ink/15" },
                              { t: "Gold", h: "h-28", visits: "10+", tone: "bg-gold/70" },
                              { t: "VIP", h: "h-36", visits: "20+", tone: "bg-ember" },
                            ].map((bar) => (
                              <div key={bar.t} className="flex flex-1 flex-col items-center gap-2">
                                <div className={`${bar.h} w-full origin-bottom rounded-t-xl ${bar.tone} transition-transform duration-500 hover:scale-y-105`} />
                                <p className="f-mono text-[9px] uppercase tracking-[0.12em] text-ink-faint">{bar.t}</p>
                                <p className="text-xs font-bold">{bar.visits}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-ink/10 bg-paper p-6 shadow-sm">
                          <p className="f-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">mon 08:00 · your week at blue fern</p>
                          <div className="mt-4 space-y-3">
                            {[
                              { k: "Review page scans", v: "112" },
                              { k: "Average rating", v: "4.6 ★" },
                              { k: "Google clicks", v: "31" },
                              { k: "New contacts", v: "24" },
                            ].map((row) => (
                              <div key={row.k} className="flex items-baseline justify-between gap-4">
                                <span className="text-sm text-ink-soft">{row.k}</span>
                                <span className="mkt-rule flex-1 self-center text-ink" />
                                <span className="f-mono text-sm font-bold">{row.v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ================================================== NUMBERS (dark receipt) */}
        <section id="numbers" className="relative overflow-hidden bg-ink py-24 text-cream lg:py-32">
          <div aria-hidden className="mkt-ring absolute -right-20 top-16 h-80 w-80 opacity-40" style={{ borderColor: "rgb(251 247 238 / 0.08)" }} />

          <div className="mx-auto grid max-w-6xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-2">
            <div>
              <Reveal>
                <p className="mkt-eyebrow text-gold">the numbers</p>
                <h2 className="f-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                  The math for a<br />120-cover café<span className="text-gold">.</span>
                </h2>
                <p className="mt-6 max-w-md leading-relaxed text-cream/65">
                  Modeled on our pilot demo café: one counter QR, one busy
                  month. Reviews compound, complaints deflate quietly, and the
                  list — the part you own — never stops growing.
                </p>
              </Reveal>

              <Reveal delay={150}>
                <div className="mt-10 flex flex-wrap gap-8">
                  <div>
                    <p className="f-display text-5xl font-semibold text-gold">
                      <Counter to={4.8} decimals={1} />
                      <span className="text-2xl">★</span>
                    </p>
                    <p className="f-mono mt-1 text-[10px] uppercase tracking-[0.18em] text-cream/50">public avg after 90 days</p>
                  </div>
                  <div>
                    <p className="f-display text-5xl font-semibold text-gold">
                      <Counter to={1.4} decimals={1} suffix="×" />
                    </p>
                    <p className="f-mono mt-1 text-[10px] uppercase tracking-[0.18em] text-cream/50">repeat-visit lift w/ loyalty</p>
                  </div>
                </div>
              </Reveal>
            </div>

            {/* The receipt */}
            <Reveal direction="right" delay={100}>
              <Parallax speed={-0.05}>
                <div className="mkt-receipt mx-auto max-w-sm rotate-[1.5deg] bg-cream px-8 py-10 text-ink shadow-[0_50px_100px_-40px_rgb(0_0_0/0.6)]">
                  <p className="f-mono text-center text-[10px] uppercase tracking-[0.24em] text-ink-faint">loyaltycrm · month receipt</p>
                  <p className="f-display mt-1 text-center text-xl font-semibold">Blue Fern Cafe</p>
                  <div className="mkt-rule mt-4 text-ink" />

                  <div className="f-mono mt-5 space-y-4 text-sm">
                    {[
                      { k: "QR scans", to: 412, accent: false },
                      { k: "Google reviews", to: 38, accent: true },
                      { k: "Complaints intercepted", to: 9, accent: false },
                      { k: "Contacts captured", to: 214, accent: false },
                      { k: "Birthdays saved", to: 57, accent: false },
                    ].map((row) => (
                      <div key={row.k} className="flex items-baseline justify-between gap-3">
                        <span className="text-ink-soft">{row.k}</span>
                        <span className="mkt-rule flex-1 self-center text-ink" />
                        <span className={`text-base font-bold ${row.accent ? "text-ember" : ""}`}>
                          <Counter to={row.to} />
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mkt-rule mt-6 text-ink" />
                  <div className="f-mono mt-4 flex items-baseline justify-between text-base font-bold">
                    <span>1-star surprises</span>
                    <span className="text-moss">−87%</span>
                  </div>
                  <div className="mkt-rule mt-6 text-ink" />
                  <p className="f-mono mt-5 text-center text-[9px] uppercase leading-relaxed tracking-[0.2em] text-ink-faint">
                    served by loyaltycrm<br />no gating added · ever
                  </p>
                  <p className="mt-3 text-center text-lg tracking-[0.3em] text-gold" aria-hidden>★★★★★</p>
                </div>
              </Parallax>
            </Reveal>
          </div>
        </section>

        {/* ================================================== COMPLIANCE */}
        <section className="bg-moss py-24 text-cream lg:py-28">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <Reveal>
                  <p className="mkt-eyebrow text-gold">compliance is the feature</p>
                  <h2 className="f-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                    Ungated by design<span className="text-gold">.</span>
                  </h2>
                  <p className="mt-6 max-w-lg leading-relaxed text-cream/75">
                    “Review gating” — nudging only happy guests toward Google —
                    violates Google policy and the FTC&apos;s consumer review rule.
                    Platforms delist gated reviews; regulators fine for them. We
                    never gate: every guest sees both doors. We just make both
                    doors beautiful.
                  </p>
                </Reveal>
                <Reveal delay={150}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {["Google review policy ✓", "FTC 16 CFR Part 465 ✓", "Opt-in consent only ✓", "No points for reviews ✓"].map((chip) => (
                      <span key={chip} className="f-mono rounded-full border border-cream/25 px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-cream/85">
                        {chip}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>

              <Reveal direction="right" delay={120}>
                <div className="relative mx-auto max-w-sm">
                  <div className="rounded-3xl border border-cream/20 bg-moss-dark p-7">
                    <p className="f-mono text-[10px] uppercase tracking-[0.2em] text-cream/50">every rating · every guest</p>
                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl bg-cream px-5 py-4 text-ink shadow-lg">
                        <p className="text-sm font-bold">Door № 1 — public</p>
                        <p className="mt-0.5 text-sm text-ink-soft">Share it in a Google review</p>
                      </div>
                      <div className="rounded-xl bg-cream px-5 py-4 text-ink shadow-lg">
                        <p className="text-sm font-bold">Door № 2 — private</p>
                        <p className="mt-0.5 text-sm text-ink-soft">Send a note straight to the owner</p>
                      </div>
                    </div>
                    <p className="f-mono mt-5 text-center text-[10px] uppercase tracking-[0.18em] text-gold">
                      shown together, at 1★ and at 5★
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================================================== TESTIMONIALS */}
        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal>
            <p className="mkt-eyebrow text-ember">from the pass</p>
            <h2 className="f-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Owners talk. We eavesdrop<span className="text-ember">.</span>
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 130}>
                <figure className={`relative h-full rounded-3xl border border-ink/10 bg-cream p-8 transition-transform duration-500 hover:-translate-y-2 ${i === 1 ? "md:translate-y-6" : ""}`}>
                  <span aria-hidden className="f-display absolute -top-5 left-6 text-7xl leading-none text-ember">
                    “
                  </span>
                  <blockquote className="f-display pt-4 text-xl italic leading-relaxed text-ink">
                    {t.quote}
                  </blockquote>
                  <div className="mkt-rule mt-6 text-ink" />
                  <figcaption className="mt-4">
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="f-mono mt-0.5 text-[10px] uppercase tracking-[0.16em] text-ink-faint">{t.role}</p>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================================================== PRICING */}
        <section id="pricing" className="bg-paper-deep/60 py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-5 sm:px-8">
            <Reveal className="text-center">
              <p className="mkt-eyebrow text-ember">pricing</p>
              <h2 className="f-display mx-auto mt-4 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
                One plan. Every table.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-ink-soft">
                No seats, no tiers, no “contact sales”. Less than the cost of
                one lost regular.
              </p>
            </Reveal>

            <div className="mx-auto mt-14 grid max-w-3xl gap-6 md:grid-cols-[1fr_0.85fr]">
              <Reveal direction="left" delay={100}>
                <div className="relative h-full overflow-hidden rounded-3xl bg-moss p-9 text-cream shadow-[0_40px_80px_-40px_rgb(23_54_39/0.8)]">
                  <p className="f-mono text-[10px] uppercase tracking-[0.2em] text-gold">the whole thing</p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="f-display text-6xl font-semibold">$49</span>
                    <span className="text-cream/60">/ month per location</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-cream/70">
                    Free while we&apos;re in pilot — founding cafés keep a lifetime
                    discount when pricing turns on.
                  </p>
                  <Link href="/register" className="mkt-btn mkt-btn-cream mt-8 w-full px-6 py-3.5 text-base">
                    Start free — 10-minute setup
                  </Link>
                  <p className="f-mono mt-4 text-center text-[10px] uppercase tracking-[0.16em] text-cream/50">
                    no card · cancel anytime · csv export forever
                  </p>
                </div>
              </Reveal>

              <Reveal direction="right" delay={200}>
                <div className="mkt-receipt h-full bg-cream px-7 py-8 text-ink shadow-[0_30px_60px_-35px_rgb(33_23_17/0.5)] md:-rotate-1">
                  <p className="f-mono text-center text-[10px] uppercase tracking-[0.22em] text-ink-faint">included</p>
                  <div className="mkt-rule mt-3 text-ink" />
                  <ul className="f-mono mt-4 space-y-2.5 text-[13px]">
                    {[
                      "unlimited QR scans",
                      "unlimited reviews & notes",
                      "complaint alert emails",
                      "weekly owner digest",
                      "full customer CRM + CSV",
                      "loyalty tiers, your rules",
                      "printable QR studio",
                      "unlimited staff accounts",
                    ].map((item) => (
                      <li key={item} className="flex items-baseline justify-between gap-2">
                        <span>{item}</span>
                        <span className="text-moss">✓</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mkt-rule mt-4 text-ink" />
                  <p className="f-mono mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                    gating · never included
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================================================== FAQ */}
        <section id="faq" className="mx-auto max-w-3xl px-5 py-24 sm:px-8 lg:py-32">
          <Reveal className="text-center">
            <p className="mkt-eyebrow text-ember">questions, answered</p>
            <h2 className="f-display mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              Asked over the counter.
            </h2>
          </Reveal>

          <div className="mt-12 space-y-3">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 60}>
                <details className="group rounded-2xl border border-ink/10 bg-cream px-6 transition-colors duration-300 open:border-ember/40">
                  <summary className="flex items-center justify-between gap-4 py-5">
                    <span className="f-display text-lg font-semibold leading-snug">{faq.q}</span>
                    <span className="mkt-plus flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/20 text-lg leading-none text-ink" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="pb-6 leading-relaxed text-ink-soft">{faq.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ================================================== FINAL CTA */}
        <section className="relative overflow-hidden bg-ember py-24 text-cream lg:py-32">
          <div aria-hidden className="mkt-ring absolute -left-16 bottom-0 h-64 w-64 opacity-40" style={{ borderColor: "rgb(251 247 238 / 0.15)" }} />
          <Parallax speed={0.1} className="absolute right-10 top-10 hidden lg:block">
            <p aria-hidden className="f-display text-8xl text-cream/15">★</p>
          </Parallax>

          <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
            <Reveal>
              <h2 className="f-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Your next regular is sitting at table 12 <span className="italic">right now</span>.
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-lg text-cream/80">
                Put the QR down before their coffee goes cold. Ten minutes to
                set up, ten seconds for the guest.
              </p>
            </Reveal>
            <Reveal delay={150}>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link href="/register" className="mkt-btn mkt-btn-ink px-8 py-4 text-base">
                  Start free →
                </Link>
                <Link
                  href="/r/demo-cafe"
                  className="mkt-btn px-8 py-4 text-base"
                  style={{ border: "1.5px solid rgb(251 247 238 / 0.5)", color: "var(--color-cream)" }}
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
