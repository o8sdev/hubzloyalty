# Guest app — consumer side of HUBz

**Status:** planning + foundation (Session 15). Schema + shell scaffolded; auth,
directory, scanning, and reviews build in phases G1–G4 below.

## The vision

Today HUBz is owner-facing: a business puts a QR on the counter, guests scan it
with their phone *camera* and land on the ungated web funnel (`/r/[slug]`). The
guest is anonymous — the business only "knows" them as a `Customer` row.

The guest app turns the guest into a **first-class account holder**:

- A guest **downloads the app** (installable PWA now; native App/Play Store via
  Capacitor later) and **registers with email**.
- They open to a **Discover** dashboard — every café/restaurant/business on the
  platform that has opted into the directory.
- At a venue they **scan the QR from inside the app** → it counts as a **visit**
  (once staff confirm) → they **earn loyalty points** and climb tiers **at that
  business**.
- They can **leave first-party reviews** on businesses, see **their points and
  tier at every place** (a loyalty wallet), and rediscover favourites.

**Same product on web + mobile.** "Mobile" is the same Next.js PWA, responsive;
the guest surface is simply mobile-first (guests are on phones). Native store
apps are the later Capacitor wrap — no separate codebase, identical logic.

## User classes & auth

Three classes now share Supabase Auth (auth.users), distinguished by claims +
which domain table owns them:

| Class | Domain table | businessId | Home |
|---|---|---|---|
| Platform admin | `User` (`isPlatformAdmin`) | null | `/admin` |
| Business member (owner/staff) | `User` (role) | set | `/dashboard` |
| **Guest (consumer)** | **`Guest`** (new) | — | **`/guest`** |

**Guest self-registration is a separate door from invite-only business
onboarding.** Business onboarding stays invite-only (unchanged). Guests register
themselves — but through a *controlled server endpoint* that calls
`supabaseAdmin().auth.admin.createUser(...)` and creates the `Guest` row, so
Supabase project `disable_signup` stays **ON** (no uncontrolled public signup).
The endpoint is rate-limited + honeypotted like the other public forms, sends an
email verification, and mirrors `role="GUEST"` (no businessId) into
`app_metadata`.

**Hard separation.** `requireApiSession()`/owner routes reject `GUEST`;
`/api/guest/*` + `/guest/*` reject business/admin sessions; middleware + layout
redirects enforce it both ways.

## Data model (added this session)

```
Guest ──< Customer >── Business        (Customer.guestId links them)
  └──────< Review                       (Review.guestId, channel = APP)
```

- **`Guest`** — `id, authId, email, name, avatarUrl?, marketingConsent`.
- **`Customer.guestId`** (nullable) + `@@unique([businessId, guestId])` — one
  membership per guest per business. **Walk-ins keep `guestId = null`** (NULLs
  stay distinct, so nothing about the existing CRM changes). This single link is
  the whole trick: **one `Guest` → many per-business `Customer` memberships**,
  so all existing loyalty/check-in/visit/reward logic is reused verbatim.
- **`Business`** discovery profile — `listed` (opt-in), `category`,
  `description`, `city`, `latitude`, `longitude`, `coverImageUrl`.
- **`Review.guestId` + `channel`** — `FUNNEL` (public QR funnel, owner's private
  inbox) vs `APP` (first-party review written in the guest app, shown publicly
  in Discover).

Identity resolution on scan: find-or-create `Customer` for `(businessId,
guestId)`; if the business already has a matching walk-in by email/phone, link
it rather than duplicate.

## Core flows

1. **Register / sign in** — email + password (controlled endpoint), verify
   email, land on Discover.
2. **Discover** — list businesses where `listed && !suspended`; search, filter
   by category, "near me" via lat/lng; business detail shows info, avg rating,
   APP reviews, and *your* points/tier there.
3. **Scan → visit → points** — the printed QR still encodes `…/r/[slug]`.
   Scanned by the *phone camera* (non-app) → the existing web funnel (unchanged).
   Scanned *inside the app* → the app reads the slug and calls
   `POST /api/guest/checkin { slug }` → find-or-create membership → mint a
   PENDING `Checkin` (same 2h code, same anti-exploit model) → **staff confirm
   at the counter (existing flow)** → visit + points credited. Guest sees
   "waiting for staff" → "confirmed +10 pts, you're SILVER at Café X".
4. **Reviews** — a signed-in guest rates a business 1–5 + comment
   (`channel=APP`); shown publicly in Discover, aggregated into the business's
   rating. Low ratings still surface to the owner. **Never gated, never points.**
5. **Wallet** — the guest's memberships (points/tier per business) + reward
   claims.

## Compliance & security (non-negotiables preserved)

- The **public QR funnel stays exactly as-is** — ungated, Google link + private
  note for every rating. Untouched.
- **In-app reviews are first-party public content**, never gated by rating,
  **never award points** (points only from confirmed visits). Same for funnel.
- **New tenancy rule:** `/api/guest/*` scoped by `session.guestId` — a guest
  reads the public directory and reads/writes only their own cross-business
  records. Documented in CLAUDE.md.
- Every new table gets `ENABLE ROW LEVEL SECURITY` in its migration.

## Phased roadmap

- **G1 — Identity & shell. ✅ DONE.** `Guest` migration; controlled guest signup
  / login (admin API, `disable_signup` stays on); guest session facade
  (`getGuestSession`/`requireGuestSession`/`requireApiGuestSession`) + strict
  two-way route separation; `/guest` shell with real login/register/profile.
  (Email verification deferred — accounts auto-confirm for now.)
- **G2 — Discover.** Owner "list my business" profile editor (category, location,
  cover, opt-in); `/api/guest/discover`; Discover list + business detail.
- **G3 — Scan → points. ✅ DONE.** In-app camera QR scanner (jsQR) + a
  "Check in here" button on the venue page; `POST /api/guest/checkin` (upsert
  membership + mint check-in via the shared cooldown/cap engine) → staff confirm
  → points. Wallet (`/guest/wallet`) shows memberships + live pending codes.
- **G4 — Reviews. ✅ DONE.** In-app first-party reviews (`POST /api/guest/reviews`,
  membership-gated, one editable review per guest per business, never gated by
  rating / never points) shown publicly and driving the venue's average.
  (Rewards catalog beyond the welcome gift is future.)
- **G5 — Native store apps.** Capacitor wrap (needs a live deploy first) + native
  camera + push.

## Open decisions (need a green light before G1 build)

1. **Apply the additive migration to the live DB** (new `Guest` table + nullable
   columns — safe, no backfill).
2. **Controlled guest signup** as described (keeps `disable_signup` on) vs.
   flipping Supabase public signup on.
3. **Discovery = opt-in** (default `listed=false`, owner turns it on) — assumed
   here; confirm.
