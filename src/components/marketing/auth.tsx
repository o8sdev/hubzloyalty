import Link from "next/link";
import { HubzWordmark } from "@/components/brand";

// ---------------------------------------------------------------------------
// Shared café-print auth surface: the login / forgot / reset / set-password
// pages all render inside AuthShell so the whole entry experience matches the
// marketing site (paper, espresso ink, ember accent, Space Grotesk type).
// ---------------------------------------------------------------------------

/** Form controls styled for the .mkt marketing surface (paper/ink palette). */
export const mktInput =
  "w-full rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-[0.95rem] text-ink placeholder:text-ink-faint transition-colors duration-300 focus:border-ember focus:outline-none focus:ring-2 focus:ring-ember/20";

export const mktLabel =
  "f-mono mb-1.5 block text-[10px] uppercase tracking-[0.18em] text-ink-faint";

export const mktError =
  "rounded-xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-ember-deep";

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Primary submit button with an honest busy state: spinner + progress label,
 * locked against double-submits. Pass `loading` for the request in flight.
 */
export function AuthSubmitButton({
  loading,
  loadingLabel,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-busy={loading}
      className="mkt-btn mkt-btn-primary w-full px-7 py-3.5 text-base disabled:cursor-progress disabled:opacity-75"
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  below,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Rendered under the card — links like "Request a demo". */
  below?: React.ReactNode;
}) {
  return (
    <div className="mkt mkt-grain">
      <main className="relative flex min-h-screen flex-col overflow-hidden px-5 py-8">
        {/* décor: coffee rings + a floating star, same language as the landing */}
        <div aria-hidden className="mkt-ring absolute -left-24 top-32 h-72 w-72 opacity-60" />
        <div aria-hidden className="mkt-ring absolute -right-16 bottom-16 h-56 w-56 opacity-50" />
        <p aria-hidden className="f-display mkt-bob absolute right-[12%] top-[18%] hidden text-5xl text-gold/60 sm:block">
          ★
        </p>

        <header className="mkt-fade-up relative" style={{ "--d": "60ms" } as React.CSSProperties}>
          <Link href="/" className="inline-flex">
            <HubzWordmark variant="light" imgClassName="h-7 w-auto" />
          </Link>
        </header>

        <div className="relative mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-10">
          <div
            className="mkt-fade-up rounded-3xl border border-ink/10 bg-cream p-8 shadow-[0_40px_80px_-40px_rgb(33_23_17/0.45)] sm:p-9"
            style={{ "--d": "160ms" } as React.CSSProperties}
          >
            <p className="mkt-eyebrow text-ember">{eyebrow}</p>
            <h1 className="f-display mt-3 text-3xl font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{subtitle}</p>
            ) : null}
            <div className="mt-7">{children}</div>
          </div>

          {below ? (
            <div
              className="mkt-fade-up mt-6 text-center text-sm text-ink-soft"
              style={{ "--d": "300ms" } as React.CSSProperties}
            >
              {below}
            </div>
          ) : null}

          <p
            className="f-mono mkt-fade-up mt-8 text-center text-[10px] uppercase tracking-[0.18em] text-ink-faint"
            style={{ "--d": "380ms" } as React.CSSProperties}
          >
            ungated · policy-compliant · your list stays yours
          </p>
        </div>
      </main>
    </div>
  );
}
