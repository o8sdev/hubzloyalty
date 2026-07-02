import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// Outbound email via Resend's REST API (no SDK dependency). Every send is
// recorded in EmailLog. Without RESEND_API_KEY the message is logged to the
// console instead of sent (status DEV_LOGGED) so dev flows — e.g. password
// reset links — remain usable.
//
// sendMail NEVER throws: callers fire it from request handlers where a mail
// outage must not fail the user-facing operation.
// ---------------------------------------------------------------------------

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export const MAIL_KINDS = [
  "COMPLAINT_ALERT",
  "WEEKLY_DIGEST",
  "PASSWORD_RESET",
  "DEMO_REQUEST",
  "TEST",
] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export type MailStatus = "SENT" | "FAILED" | "DEV_LOGGED";

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  /** Plain-text alternative; also what DEV_LOGGED prints to the console. */
  text?: string;
  kind: MailKind;
  businessId?: string | null;
}): Promise<{ ok: boolean; status: MailStatus }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "LoyaltyCRM <onboarding@resend.dev>";

  let status: MailStatus;
  let error: string | null = null;

  if (!apiKey) {
    status = "DEV_LOGGED";
    console.log(
      `[mail:dev] kind=${opts.kind} to=${opts.to} subject="${opts.subject}"\n` +
        (opts.text ?? "(html only)")
    );
  } else {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [opts.to],
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      });
      if (res.ok) {
        status = "SENT";
      } else {
        status = "FAILED";
        error = `Resend ${res.status}: ${(await res.text()).slice(0, 500)}`;
        console.error("sendMail failed", error);
      }
    } catch (err) {
      status = "FAILED";
      error = String(err).slice(0, 500);
      console.error("sendMail failed", err);
    }
  }

  try {
    await db.emailLog.create({
      data: {
        to: opts.to,
        subject: opts.subject,
        kind: opts.kind,
        status,
        error,
        businessId: opts.businessId ?? null,
      },
    });
  } catch (logErr) {
    // Logging must never break the send path either.
    console.error("EmailLog write failed", logErr);
  }

  return { ok: status !== "FAILED", status };
}

// ---------------------------------------------------------------------------
// Minimal branded template. Inline styles only (email clients ignore <style>).
// ---------------------------------------------------------------------------

export function renderEmail(opts: {
  heading: string;
  /** Pre-escaped HTML body paragraphs. Use escapeHtml() on user content. */
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#0f4c81">
           <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${opts.ctaLabel}</a>
         </td></tr></table>`
      : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
      <tr><td style="padding:0 0 16px 4px;font-size:15px;font-weight:700;color:#0f4c81">LoyaltyCRM</td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
        <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">${opts.heading}</h1>
        <div style="font-size:14px;line-height:1.6;color:#334155">${opts.bodyHtml}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:16px 4px;font-size:12px;color:#94a3b8">${opts.footer ?? "You are receiving this because you have a LoyaltyCRM account."}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}
