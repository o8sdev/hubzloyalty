"use client";

import { useState } from "react";
import {
  Spinner,
  mktError,
  mktInput as inputClass,
  mktLabel as labelClass,
} from "@/components/marketing/auth";

export function DemoRequestForm() {
  const [form, setForm] = useState({
    businessName: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
  });
  // Bot honeypot: hidden field humans never see or fill. The API silently
  // drops submissions that carry a value.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/public/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone || undefined,
          message: form.message || undefined,
          website: website || undefined,
        }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          setError("Too many requests — please wait a while and try again.");
        } else {
          const data = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(data?.error ?? "Something went wrong — please try again.");
        }
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative rounded-3xl border border-ink/10 bg-cream p-7 shadow-[0_40px_80px_-40px_rgb(33_23_17/0.4)] sm:p-9">
      {done ? (
        <div className="py-10 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-moss text-lg font-bold text-cream"
          >
            ✓
          </span>
          <h2 className="f-display mt-5 text-2xl font-semibold">
            Request received.
          </h2>
          <p className="mx-auto mt-3 max-w-xs leading-relaxed text-ink-soft">
            Thanks — we&apos;ll be in touch as soon as we can.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
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

          <div>
            <label htmlFor="businessName" className={labelClass}>
              Business name *
            </label>
            <input
              id="businessName"
              required
              minLength={2}
              maxLength={100}
              value={form.businessName}
              onChange={update("businessName")}
              placeholder="Blue Fern Café"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="contactName" className={labelClass}>
              Your name *
            </label>
            <input
              id="contactName"
              required
              maxLength={100}
              value={form.contactName}
              onChange={update("contactName")}
              placeholder="Alex Martin"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email *
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={update("email")}
              placeholder="you@yourcafe.com"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              value={form.phone}
              onChange={update("phone")}
              placeholder="Optional — for a quick call"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="message" className={labelClass}>
              Anything we should know?
            </label>
            <textarea
              id="message"
              rows={4}
              maxLength={1000}
              value={form.message}
              onChange={update("message")}
              placeholder="Tables, locations, what you're hoping to fix…"
              className={`${inputClass} resize-y`}
            />
          </div>

          {error ? <p className={mktError}>{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="mkt-btn mkt-btn-primary w-full px-7 py-3.5 text-base disabled:cursor-progress disabled:opacity-75"
          >
            {loading ? (
              <>
                <Spinner />
                Sending your request…
              </>
            ) : (
              <>
                Request a demo <span aria-hidden>→</span>
              </>
            )}
          </button>

          <p className="f-mono text-center text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            we reply shortly · no card, ever
          </p>
        </form>
      )}
    </div>
  );
}
