# Development Roadmap — LoyaltyCRM

Phases are gated by *usage triggers*, not by the calendar. The founder's time
during Phases 1–2 is mostly sales/concierge, not code.

## Phase 1 — The wedge (BUILT)

Auth, business profile + Google review link + QR code, **ungated public
review funnel** (rate → Google + private note → optional loyalty opt-in),
feedback inbox, customer CRM (auto-populated by the funnel; manual
add/edit/visit-log/CSV export), dashboard with needs-attention list, demo
seed data.

**Exit criteria:** 1–3 pilot cafes live; owner can answer "how many Google
reviews and intercepted complaints this month?" from the dashboard.

## Phase 2 — Notifications & trust (BUILT except deploy)

- ✅ Complaint alert email to the owner on every `rating<=3` submission
  (fires via `after()` from the funnel POST; dedupe on `Review.alertSentAt`;
  toggle in Settings → Notifications).
- ✅ Weekly digest email (scans, avg rating, new contacts, Google clicks,
  visits, open complaints) — cron route + `vercel.json` schedule (Mon 08:00
  UTC) + admin "run now".
- ✅ Password reset flow (hashed single-use 1h tokens; without a Resend key
  the link is dev-logged to console + EmailLog).
- ✅ Rate limiting on `/api/public/*` and `/api/auth/*` (Postgres
  fixed-window, fail-open) + honeypot bot guard on the funnel.
- ✅ Postgres migration (Supabase, RLS enabled on all tables) — Vercel deploy
  still pending for the first real pilot.
- ➕ Pulled forward: **platform-admin panel** at `/admin` (cross-tenant
  overview, business/user CRUD, suspension, review browser, email log,
  system health) gated by `User.isPlatformAdmin`.
- **Paperwork in parallel:** Meta Business verification, WhatsApp template
  approval, SMS sender/A2P registration (1–4+ week lead times).

## Phase 3 — Loyalty (trigger: ≥2 pilot owners ask unprompted)

Rewards catalog, redemption flow with staff-verifiable codes, wallet view on
the customer profile. Points remain visit-based; never points-for-reviews.
(Per-business tier thresholds and points-per-visit were pulled forward into
Phase 1 — configurable in Settings → Loyalty program. Reward definitions and
redemption rules will be per-business the same way.)

## Phase 4 — Campaign automation (trigger: >50 concierge msgs/week with >5% redemption)

- `send(channel, template, recipient)` abstraction: Resend → Twilio SMS →
  WhatsApp Cloud API.
- Automations: winback (no visit in N days), birthday, VIP promotion —
  cron-driven, idempotent, quiet-hours aware.
- Compliance hard requirements before first automated send: immutable
  `ConsentEvent` log, STOP/unsubscribe handling, per-channel consent,
  send caps, redemption codes for ROI attribution ("12 sent, 4 redeemed").

## Phase 5 — AI (trigger: concierge versions consumed weekly)

Priority order (by owner value, per the persona review):
1. Suggested reply to each private complaint (saves an awkward 10 minutes).
2. Weekly feedback summary ("what guests complained about most").
3. Campaign copy generation (nice-to-have — proven templates beat a generator).
4. Churn-risk surfacing (needs months of visit data; a sorted
   `lastVisitAt` list is the honest v1).

## Phase 6 — Analytics (trigger: owners ask questions the digest can't answer)

Retention cohorts, CLV estimates, campaign ROI, loyalty participation. Charts
arrive here, not before.

## Engineering guardrails

- Every tenant-scoped query filters by `businessId` — reviewed on every PR.
- Public endpoints never trust client-supplied business/customer ids.
- Money in cents; dates in UTC; consent only ever ratchets up from the public
  funnel.
- Keep the guest funnel dependency-free and fast — it is the product.
