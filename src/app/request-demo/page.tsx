import type { Metadata } from "next";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { DemoRequestForm } from "./demo-request-form";

export const metadata: Metadata = {
  title: "Request a demo — HUBz Loyalty",
  description:
    "We onboard every café personally. Request a demo, we'll reach out, set you up, and hand you your login.",
};

const NEXT_STEPS = [
  {
    n: "01",
    title: "We reach out",
    body: "A short call or email — usually within a day or two — to hear how your café runs and show you the funnel live.",
  },
  {
    n: "02",
    title: "We set you up",
    body: "Your account, your loyalty rules, your Google review link and a print-ready QR — configured for you, not by you.",
  },
  {
    n: "03",
    title: "You get your login",
    body: "Sign in, put the QR on the counter, and watch the guest list start building itself.",
  },
] as const;

export default function RequestDemoPage() {
  return (
    <div className="mkt mkt-grain">
      <SiteNav />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="mkt-ring absolute -right-20 top-24 h-72 w-72 opacity-60" />
          <div aria-hidden className="mkt-ring absolute -left-24 bottom-8 h-56 w-56 opacity-40" />

          <div className="mx-auto grid max-w-6xl items-start gap-14 px-5 pb-24 pt-32 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-40">
            {/* Pitch */}
            <div>
              <p className="mkt-eyebrow mkt-fade-up text-ember" style={{ "--d": "80ms" } as React.CSSProperties}>
                request a demo
              </p>
              <h1
                className="f-display mkt-fade-up mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
                style={{ "--d": "200ms" } as React.CSSProperties}
              >
                See it in <span className="italic text-ember">your</span> café.
              </h1>
              <p
                className="mkt-fade-up mt-6 max-w-lg text-lg leading-relaxed text-ink-soft"
                style={{ "--d": "360ms" } as React.CSSProperties}
              >
                We onboard every business personally — no self-serve forms into
                the void. Request a demo, we&apos;ll reach out, set everything
                up, and hand you your login.
              </p>

              <div className="mkt-fade-up mt-12 space-y-7" style={{ "--d": "520ms" } as React.CSSProperties}>
                {NEXT_STEPS.map((step) => (
                  <div key={step.n} className="flex gap-5">
                    <p className="f-mono pt-1 text-xs tracking-[0.2em] text-ember">{step.n}</p>
                    <div>
                      <h2 className="f-display text-xl font-semibold">{step.title}</h2>
                      <p className="mt-1.5 max-w-md text-[0.95rem] leading-relaxed text-ink-soft">
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p
                className="f-mono mkt-fade-up mt-12 text-[10px] uppercase tracking-[0.18em] text-ink-faint"
                style={{ "--d": "660ms" } as React.CSSProperties}
              >
                free during the pilot · ungated &amp; policy-compliant · your list stays yours
              </p>
            </div>

            {/* Form */}
            <div className="mkt-fade-up" style={{ "--d": "440ms" } as React.CSSProperties}>
              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
