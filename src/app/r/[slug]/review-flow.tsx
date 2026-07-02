"use client";

import { useState } from "react";
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
}: {
  slug: string;
  businessName: string;
  googleReviewUrl: string | null;
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

  // Bot honeypot: hidden field humans never see or fill. Sent with every
  // request; the API silently drops submissions that carry a value.
  const [website, setWebsite] = useState("");

  async function patchReview(body: Record<string, unknown>): Promise<boolean> {
    if (!reviewId) return false;
    try {
      const res = await fetch(`/api/public/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, website: website || undefined }),
      });
      return res.ok;
    } catch {
      return false;
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
    const ok = await patchReview({ comment: comment.trim() });
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
    const ok = await patchReview({
      customer: {
        firstName: firstName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        birthday: birthday || undefined,
        marketingConsent: consent,
      },
    });
    setSavingContact(false);
    if (!ok) {
      setError("Could not save your details — please try again.");
      return;
    }
    setStep("done");
  }

  const highRating = rating >= 4;

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
              {`Join ${businessName}'s loyalty list`}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Get a birthday treat and the occasional regulars-only offer.
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
                <Label htmlFor="rf-phone">Phone</Label>
                <Input
                  id="rf-phone"
                  type="tel"
                  maxLength={40}
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 000 1234"
                />
              </div>
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
              <label className="flex items-start gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  I agree to receive occasional marketing messages from{" "}
                  {businessName}. Reply STOP anytime.
                </span>
              </label>
              <Button type="submit" className="w-full" disabled={savingContact}>
                {savingContact ? "Saving…" : "Join the list"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("done")}
              >
                No thanks
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
            {"You're all set — see you soon!"}
          </p>
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
