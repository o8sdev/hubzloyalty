"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Textarea,
  buttonClasses,
} from "@/components/ui";
import { cn } from "@/lib/utils";

// Same star path as StarRating in the UI kit, rendered larger for touch.
const STAR_PATH =
  "M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z";

type Step = "rate" | "actions" | "capture" | "done";

type WelcomeReward = {
  code: string;
  rewardText: string;
  expiresAt: string | null;
};

type CheckinTicket = {
  code: string;
  expiresAt: string;
  tableNumber: string | null;
};

type EarnStatus = "code" | "cooldown" | "capped" | "none";

/**
 * Device-local memory of a completed funnel at this business. Enables
 * one-tap repeat check-ins and resurfaces an unredeemed reward code —
 * without the server ever disclosing whether contact details matched.
 */
type GuestMemory = {
  firstName?: string;
  phone?: string;
  email?: string;
  code?: string;
  rewardText?: string;
  expiresAt?: string;
};

function memoryKey(slug: string) {
  return `lcrm:guest:${slug}`;
}

function readGuestMemory(slug: string): GuestMemory | null {
  try {
    const raw = window.localStorage.getItem(memoryKey(slug));
    return raw ? (JSON.parse(raw) as GuestMemory) : null;
  } catch {
    return null;
  }
}

function writeGuestMemory(slug: string, memory: GuestMemory) {
  try {
    window.localStorage.setItem(memoryKey(slug), JSON.stringify(memory));
  } catch {
    // Private browsing / storage full — memory is a nicety, never a blocker.
  }
}

/** "K7M2FX" → "K7M-2FX" for display. */
function fmtCode(code: string) {
  return code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}

/**
 * The public QR review funnel.
 *
 * COMPLIANCE: this funnel is deliberately UNGATED. Google policy and the FTC
 * prohibit "review gating" (steering only happy customers to Google), so
 * after ANY rating the guest always sees BOTH options — a public Google
 * review AND a private note to the owner. Only the ordering/emphasis adapts
 * to the rating; both options are always present and enabled, and nothing is
 * ever awarded for leaving a review.
 */
export function ReviewFlow({
  slug,
  businessName,
  googleReviewUrl,
  askTableNumber = false,
}: {
  slug: string;
  businessName: string;
  googleReviewUrl: string | null;
  askTableNumber?: boolean;
}) {
  const [step, setStep] = useState<Step>("rate");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState<string | null>(googleReviewUrl);
  const [googleClicked, setGoogleClicked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);

  // Private note
  const [comment, setComment] = useState("");
  const [noteSent, setNoteSent] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);

  // Contact capture
  const [firstName, setFirstName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showExtra, setShowExtra] = useState(false);
  const [consent, setConsent] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  // Welcome reward granted on THIS visit (first-time completers only).
  const [welcomeReward, setWelcomeReward] = useState<WelcomeReward | null>(null);
  // Check-in awaiting staff confirmation (points credit on their tap).
  const [checkinTicket, setCheckinTicket] = useState<CheckinTicket | null>(null);
  const [earnStatus, setEarnStatus] = useState<EarnStatus>("none");
  const [tableNumber, setTableNumber] = useState("");
  // Device memory: this phone completed the funnel here before. Purely
  // device-local — the server never discloses whether contact info matched.
  const [remembered, setRemembered] = useState<GuestMemory | null>(null);

  // Bot honeypot: hidden field humans never see or fill. Sent with every
  // request; the API silently drops submissions that carry a value.
  const [website, setWebsite] = useState("");

  // Restore device memory: prefill the form for a one-tap check-in, and
  // resurface an ungredeemed reward code. A quick status check clears codes
  // that were redeemed or expired since.
  useEffect(() => {
    const stored = readGuestMemory(slug);
    if (!stored) return;
    setRemembered(stored);
    if (stored.firstName) setFirstName(stored.firstName);
    if (stored.phone) setPhone(stored.phone);
    if (stored.email) setEmail(stored.email);

    if (stored.code) {
      const expired = stored.expiresAt
        ? new Date(stored.expiresAt).getTime() < Date.now()
        : false;
      if (expired) {
        const cleaned = { ...stored, code: undefined, rewardText: undefined, expiresAt: undefined };
        writeGuestMemory(slug, cleaned);
        setRemembered(cleaned);
        return;
      }
      fetch(`/api/public/claims/${stored.code}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { status?: string } | null) => {
          if (data && data.status !== "PENDING") {
            const cleaned = { ...stored, code: undefined, rewardText: undefined, expiresAt: undefined };
            writeGuestMemory(slug, cleaned);
            setRemembered(cleaned);
          }
        })
        .catch(() => {});
    }
  }, [slug]);

  async function patchReview(
    body: Record<string, unknown>
  ): Promise<{
    ok: boolean;
    welcomeReward?: WelcomeReward;
    checkin?: CheckinTicket;
    earnStatus?: EarnStatus;
  }> {
    if (!reviewId) return { ok: false };
    try {
      const res = await fetch(`/api/public/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, website: website || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        welcomeReward?: WelcomeReward;
        checkin?: CheckinTicket;
        earnStatus?: EarnStatus;
      };
      return {
        ok: res.ok,
        welcomeReward: data.welcomeReward,
        checkin: data.checkin,
        earnStatus: data.earnStatus,
      };
    } catch {
      return { ok: false };
    }
  }

  async function submitRating(value: number) {
    if (submittingRating) return;
    setSubmittingRating(true);
    setError(null);
    setRating(value);
    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          rating: value,
          website: website || undefined,
        }),
      });
      const data = (await res.json()) as {
        reviewId?: string;
        googleReviewUrl?: string | null;
        error?: string;
      };
      if (!res.ok || !data.reviewId) {
        setError(data.error ?? "Something went wrong — please try again.");
        return;
      }
      setReviewId(data.reviewId);
      setGoogleUrl(data.googleReviewUrl ?? null);
      setStep("actions");
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setSubmittingRating(false);
    }
  }

  async function sendNote(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim() || sendingNote) return;
    setSendingNote(true);
    setError(null);
    const { ok } = await patchReview({ comment: comment.trim() });
    setSendingNote(false);
    if (!ok) {
      setError("Could not send your note — please try again.");
      return;
    }
    setNoteSent(true);
    // Auto-advance to the loyalty capture step after a short beat.
    window.setTimeout(() => setStep("capture"), 900);
  }

  function onGoogleClick() {
    setGoogleClicked(true);
    // Fire-and-forget; the anchor itself handles navigation.
    void patchReview({ clickedGoogle: true });
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    if (savingContact) return;
    setSavingContact(true);
    setError(null);
    const result = await patchReview({
      tableNumber: tableNumber.trim() || undefined,
      customer: {
        firstName: firstName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        birthday: birthday || undefined,
        marketingConsent: consent,
      },
    });
    setSavingContact(false);
    if (!result.ok) {
      setError("Could not save your details — please try again.");
      return;
    }
    if (result.welcomeReward) setWelcomeReward(result.welcomeReward);
    if (result.checkin) setCheckinTicket(result.checkin);
    setEarnStatus(result.earnStatus ?? "none");

    // Remember this guest on-device: prefills the next check-in and keeps
    // their reward code recoverable until it's redeemed or expires.
    const previous = readGuestMemory(slug);
    writeGuestMemory(slug, {
      firstName: firstName.trim() || previous?.firstName,
      phone: phone.trim() || previous?.phone,
      email: email.trim() || previous?.email,
      code: result.welcomeReward?.code ?? previous?.code,
      rewardText: result.welcomeReward?.rewardText ?? previous?.rewardText,
      expiresAt: result.welcomeReward?.expiresAt ?? previous?.expiresAt,
    });

    setContactSaved(true);
    setStep("done");
  }

  const highRating = rating >= 4;
  // A bad visit changes what we ask for and why: an upset guest won't join a
  // "loyalty list", but many WILL leave a number so the owner can fix it —
  // and a same-day callback is the complaint the internet never sees.
  const complaint = rating > 0 && rating <= 3;
  // This device completed the funnel here before → one-tap check-in UX.
  const returning = Boolean(remembered && (remembered.phone || remembered.email));

  // Both blocks below are ALWAYS rendered for every rating (no gating);
  // only order and visual emphasis change.
  const googleBlock = googleUrl ? (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener"
      onClick={onGoogleClick}
      className={buttonClasses(highRating ? "primary" : "secondary", "lg", "w-full")}
    >
      Share it in a Google review
    </a>
  ) : null;

  const privateBlock = (
    <Card className="w-full">
      <CardBody>
        <h2 className="text-sm font-semibold text-slate-900">
          {highRating
            ? "Send a private note to the owner"
            : "Tell us what went wrong"}
        </h2>
        {noteSent ? (
          <p className="mt-2 text-sm font-medium text-green-700">
            Sent — thank you.
          </p>
        ) : (
          <form onSubmit={sendNote} className="mt-2 space-y-2">
            <Textarea
              rows={highRating ? 3 : 4}
              maxLength={2000}
              placeholder="Anything we should know? The owner reads every message."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              type="submit"
              variant={highRating ? "secondary" : "primary"}
              className="w-full"
              disabled={sendingNote || !comment.trim()}
            >
              {sendingNote ? "Sending…" : "Send to the owner"}
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );

  return (
    <div className="mt-8 w-full">
      {/* Honeypot — offscreen, ignored by humans, filled by naive bots. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      {step === "rate" ? (
        <div className="flex flex-col items-center gap-4">
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHovered(0)}
          >
            {[1, 2, 3, 4, 5].map((i) => {
              const filled = i <= (hovered || rating);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`Rate ${i} star${i === 1 ? "" : "s"}`}
                  disabled={submittingRating}
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(0)}
                  onClick={() => submitRating(i)}
                  className="flex h-14 w-14 items-center justify-center rounded-lg transition-transform hover:scale-110 disabled:opacity-50"
                >
                  <svg
                    viewBox="0 0 20 20"
                    className={cn(
                      "h-11 w-11 transition-colors",
                      filled ? "fill-amber-400" : "fill-slate-300"
                    )}
                    aria-hidden
                  >
                    <path d={STAR_PATH} />
                  </svg>
                </button>
              );
            })}
          </div>
          <p className="text-sm text-slate-500">Tap a star to rate your visit</p>
        </div>
      ) : null}

      {step === "actions" ? (
        <div className="flex w-full flex-col items-stretch gap-4">
          <p className="text-center text-lg font-semibold text-slate-900">
            Thanks, {rating} star{rating === 1 ? "" : "s"}!
          </p>
          {highRating ? (
            <>
              {googleBlock}
              {privateBlock}
            </>
          ) : (
            <>
              {privateBlock}
              {googleBlock}
            </>
          )}
          <button
            type="button"
            onClick={() => setStep("capture")}
            className="mx-auto text-sm text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step === "capture" ? (
        <Card className="w-full">
          <CardBody>
            <h2 className="text-base font-semibold text-slate-900">
              {complaint
                ? "Want us to make this right?"
                : returning
                  ? "Welcome back — check in?"
                  : `Join ${businessName}'s loyalty list`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {complaint
                ? "Leave your name and number — the owner reads every note and can call you back personally, usually the same day."
                : returning
                  ? "One tap and this visit lands on your loyalty card."
                  : "Get a birthday treat and the occasional regulars-only offer."}
            </p>
            <form onSubmit={saveContact} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="rf-first-name">First name</Label>
                <Input
                  id="rf-first-name"
                  required
                  maxLength={80}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Alex"
                />
              </div>
              <div>
                <Label htmlFor="rf-phone">
                  {complaint ? "Phone (for the callback)" : "Phone"}
                </Label>
                <Input
                  id="rf-phone"
                  type="tel"
                  required={complaint}
                  maxLength={40}
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 1234"
                />
              </div>
              {askTableNumber ? (
                <div>
                  <Label htmlFor="rf-table">Table number</Label>
                  <Input
                    id="rf-table"
                    maxLength={10}
                    inputMode="numeric"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="e.g. 12"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    So staff can confirm your check-in at the table.
                  </p>
                </div>
              ) : null}
              {showExtra ? (
                <>
                  <div>
                    <Label htmlFor="rf-email">Email</Label>
                    <Input
                      id="rf-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rf-birthday">Birthday</Label>
                    <Input
                      id="rf-birthday"
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowExtra(true)}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  + Add email &amp; birthday (optional)
                </button>
              )}
              {/* The callback is a service follow-up, not marketing — so for
                  complaints the opt-in is genuinely optional. Joining the
                  loyalty list IS the marketing relationship, so there it
                  stays required. Consent is never pre-checked. Returning
                  guests already answered it on their first visit (the server
                  never mutates matched customers from this endpoint). */}
              {returning ? null : (
                <label className="flex items-start gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    required={!complaint}
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    I agree to receive occasional marketing messages from{" "}
                    {businessName}. Reply STOP anytime.
                    {complaint ? (
                      <span className="text-slate-400">
                        {" "}
                        (Optional — the callback happens either way.)
                      </span>
                    ) : null}
                  </span>
                </label>
              )}
              <Button type="submit" className="w-full" disabled={savingContact}>
                {savingContact
                  ? "Saving…"
                  : complaint
                    ? "Request a callback"
                    : returning
                      ? "Check in"
                      : "Join the list"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("done")}
              >
                {complaint ? "No thanks, just my note" : "No thanks"}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      {step === "done" ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              viewBox="0 0 24 24"
              className="h-9 w-9 stroke-green-600"
              fill="none"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-slate-900">
            {complaint && contactSaved
              ? `Thank you — ${businessName} will reach out to make this right.`
              : contactSaved && earnStatus === "cooldown"
                ? "Welcome back — this visit was already counted today ✓"
                : contactSaved && earnStatus === "capped"
                  ? "You've hit today's check-in limit — see you tomorrow!"
                  : returning && contactSaved
                    ? "Welcome back!"
                    : "You're all set — see you soon!"}
          </p>

          {/* Welcome reward ticket — granted for JOINING THE LIST (first
              completion), identical at every rating; never for the review.
              Confirming this ONE code at the counter also counts the visit. */}
          {welcomeReward ? (
            <div className="w-full max-w-xs rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 px-5 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                🎁 Welcome gift for joining
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {welcomeReward.rewardText}
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-[0.12em] text-slate-900">
                {fmtCode(welcomeReward.code)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Show this code when you order or pay — you&apos;ll get the gift
                and your first visit counts.
                {welcomeReward.expiresAt
                  ? ` Valid until ${new Date(welcomeReward.expiresAt).toLocaleDateString()}.`
                  : ""}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                We&apos;ve saved it on this device too.
              </p>
            </div>
          ) : checkinTicket ? (
            <div className="w-full max-w-xs rounded-2xl border-2 border-dashed border-brand-400 bg-brand-50 px-5 py-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-800">
                ✓ Your check-in code
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-[0.12em] text-slate-900">
                {fmtCode(checkinTicket.code)}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Show this when you order or pay
                {checkinTicket.tableNumber
                  ? ` (table ${checkinTicket.tableNumber})`
                  : ""}{" "}
                — your visit and points count when staff confirm it.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Valid for 2 hours. Re-scan anytime to see it again.
              </p>
            </div>
          ) : remembered?.code ? (
            <div className="w-full max-w-xs rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-5 py-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                Your welcome gift is still waiting
              </p>
              <p className="mt-1 text-sm text-slate-700">{remembered.rewardText}</p>
              <p className="mt-2 font-mono text-2xl font-bold tracking-[0.12em] text-slate-900">
                {fmtCode(remembered.code)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Show it at the counter to claim
                {remembered.expiresAt
                  ? ` — valid until ${new Date(remembered.expiresAt).toLocaleDateString()}`
                  : ""}
                .
              </p>
            </div>
          ) : null}
          {/* Rating-neutral by design: re-offering the Google link only to
              high raters would be review gating. */}
          {googleUrl && !googleClicked ? (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener"
              onClick={onGoogleClick}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Still have a minute? Share it in a Google review
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
