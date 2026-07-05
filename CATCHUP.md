# CATCHUP — read this first on a new device

**What this is:** HUBz Loyalty (repo: hubzloyalty) — a SaaS for cafés/restaurants,
part of the HUBz ecosystem (alongside HUBz Studio). Black & white wordmark; the UI
is modern monochrome + one red accent (white / near-black / red, cool-grey neutrals).
A QR code on the counter sends guests to a mobile page where they rate their
visit; everyone gets both a Google-review link and a private "message the
owner" option (deliberately **ungated** — rating-based routing violates
Google policy + FTC rules). Guests can join the loyalty list, which builds
the owner's customer database automatically. Owners get a dashboard,
feedback inbox, CRM, and a printable QR.

**Run it:**
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev        # http://localhost:3000
```
Demo owner login: `demo@loyaltycrm.test` / `demo1234` · guest page: `/r/demo-cafe`

**Where things are:** strategy/market docs in `docs/00`–`04`, agent
conventions in `CLAUDE.md`. Stack: Next.js 15, TypeScript, Tailwind v4,
Prisma 6, Supabase Postgres + Supabase Auth (project `ghubhzbvkfjhtywvtvuj`,
eu-west-1). One typeface product-wide: **Space Grotesk** (`--font-app`).

**Roadmap position:** Phases 1 & 2 done, plus the platform admin panel,
invite-only onboarding, staff-confirmed check-ins, welcome rewards, an
installable PWA, the guest app (G1–G4), and **Phase 3 — the points economy**:
the accounting-grade ledger (step 1), the rewards catalog + staff redemption
(step 2a), the owner loyalty report + ledger CSV export at `/loyalty` (step 3),
guest self-redeem — guests mint a reward code in the app, staff confirm it at
the counter (step 2b) — and **automatic bonuses (birthday + tier-up) plus a
points-expiry job**. Phase 3 (the loyalty program) is now feature-complete. Only
Phase 2 item left is the first Vercel deploy. Phases: `docs/04-roadmap.md`.

**Onboarding is INVITE-ONLY** (as of Session 5): no self-registration.
Prospects submit `/request-demo`; the platform admin works the inbox at
`/admin/demo-requests` and provisions businesses with a one-time password;
owners set their own password at first login.

---

## Session log (newest first)

### 2026-07-05 — Session 21 (Windows): automatic bonuses + points expiry (Phase 3 complete)
- **Three automatic loyalty mechanics, all posted to the ledger** (no drift):
  - **Tier-up bonus** — event-driven. When a visit promotes a guest to a higher
    tier, a `TIER_BONUS` row is posted in the SAME tx as the visit's EARN. Fires
    once per tier (only on the actual promotion), so a bulk tier recompute
    (`applyLoyaltyConfig`) never triggers it. Both organic tier-change sites do
    it: `creditVisit` (`src/lib/checkins.ts`, counter confirm) and the manual
    visit route — each now uses a Postgres CTE (`WITH prev AS (SELECT tier …)`)
    to return old + new tier from the one UPDATE and calls `awardTierBonus`
    (`src/lib/bonuses.ts`).
  - **Birthday bonus** — daily cron. Guests whose birthday is today get points
    once per calendar year (`NOT EXISTS` since Jan 1 + in-tx re-check).
  - **Points expiry** — daily cron. Balances of guests inactive for
    `pointsExpiryMonths` (COALESCE lastVisitAt→createdAt) are zeroed with a
    compare-and-set + an `EXPIRE` row (delta = −balance). Idempotent (a zero
    balance no longer matches). Finally populates the `/loyalty` "Points expired"
    stat.
  - Jobs live in `src/lib/loyalty-cron.ts`; endpoint `/api/cron/loyalty` (Bearer
    `CRON_SECRET`, like the digest); `vercel.json` runs it daily 06:00 UTC. New
    ledger source `SYSTEM`.
- **Config** — new Business columns (`birthdayBonus*`, `tierBonus{Silver,Gold,Vip}Points`,
  `tierBonusEnabled`, `pointsExpiryMonths`), validated in `validation.ts`, edited
  in a new **Settings → "Automatic bonuses & expiry"** card (`bonuses-form.tsx`).
  Migration `20260705010000_automatic_bonuses_expiry` applied live via MCP.
- **Adversarial review caught 3 concurrency bugs — all fixed before commit:**
  (1) tier-bonus double-award under concurrent same-customer visits (the CTE read
  a stale pre-promotion tier from the statement snapshot) → now reads the old
  tier under `SELECT … FOR UPDATE` so visits serialize; (2) birthday year-boundary
  JS/SQL mismatch → the in-tx re-check now derives the year start from the DB
  (`date_trunc('year', now())`), matching the SELECT; (3) points-expiry could
  zero a guest who became active between the eligibility SELECT and the tx → now
  locks the row and re-checks inactivity + reads the balance under `FOR UPDATE`.
  Build passes after the fixes.
- **NEXT:** the first Vercel deploy (last Phase 2 item; pin functions to the DB
  region, set `CRON_SECRET`, and the two crons start firing). Then Phase 4
  (campaigns). Still-flagged: two pre-existing funnel concurrency races
  (`task_0cd2af74`).

### 2026-07-05 — Session 20 (Windows): guest SELF-redeem (Phase 3 step 2b)
- **Guests can now spend points from the app.** A signed-in guest opens a venue,
  picks an affordable reward, and mints a one-time **reward code** in their
  wallet; staff confirm it at the counter (same box as check-in / gift codes) —
  and THAT is when the points move. Closes the consumer half of the loop.
- **Model decision — deduct at CONFIRM, not at mint** (symmetric with the
  welcome-gift flow). Minting writes NO ledger row and moves NO points; it only
  records a PENDING intent. The counter confirm runs the overspend-proof engine:
  a compare-and-set decrement (`loyaltyPoints >= cost → decrement`, count!=1
  throws) + one REDEEM ledger row (delta = −cost, frozen value) in the same tx.
  So a guest can mint a code but can only ever CONFIRM up to their real balance —
  no refund/reversal machinery needed for expiry, and reconciliation
  (cache == SUM(delta)) holds because pending codes have no ledger row.
- **Schema — extended `Redemption`** (not a new table): added `code` (unique,
  null for staff-instant), `status` (PENDING|CONFIRMED|CANCELLED|EXPIRED, default
  CONFIRMED), `expiresAt`, `createdAt`; `redeemedAt` now nullable. Partial unique
  index → **one live PENDING code per customer**; unique `code`; expiry derived
  at read time (mint sweeps the guest's own stale PENDING → EXPIRED first).
  Migration `20260705000000_guest_self_redeem` applied live via MCP.
- **Endpoints/UI:** `POST /api/guest/redeem` (mint) + `DELETE` (cancel own code);
  counter dispatcher + confirm gained a 3rd REDEMPTION code type (💳, one-time-use
  flip → decrement → ledger); `CounterConsole` renders/redeems it; new guest
  `RewardsPanel` on the venue page (balance + affordable rewards + minted-code
  card + cancel); wallet shows the 💳 pending-reward chip. Report
  `redemption.count` + profile history scoped to `status=CONFIRMED`; staff-instant
  redeem now sets `status/redeemedAt` explicitly.
- Built with a mapping workflow (5 readers) + an adversarial review workflow
  (4 lenses × 2 skeptics/finding) over the diff. Build passes.
- **NEXT:** automatic bonuses (birthday/tier) + a points-expiry job (would
  populate the EXPIRE ledger type + the `/loyalty` "Points expired" stat, still
  0). Still-flagged: two pre-existing funnel concurrency races (`task_0cd2af74`).

### 2026-07-04 — Session 19c (Windows): owner loyalty report + ledger export (Phase 3 step 3)
- **The accounting payoff of the ledger.** New owner page **`/loyalty`** (the
  greyed "Loyalty · Phase 3" nav item is now live — moved from COMING_SOON to
  NAV_ITEMS in `app-nav.tsx`, icon ✦). Read-only, no migration.
- **Report** (`src/app/(app)/loyalty/page.tsx`) — every figure derived from the
  append-only ledger so it reconciles to the cent:
  - **Points outstanding** (current liability = `SUM(customer.loyaltyPoints)`),
    **Value given away** (`SUM(ledger.valueCents > 0)` — welcome gifts + reward
    COGS handed over), **Points issued** (`SUM(delta > 0)`), **Points redeemed**
    (`|SUM(type=REDEEM)|`, with redemption count), plus **Members with points**
    and **Points expired**.
  - **Recent ledger activity** feed — last 30 movements (type label + guest +
    signed delta + value + balanceAfter), newest first. Earned = ink, spent =
    brand-700, zero-delta (welcome gift) = faint.
- **CSV export** — `GET /api/business/ledger/export` streams the whole ledger
  (createdAt, customer, type, delta, balanceAfter, valueCents, sourceType,
  staffUserId, note), scoped by businessId, with the same formula-injection-safe
  `csvField` escaping as the customer export. Linked from the report header.
- Build passes; `/loyalty` is a dynamic route (requireSession).
- **NEXT (step 2b):** guest-app SELF-redeem (mint a code in the wallet → staff
  confirm at `/counter` — extend the counter code resolver with a third code
  type) + guest wallet rewards UI (progress bars). Then automatic bonuses
  (birthday/tier) + a points-expiry job (would populate the EXPIRE type + the
  "Points expired" stat, currently always 0). Still-flagged: two pre-existing
  funnel concurrency races (`task_0cd2af74`).

### 2026-07-04 — Session 19b (Windows): rewards catalog + redemption (Phase 3 step 2a)
- **Guests can now SPEND points.** Rewards catalog + the redemption half of the
  loop, on top of the Session 19 ledger.
- **Rewards catalog** (owner): `Reward` gained `costValueCents` (COGS, frozen
  onto redemptions) + `updatedAt`; CRUD at `/api/business/rewards[/id]`
  (GET/POST/PATCH/DELETE, owner/admin); Settings → **Rewards** card
  (`rewards-catalog.tsx`) to add/edit/activate/deactivate/delete. Deleting keeps
  history (Redemption.rewardId → SetNull; name frozen).
- **Redemption** (`Redemption` reworked: businessId, nullable rewardId, frozen
  rewardName/pointsSpent/valueCents, redeemedByUserId). `POST /api/customers/
  [id]/redemptions { rewardId }` — staff redeem for a guest from the profile.
  Atomic + overspend-proof: a compare-and-set `updateMany(loyaltyPoints >= cost
  → decrement)` (count!=1 ⇒ "not enough points"), then a Redemption row + a
  REDEEM ledger entry (delta = −cost, frozen valueCents) in the same tx. The
  row lock serializes concurrent redemptions so balanceAfter is exact; the
  ledger delta matches the decrement so the reconciliation invariant holds.
- **UI:** "Redeem reward" picker on the guest profile (unaffordable rewards
  disabled) + a Redemptions history section. Migration
  `20260704190000_rewards_catalog_redemptions` applied live (via MCP; Reward
  & Redemption were empty). Build passes.
- **NEXT (step 2b/3):** guest-app SELF-redeem (mint a code in the wallet →
  staff confirm at `/counter` — extend the counter code resolver with a third
  code type) + guest wallet rewards UI (progress bars); then owner LIABILITY /
  statement report from the ledger (outstanding points + value given +
  breakage). Then automatic bonuses (birthday/tier) + points expiry job.

### 2026-07-04 — Session 19 (Windows): loyalty POINTS LEDGER (Phase 3 step 1)
- **Points economy design agreed** with the user: two currencies — TIER =
  lifetime visits (status, never drops), POINTS = spendable balance (earned,
  and later burned on rewards). Redemption will be staff-confirmed at the
  counter. Owner sets earn rate + reward costs (the economy knobs).
- **Built the append-only points LEDGER** (`PointsLedger` table + `src/lib/
  ledger.ts`): every points movement is a row (type EARN/REDEEM/WELCOME_BONUS/
  …, signed `delta`, `balanceAfter`, frozen `valueCents` for accounting,
  source, and the staff who confirmed it). `Customer.loyaltyPoints` is now a
  CACHE that always equals SUM(delta) — every earn/redeem writes its ledger row
  IN THE SAME transaction that moves the cache. `reconcileCustomer()` is the
  integrity check. Rationale: accounting-grade tracking (the user's ask — every
  bonus given must be stored with a value).
- **Wired all earn paths:** counter check-in confirm + the first-visit gift
  ride-along + the manual visit-log all post EARN rows; the welcome gift freezes
  its cost (`Business.welcomeRewardValueCents`, set in Settings → Welcome
  reward → "Cost to you"; `RewardClaim.valueCents`) at grant and posts a
  WELCOME_BONUS value row on hand-over.
- Migration `20260704181320_loyalty_points_ledger` applied LIVE via MCP (Prisma
  `migrate deploy` couldn't hold the pooler — P1017; MCP path is reliable).
  Backfill (`scripts/backfill-ledger.ts`, idempotent) reconciled all existing
  balances → verified in DB: **58 customers, 0 unreconciled.** Build passes.
- **Adversarial review (workflow): 3 findings.** FIXED: manual visit-log tier
  recomputed atomically (was a stale separate UPDATE). FLAGGED for a focused
  follow-up (pre-existing FUNNEL races, not ledger bugs): (1) no DB unique on
  Customer(businessId,phone/email) → simultaneous same-phone funnel completions
  can create duplicate customers → duplicate gift/points; (3) a reviewId P2002
  500s instead of reusing. Fix = partial unique indexes + graceful P2002.
- **NEXT (step 2+):** rewards catalog (owner CRUD, uses the Reward table +
  costValueCents) → redemption loop (guest mints code → counter confirm →
  atomic deduct + REDEEM ledger row) → guest wallet rewards UI → owner
  liability/statement report. Then automatic bonuses + expiry.
- ⚠ Env note: this Windows box's `.env` was rebuilt this session (real eu-west-1
  DB password + Supabase keys; `DATABASE_URL` uses
  `connection_limit=10&pool_timeout=60&connect_timeout=30` — `=1` timed out the
  dashboard's Promise.all). Admin login: rhlhabibli@gmail.com. `demo@` was
  deleted in an earlier wipe. SUPABASE_SERVICE_ROLE_KEY still blank (needed only
  for admin provisioning).

### 2026-07-04 — Session 18 (Mac): Phase G4 — in-app reviews (guest app feature-complete)
- **Guest reviews** (verified live: post → shows in the venue's rating).
  `POST /api/guest/reviews { slug, rating, comment }` (guest-only): requires a
  membership (must have checked in), one editable APP review per guest per
  business, status NEW when rating<=3 so it enters the owner inbox. COMPLIANCE:
  never gated by rating, never awards points. Venue page shows a star-picker
  `ReviewForm` for members (else "check in to review"); reviews render publicly
  and drive the venue's average (channel=APP).
- **Guest app is now FEATURE-COMPLETE (G1–G4):** accounts, Discover + venue
  pages + owner photos, check-in (scan or tap) → points + wallet, and reviews.
  Next is the store path: deploy → Capacitor wrap (iOS+Android, native camera +
  push) → your Apple ($99/yr) + Google ($25) accounts to submit.

### 2026-07-04 — Session 17 (Mac): Phase G3 — in-app check-in + wallet
- **The core loop works** (verified live: guest → membership → PENDING check-in
  in the counter queue). `POST /api/guest/checkin { slug }` (guest-only):
  resolves the business by slug, upserts the guest's Customer (find-or-create,
  race-safe via the `@@unique([businessId,guestId])`), and mints a PENDING
  check-in reusing the existing cooldown/cap engine (`checkEarnEligibility`) —
  staff confirm at the counter (existing flow) to credit the visit + points.
- **Two ways to check in:** a "Check in here" button on the venue page (works on
  any device, no camera) and a **camera QR scanner** (`/guest/scan`, jsQR +
  getUserMedia; the QR encodes /r/[slug]). Camera needs https on a phone; falls
  back to a clear message + the venue button.
- **Wallet** (`/guest/wallet`): the guest's memberships across businesses
  (points/tier/visits) + any live pending code (`guestMemberships()` in
  venues.ts). Shared result UI in `checkin-ticket.tsx`.
- Dep added: `jsqr`. NEXT: G4 in-app reviews; then the Capacitor wrap for the
  iOS/Android store apps.

### 2026-07-04 — Session 16 (Mac): Phase G1 — guest authentication
- **Guest sign-in works** (verified against live Supabase: login returns
  role=GUEST + matching profileId). Controlled self-signup via the admin API
  (`/api/guest/auth/register`, keeps Supabase `disable_signup` ON) creates the
  auth user + `Guest` row + GUEST claims + signs the browser in, with rollback
  on failure. `/api/guest/auth/login` rejects non-guest identities (owners
  can't log into the guest app; guests can't log into the owner app — the login
  routes cross-check the User/Guest tables).
- **Session facade:** `buildGuestClaims` (supabase.ts), `getGuestSession` /
  `requireGuestSession` (session.ts), `requireApiGuestSession` (http.ts). A
  guest carries role GUEST + businessId "" so the owner/admin guards already
  reject them; `requireApiSession` needs businessId, so guests can't hit owner
  APIs. Reverse guard: `(app)` layout bounces role GUEST → /guest/discover.
- **UI:** `/guest/login` + `/guest/register` (shared `auth-form.tsx`, honeypot),
  real `/guest/profile` (name/email + logout via /api/auth/logout → /guest/login).
  Discover shows a "sign in" banner when logged-out; Scan/Wallet now gated by
  `requireGuestSession`. Middleware matches `/guest/*` for cookie refresh only
  (no gate — Discover stays public).
- **NEXT (G3):** in-app QR scanner → `/api/guest/checkin` (find-or-create the
  guest's Customer for the scanned business, mint a pending check-in) → staff
  confirm → points; then the wallet (G3) and in-app reviews (G4).
- Email verification is deferred (accounts auto-confirm for now) — hardening TODO.

### 2026-07-04 — Session 15 (Mac): guest side — foundation + venue pages (Phase G)
- **New direction: consumer guest app** (full plan in `docs/05-guest-app.md`).
  Guests get accounts, a Discover directory, scan-to-check-in, per-business
  loyalty, and reviews. Mobile = the same PWA (guest surface is mobile-first);
  native store apps = later Capacitor.
- **Schema (added, `prisma validate` clean, NOT yet migrated):** `Guest` table
  (authId→auth.users, no businessId); `Customer.guestId` + `@@unique([businessId,
  guestId])` (one guest ↔ many per-business memberships — reuses the loyalty
  engine); `Business` discovery fields (listed/category/description/city/lat/lng/
  coverImageUrl); `Review.guestId`+`channel` (FUNNEL|APP); `BusinessPhoto`
  gallery table (cap in API). CLAUDE.md guest rule + tenancy added.
- **Guest shell + venue pages (scaffold, mock data, PUBLIC for now):**
  `/guest` layout + bottom tabs (Discover/Scan/Wallet/Profile); appealing
  clickable **Discover**; interactive **venue detail** `/guest/business/[slug]`
  (hero, logo, your-loyalty-here + progress, swipeable **photo gallery w/
  lightbox**, about/info, reviews, scan CTA). Verified: renders 200, 404s on
  unknown slug.
- **HELD (need green light):** live migration; Supabase Storage bucket + owner
  photo-upload endpoint + owner "listing & photos" card; guest auth + session
  separation (G1). See docs/05 "open decisions".

### 2026-07-04 — Session 14 (Mac): guest-delete safety + palette (café → modern mono+red)
- **Mobile = the PWA (no native rebuild).** Chose to polish the existing
  responsive + installable web app rather than fork a React Native codebase
  (keeps features/logic identical by construction). Added a native-style bottom
  tab bar (`src/components/mobile-tab-bar.tsx`: Home/Counter/Guests/Reviews/
  Settings, active=black pill, safe-area-aware); reworked the `(app)` mobile
  header to sticky + notch-safe with logout; `main` padded (`pb-24 md:pb-6`) to
  clear the bar. Fixed stale PWA theming (manifest + viewport `themeColor`
  #161619→#fff, bg #0c0c0e→#fff). globals.css: killed tap-highlight + pinned
  form controls to 16px on phones (stops iOS focus-zoom). Icons already existed
  in public/icons. NEXT for stores: Capacitor wrap once deployed (deferred).
- **Colour DISCIPLINE pass (one colour, one job).** Grounded a rulebook in colour
  psych (scarcity/pop-out/consistency) — see CLAUDE.md brand rule. Applied: PRIMARY
  buttons + active nav + selected chips/tabs + VIP tier + links → **black** (`ink`),
  not red. **Red pared back to alerts/danger ONLY** (complaint NEW/callback badges,
  dashboard attention list, `danger` button) — verified red no longer appears on
  routine chrome. **Gold reintroduced** (`--color-gold` #c8901f + `--color-gold-deep`)
  scoped to reward/gift moments; green (`moss`) = success/consent. Touched ui.tsx
  (primary=ink, tier ladder grey→black, star=ink, focus rings=ink), app-nav,
  customers-explorer, dashboard (chart mono, recent-guests neutral, attention list
  kept red), reviews/settings/team-card/counter/activity/pending-checkins/layout,
  review-flow + customer-detail welcome tickets = gold.
- **⚠ Final palette = modern monochrome + one red** (superseded the café-print
  revival below within the same session, per owner request "white/black/red,
  more modern"). `globals.css @theme`: `--color-brand-*` = RED scale (brand-700
  primary; `--color-ember` = brand-600 = `rgb(209 21 48)`), `--color-ink`
  near-black, `--color-paper` whisper-grey `#f7f7f8`, `--color-cream` white,
  `--color-moss` quiet green (success/consent), `--color-gold` retired → red.
  `slate` remapped to **cool zinc grey** (was warm taupe). Baked-in `.mkt`/
  shimmer rgb() swapped warm→red/zinc. TierBadge → grey→black→red; StarRating →
  black (ui.tsx). `avatar.ts` → monochrome dark solids. Raw `amber` attention
  states across dashboard/reviews/settings/team/funnel → red. `gold`-token
  marketing accents auto-flip to red. Admin shell now cool-zinc dark.
- **Guest deletion is owner-only.** `DELETE /api/customers/[id]` now 403s for
  anyone but `OWNER` (staff/managers can add & edit guests, never delete); the
  detail page hides the whole Danger zone for non-owners. New confirm **modal**
  (`delete-customer-button.tsx`): red header, must type the guest's name to arm
  the red "Delete permanently" button, Esc/backdrop close, scroll-lock.
- **Palette revival (reverses the Session-12 monochrome flatten).** The
  wordmark stays B&W (raster), but `globals.css @theme` tokens are restored to a
  lively café-print system: `--color-brand-*` = ember/terracotta scale
  (brand-700 primary), warm espresso `--color-ink`, oat `--color-paper`, ivory
  `--color-cream`, `--color-moss` green, `--color-gold`. **Tailwind `slate` is
  remapped to warm taupe/espresso** in @theme, so ~230 stray `slate-*` across
  settings/reviews/funnel — and the /admin shell — warm up automatically
  (admin now warm-espresso; still dark, still distinct). `body` → `bg-paper
  text-ink`; global ember `::selection`.
- **New `src/lib/avatar.ts`** — deterministic multicolour warm gradient avatars
  + initials, used by the guests explorer and the customer detail header.
- **Guests explorer + customer detail** reworked to the warm palette: ember
  active chips (match primary buttons / active nav), moss for consent, gold
  star ratings, warm hovers, colourful avatars. `ui.tsx` buttons got warm
  secondary/ghost + soft shadows on primary/danger.
- **Not touched:** fonts (still Space Grotesk, per hard rule), auth invariants,
  the B&W wordmark. CLAUDE.md brand rule updated to match.
- **In flight:** nothing committed yet — user was testing; awaiting "commit it".

### 2026-07-04 — Session 13 (Mac): audit log + per-business staff cap (+ 431 fix, change-pw fix, demo copy)
- **Audit log** (new `AuditLog` table +RLS): `recordAudit()` in
  `src/lib/audit.ts` (never throws, called via `after()`). Instrumented
  ~15 endpoints — login/logout, counter confirm (checkin+gift), customer
  CRUD, visit log, review resolve, business+loyalty settings, team
  invite/remove, admin business create/update/delete. Actor email+role
  denormalized (survives user deletion, filters without a join).
  - Owner view: `/activity` page (filter by team member + date) + a
    "Recent team activity" card on the dashboard. Scoped to their business,
    excludes PLATFORM_ADMIN rows.
  - Admin view: `/admin/activity` (all businesses; filter by business,
    action, free-text email/summary, date). Both are live explorers.
  - Display helpers in `src/lib/audit-display.ts`.
- **Per-business staff cap**: `Business.staffLimit` default **1**; enforced
  in the team-invite endpoint (counts STAFF, owner excluded); owner Settings
  → Team shows "X of N staff" and blocks at cap; platform admin edits it on
  the business detail page.
- Migration `audit_log_and_staff_cap` applied live. Verified the data layer
  (owner query excludes admin rows; admin filters by action/email; cap
  blocks — Test Business is at 1/1). Build 56 routes.
- ⚠ Dev server MUST restart after pulling: the running process has the
  pre-migration Prisma client and 500s on the new `auditLog` model until
  restart (Ctrl+C → npm run dev).
- Also landed earlier this session (uncommitted with the above): **431 fix**
  (dev script uses cross-env `--max-http-header-size=65536` — bloated
  localhost cookie jars 431'd localhost while the LAN IP worked),
  **change-password fix** (page reads mustChangePassword from the DB, not the
  lagging app_metadata claim, so forced first-login can't misfire "Current
  password is required"), **demo-request copy** ("within a day or two" →
  "as soon as we can" / "reply shortly").

### 2026-07-03 — Session 12 (Windows): HUBz rebrand (name, logo, monochrome palette)
- **Rebranded the whole product to "HUBz Loyalty"** (part of the HUBz ecosystem
  with HUBz Studio). User provided the HUBz logo pack (black wordmark, stark
  black-&-white brand — "Captured. Crafted. Remembered.").
- **Name**: every "LoyaltyCRM" → "HUBz Loyalty" (app shells, admin, marketing
  nav/footer, auth pages, emails, metadata, manifest, "Powered by", copy).
- **Logo**: new `src/components/brand.tsx` `HubzWordmark` (variant light/dark →
  black/white raster from `public/brand/`). Swapped into the owner-app sidebar
  + mobile header, admin sidebar + mobile, marketing nav + footer, and the
  auth-page header (replacing the old round "L"/"A" letter badges).
- **Palette**: recolored to **monochrome** in `globals.css @theme` — `brand-*`
  ramp → near-black; café-print vars (ember/moss/paper/ink/cream) → greyscale.
  Kept `--color-gold` for star ratings and the semantic tier/status colors for
  CRM legibility. This one edit recolored the whole app + marketing (everything
  is var-driven). manifest theme/bg → black; viewport themeColor → #161619.
- **Icons**: regenerated PWA icons (192/512/maskable-512/apple-touch-180) from
  the HUBz white-on-black square via sharp; added `src/app/icon.png` (favicon).
- Build passes (all routes). NOT browser-verified on this device (no `.env`).
  Logo assets: `public/brand/`. To revert a serif/warm look isn't planned;
  direction is HUBz mono. User chose wordmark "HUBz Loyalty", whole-product scope.

### 2026-07-03 — Session 11 (Windows): universal Space Grotesk font + live-DB reset
- **Fixed the pulled build error** (`Can't resolve '@supabase/ssr'`): stale
  node_modules after the Session 7–10 pull. `npm install` pulled the Supabase
  packages (jose/bcrypt already dropped by the auth migration).
- **The whole product is now ONE typeface — Space Grotesk.** Replaced the
  café-print type system (Schibsted body + Fraunces serif display + Spline
  mono) everywhere: landing, about, auth pages, owner app, admin. Wired via
  `--font-app` + Tailwind `--font-sans`/`--font-mono`/`--font-serif` theme
  tokens in globals.css; `.f-display`/`.f-mono`/`.mkt`/`.mkt-eyebrow` all map to
  it; removed the three now-unused next/font imports (lighter pages). Café-print
  COLORS / layout / grain untouched — only the typeface changed. Build passes.
  (Not browser-verified on this device — no `.env` to run the app; see it on Mac.)
  User first chose it app-only, then asked for it product-wide. To revert to a
  serif-display accent later: give `.f-display` its own font again.
- **Wiped ALL seeded data from the LIVE eu-west-1 DB** for manual testing (user
  request). Deleted the demo business + 39 customers / 388 visits / 60 reviews /
  3 check-ins / 5 reward claims / 3 demo requests / 2 email logs, and the demo
  owner (`demo@loyaltycrm.test`) from both `public.User` and `auth.users`.
  PRESERVED the platform admin `rhlhabibli@gmail.com` (both tables).
  ⚠ The shared DB now has NO demo data — `demo@loyaltycrm.test` / demo1234 no
  longer works, and `/r/demo-cafe` 404s. Do NOT run `npm run db:seed` against
  it (recreates the demo AND resets the admin password from ADMIN_EMAIL/PASSWORD).
- Windows device still lacks the eu-west-1 `.env` (blocks running the app +
  browser verification here); copy it from the Mac to run locally.

### 2026-07-03 — Session 10 (Mac): STAFF-CONFIRMED CHECK-INS + PWA
- **Big semantic change (user decision after a long verification-design
  discussion): points NEVER credit automatically.** Completing the funnel
  now mints a short-lived (2h) check-in code; a HUMAN confirming it is what
  creates the Visit and credits points/tier. First visits keep showing ONE
  code — the welcome gift — and confirming the gift also confirms the visit
  (ride-along in the unified confirm endpoint). Feedback is never gated.
- **Owner-set minting bounds** (Settings → Check-in rules): earnCooldownHours
  (vs last CONFIRMED), maxEarnPerDay (confirmed+pending), askTableNumber for
  waiter venues. Re-scans re-show the SAME pending code (idempotent — no
  duplicate mints). Verified: couch replay after confirmation → "cooldown",
  no code, no points.
- **Two confirmation surfaces**: unified counter console (dashboard card +
  new pocket `/counter` screen, big touch targets) that resolves ANY code
  (gift or check-in) with one confirm tap; and a live **pending queue**
  ("T12 · Nino · 4 min ago", 30s polling) for waiter venues. New nav item
  Counter. Old /api/rewards/claims* endpoints + redeem widget replaced by
  /api/counter/codes/[code](+/confirm) + /api/counter/pending.
- **Team management** (Settings → Team): owners invite STAFF with the OTP
  pattern (auth user + forced password change + claims), remove staff;
  staff can confirm codes but not change settings. Verified E2E: invite →
  OTP login → forced change → /counter works.
- **PWA layer**: manifest (ember theme, /dashboard start, /counter
  shortcut), generated icons (scripts/generate-icons.mjs, committed),
  apple-touch/viewport-fit metas, minimal service worker (offline page
  only, prod-only registration), install hint on /counter (Android prompt /
  iOS share tip). Web-push deferred to the native/Expo track.
- Schema: Checkin table (+RLS) + Business.{earnCooldownHours, maxEarnPerDay,
  askTableNumber}; migration `staff_confirmed_checkins` applied live.
- Verified E2E in browser: scan mints code w/o points → queue shows table
  row → confirm credits (2→3 visits, 20→30 pts) → double-confirm rejected →
  cooldown blocks re-mint → first-timer gift confirm credits visit #1 →
  staff flow → manifest/icons live. Build 51 routes.
- **Next (agreed direction)**: NFC tap-to-verify (NTAG 424) as the
  zero-human presence tier when stickers arrive from AliExpress (user is
  ordering: NTAG 424 DNA stickers + ACR122U reader, ~$80); then guest
  accounts (email OTP) → wallet → rewards catalog → directory per the
  4-stage plan; Expo native app after PWA proves the counter workflow.

### 2026-07-03 — Session 9b (Mac): owner app redesign + live guests explorer
- **The owner app now wears the café-print identity** (user-scoped: platform
  /admin deliberately untouched apart from inheriting the accent).
  `--color-brand-*` remapped teal → ember (brand-700 == marketing ember), so
  every button/link/active state across the product is one color story.
  App shell: paper background, cream sidebar, ember round logo + Fraunces
  wordmark, "guest book" eyebrow, public /r/slug ↗ chip; nav renamed
  Customers → **Guests**.
- **Dashboard**: Fraunces greeting, animated stat numbers (reuses the
  marketing `Counter`), stat icons + hover lift, and a new **14-day scan
  activity bar chart** (single GROUP-BY-day query riding the existing
  Promise.all; pure CSS bars, gold bar = today, hover shows counts).
  Attention + recent lists reskinned (initial avatars, callback badge,
  warm hover), redeem widget unchanged.
- **Guests page rebuilt as a live explorer** (`customers-explorer.tsx`):
  debounced instant search, tier chips with live facet counts, quick
  filters (☎ callback-requested, consent yes/no, source QR/manual/import),
  sort select, stale-while-loading (old rows stay dimmed under a shimmer
  rail), Prev/Next, filters mirrored to the URL via replaceState (shareable;
  reload restores them — verified). API: customerListQuerySchema gained
  source/consent/callback; where/orderBy extracted to `src/lib/customers.ts`
  (shared by route + server first paint); GET returns `facets.tiers`.
- Verified in browser: search "nino" → 1 result in place; Gold chip → 12/12;
  ☎ chip → the 2 callback guests; consent chip → 25 (matches DB); sort by
  visits; URL restore after reload; mobile card layout. Build 47 routes.
- Note: preview evals must poll for the SETTLED count — stale-while-loading
  keeps previous rows visible during fetch (by design).
- Planned first (plan mode, user approved), then built: businesses can give
  first-time funnel completers a **one-time gift code** to claim at the
  counter. COMPLIANCE FRAME everywhere: it's a gift for JOINING THE LIST —
  identical at every rating, never for the review (Google/FTC).
- **Schema**: Business.welcomeReward{Enabled,Text,ExpiryDays} + new
  RewardClaim table (kind WELCOME, unique 6-char bearer code, frozen
  rewardText, PENDING/REDEEMED + derived expiry, one per customer enforced
  by @@unique). RLS on. Migration `welcome_reward_claims` applied live.
- **First-time detection** = the funnel's existing create-vs-match branch:
  grant only when the Customer row is CREATED (dedupe by phone/email per
  business falls out for free). Grant rides the same transaction; code
  collisions retry once.
- **Guest UX**: reward ticket on the done screen (code XXX-XXX, expiry,
  "saved on this device"); localStorage memory per business slug →
  repeat scans get prefilled one-tap "Check in", "Welcome back — visit
  recorded", and the unredeemed code re-shown; a public status endpoint
  (bearer = the code) lets the device drop redeemed/expired codes. Server
  never discloses whether contact matched (privacy invariant intact).
- **Owner controls**: Settings → "Welcome reward" card (toggle/text/expiry
  days; enabling requires text — validated both sides). Dashboard →
  "Redeem a welcome reward" widget (only when enabled): staff types code →
  sees gift + guest name + expiry → "Hand it over — mark redeemed" →
  atomic redeem logged with who/when; pending + redeemed-30d counters in
  the header. Customer detail shows the claim + status badge.
- **Verified end-to-end in browser + DB**: enable/guard 400, first scan
  grants (ticket UI), repeat scan same phone → no grant + visit++ (1 claim,
  2 visits), device welcome-back flow, widget lookup (messy input
  normalized) → redeem → double-redeem rejected → public status flips →
  device auto-clears code but keeps contact, disabled toggle → no grant,
  bogus code 404. Build 47 routes.
- All entry pages (login, forgot/reset password, /change-password) now share
  the café-print design via `AuthShell` + `AuthSubmitButton` in
  `src/components/marketing/auth.tsx` (paper/ember/Fraunces, coffee rings,
  grain — same language as the landing). The demo-request form imports the
  same input/label/error classes, so all public forms are one system now.
- **Login UX**: submit button shows a spinner with staged labels — "Signing
  you in…" during auth, "Pouring your dashboard…" through the redirect —
  and the form locks; the user never stares at a dead page. Same busy
  pattern on forgot/reset/change-password and the demo form. Login also
  gained a show/hide password toggle.
- ChangePasswordForm takes `variant="app" | "mkt"`: Settings keeps the slate
  owner-app look, /change-password renders café-print.
- Verified in browser: spinner states observed live (122ms → busy,
  1.4s → redirect label, lands on /dashboard), mobile layout, Settings
  unaffected, production build 47 routes.

### 2026-07-03 — Session 8d (Mac): SUPABASE PROJECT MOVED TO IRELAND
- **User recreated the Supabase project in eu-west-1** (new ref
  `ghubhzbvkfjhtywvtvuj`) and deleted the Tokyo one. This machine rewired
  everything: new DB password + pooler connection strings, new anon/service
  keys (all in Mac `.env` — Windows must copy it AGAIN), auth config
  re-applied (disable_signup, site_url localhost, min length 8), all 5
  migrations deployed, seed run (fresh auth users: demo/demo1234 and the
  admin with the password the user chose in chat), MCP `supabase-hubz`
  re-pointed at the new ref (takes effect next session).
- Measured effect vs Tokyo: guest contact save 8.8s → 2.6s warm; single
  API round trip ~1s from this machine. Vercel region for deploy: dub1/lhr1.
- ⚠ Anything still referencing `mmmsjhpdoljutekishht` is dead.

### 2026-07-03 — Session 8c (Mac): funnel save bug + complaint callback capture
- **Bug (user-reported): "Could not save your details" on the guest funnel.**
  Root cause: the contact-capture transaction (~7 round trips) exceeded
  Prisma's 5s interactive-transaction default against the Tokyo DB → P2028
  mid-flight. The star tap (separate POST) had already landed, which is why
  the rating still showed in the inbox. Fix: 30s timeout + the visit
  increment/tier recompute merged into ONE raw-SQL statement. Verified: the
  exact failing flow now returns ok (~9s in dev; sub-second once the DB is
  nearby).
- **Product: complaints now ask for a callback, not a loyalty signup.** For
  rating ≤ 3 the capture step reads "Want us to make this right?" — phone
  required "for the callback", marketing consent genuinely optional (it was
  previously a REQUIRED checkbox — an upset guest would never check it),
  CTA "Request a callback", done-screen promises the follow-up. 4–5★ keeps
  the loyalty-list pitch (consent required there — joining a marketing list
  IS the consent). Server tags funnel-created customers on ≤3 reviews with
  `callback-requested`; the feedback inbox shows a "☎ callback requested"
  badge and the phone is now a tap-to-call tel: link.
- Compliance unchanged: both doors at every rating; the callback is a
  service follow-up, not an incentive; existing customer rows are still
  never mutated from the public endpoint (only newly created rows carry
  the tag).
- Tab switching was seconds-per-click (every nav re-queried Tokyo).
  Measured after the fixes: **return-to-tab ~30-50ms** (was seconds), cold
  tabs paint a skeleton at ~250ms while data streams.
- Changes: router cache for dynamic pages (`staleTimes.dynamic: 60` —
  mutations still bust via router.refresh()), `loading.tsx` skeletons for
  /admin and the owner (app) shell, admin overview's 9 count queries
  collapsed into ONE SQL round trip, session verification deduped
  per-render with React cache(), dev server on Turbopack.
- Cold-visit cost that remains is dev-only compile + Tokyo RTT — the
  region move / prod deploy near the DB erases most of it.

### 2026-07-03 — Session 8 (Mac): AUTH MIGRATED TO SUPABASE AUTH
- **Why**: user decision after the "reset email never arrives" pain — reset
  emails now actually deliver via Supabase's mailer (no Resend key needed
  for auth mail; product mail still uses src/lib/mail.ts).
- **Architecture**: auth.users owns identities/credentials/sessions/recovery;
  the domain `User` row links via `authId` and OWNS tenancy facts, mirrored
  into app_metadata by `syncAuthClaims()` (src/lib/supabase.ts). Session
  facade (src/lib/session.ts) keeps the old `Session` shape — zero changes in
  consumers. Cookies via @supabase/ssr; middleware refreshes them; getUser()
  verification behind a 5-min in-memory cache (HS256 project; switching to
  asymmetric signing keys in the dashboard would make verification fully
  local — optional).
- **Project config**: public signups DISABLED (`disable_signup`), site_url +
  allowlist set to localhost for now (change at deploy!), password min 8.
  New env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
  SUPABASE_SERVICE_ROLE_KEY (in Mac .env; Windows needs them copied).
  SESSION_SECRET is dead; bcryptjs + jose removed.
- **Data migration** (done, live): both users imported with bcrypt hashes
  preserved (demo1234 still works; admin password unchanged), then
  passwordHash + PasswordResetToken dropped. Migrations:
  user_auth_id → scripts/migrate-users-to-supabase-auth.ts → cleanup.
- **Flows rewired**: login (suspension gate + orphan rejection intact),
  forgot → Supabase recovery email → /auth/confirm → /reset-password
  (session-based, no token in body), change-password (current password
  verified via throwaway sign-in), admin provisioning/user CRUD/business
  delete all mirror to auth.users with compensation on failure. Seed
  creates auth identities (never overwrites an existing admin password).
- **Verified in browser end-to-end**: demo login (preserved password),
  wrong-password 401, /admin gate for non-admins, dashboard render,
  full recovery flow (confirm link → set password → old rejected),
  OTP provisioning → forced change → re-login, business delete kills the
  owner's auth identity (login 401), production build (47 routes).
- A real recovery email was sent to rhlhabibli@gmail.com — the admin can
  set their password from their inbox now.
- **Deploy note**: update site_url/uri_allow_list + NEXT_PUBLIC_APP_URL to
  the production domain, and configure custom SMTP on Supabase Auth
  (built-in mailer is rate-limited, dev-grade).

### 2026-07-03 — Session 7 (Mac): live DB migrated, invite-only verified
- Pulled Sessions 5–6, rebased this device's pending CATCHUP notes, pushed.
- **Applied `20260702150000_invite_only_demo_requests` to the live DB**
  (`prisma migrate deploy` — deliberately did NOT reseed, protecting the
  rotated admin password). Confirmed via MCP: DemoRequest table live, RLS on,
  3 migrations recorded.
- Browser-verified the public half of invite-only on this device:
  `/register` → `/request-demo` redirect, register API 403s, demo-request
  form page renders (café-print), POST creates a NEW row and dev-logs the
  DEMO_REQUEST alert email to the platform admin. Test row removed.
- **Not verified here**: the admin-side walk (inbox → provision → OTP login →
  forced password change) needs the rotated admin password, which only the
  user has. Everything is in place for them to run it.
- The `supabase-hubz` MCP server registered in Session 3 finally loaded on
  this device — schema checks/SQL now run through it (scoped to HubzCRM).

### 2026-07-02 — Session 6 (Windows device): admin access sorted, live-DB state
- Confirmed the platform-admin account exists and is correctly shaped in the
  HubzCRM Supabase DB (seeded in Session 3: rhlhabibli@gmail.com,
  isPlatformAdmin, no business link).
- **Rotated the admin password** via SQL (bcrypt hash only; the plaintext was
  handed to the user in chat and should be changed at first login — the
  Settings → Account form exists once the invite-only code is running).
  ⚠ Re-running the seed overwrites it from ADMIN_EMAIL/ADMIN_PASSWORD in the
  Mac's .env.
- The Claude Supabase connector on the Windows device was signed into the
  wrong Supabase account (o8s org); user reconnected it to the account owning
  HubzCRM — DB is now manageable from both devices via MCP.
- **Live DB does NOT yet have the Session 5 migration**
  (`20260702150000_invite_only_demo_requests`: DemoRequest table +
  User.mustChangePassword). A direct apply was declined by the permission
  layer (schema change beyond the request). It applies with the next
  `npm run db:migrate` (Mac after `git pull`, or Windows once `.env` is
  copied). Until then: login works; the demo-request inbox and forced
  password change need the migrate first.
- Still pending: `.env` copy to the Windows device (blocks local run +
  browser verification of the invite-only flow), then the Vercel deploy.

### 2026-07-02 — Session 5 (Windows device): invite-only onboarding
- **Registration is gone.** `/register` redirects to the new `/request-demo`
  marketing page (café-print design); `/api/auth/register` always 403s. All
  marketing CTAs relabeled ("Request a demo"), copy softened to
  white-glove-onboarding language.
- **Demo requests**: public form (rate-limited 3/h/IP + honeypot) creates a
  `DemoRequest` row and emails every platform admin. New admin inbox at
  `/admin/demo-requests` (status tabs NEW/CONTACTED/CONVERTED/DISMISSED,
  notes, mailto/tel links, overview stat card, nav item). CONVERTED is a
  terminal status only the provisioning flow can set.
- **One-time-password provisioning**: `/admin/businesses/new` no longer asks
  for a password — the server generates `K7MF-2QWX-9HTC`-style OTPs (crypto
  random, unambiguous alphabet), shown exactly once with a copy button.
  `?fromRequest=<id>` prefills from a demo request and marks it CONVERTED in
  the same transaction. Deleting a business un-links + reverts its source
  request to CONTACTED.
- **Forced password change**: owners provisioned with an OTP get
  `mustChangePassword`; login routes them to `/change-password` ("Set your
  password") and both app shells (tenant + admin) redirect there until done.
  Voluntary changes live in Settings → Account (current password required);
  the email reset flow also clears the flag. Session JWT carries the flag and
  is re-issued on change.
- New migration `20260702150000_invite_only_demo_requests` (DemoRequest table
  + User.mustChangePassword + RLS) — generated offline, applies with
  `npm run db:migrate`.
- Built by 4 parallel agents; build passed first try (46 routes); adversarial
  review confirmed 6 minor findings, all fixed (dismissed-lead conversion
  guard, admin-layout flag enforcement, CONVERTED transition lockdown,
  settings-form success feedback, client minLength, dangling
  convertedBusinessId on business delete).
- **Still pending on this device**: `.env` with the Supabase connection
  strings hasn't been copied from the Mac yet, so browser verification of
  this feature and the earlier register-failure report are both blocked on
  that. After copying: `npm run db:migrate && npm run dev`, then log in at
  `/admin` and walk demo-request → provision → OTP login → forced change.

### 2026-07-02 — Session 4: marketing site (landing + about), "café print" design
- Replaced the placeholder landing with a full marketing site in a committed
  editorial aesthetic: paper/espresso/ember/moss palette, Fraunces display
  serif + Schibsted Grotesk body + Spline Sans Mono "receipt" voice (fonts
  via next/font, scoped to `.mkt` so the owner app/admin keep system fonts).
- **Landing** (`/`): staggered hero word cascade, interactive phone demo of
  the real funnel (tap a star → both doors, compliance made tangible),
  parallax floating chips + coffee-ring décor, review marquee, 3-step
  how-it-works, 4-feature product tour with CSS UI vignettes, dark
  stats section with an animated perforated **receipt** (counters), moss
  compliance section, testimonials, pricing (plan card + receipt), FAQ
  accordions, ember CTA, footer with ghost wordmark.
- **About** (`/about`): manifesto hero, origin-story review card, principle
  quote, 4 values, roadmap timeline (phases as courses; statuses match
  docs/04-roadmap.md).
- Motion system in `src/components/marketing/motion.tsx` (Reveal/Parallax/
  Counter — IntersectionObserver + rAF, no library, honors
  prefers-reduced-motion); keyframes/utilities in globals.css under `.mkt`.
- Logged-in users still skip the landing (redirect to /dashboard or /admin).
- Fixed local tooling: corrupted `@next/swc-darwin-arm64` binary (was
  forcing WASM fallback + webpack cache corruption) — reinstalled per
  lockfile; builds went 8.7s → 1.6s.
- Verified in browser: desktop + mobile viewports, hamburger menu, star demo
  interaction, counters, production build (40 pages).
- **Rate limiting now enforces only in production** (`RATE_LIMIT_ENABLED`
  overrides either way): local dev shares one IP bucket, so manual testing
  tripped the 5/h register cap and blocked account creation. Prod unchanged.
- Agreed next step: **go-live session** — move Supabase out of Tokyo (empty
  DB, 10-min job), Vercel deploy + cron, Resend key + domain, privacy/terms
  pages, Sentry. Then phases per docs/04-roadmap.md triggers; start
  Meta/WhatsApp/A2P paperwork early (1–4 week lead times, gates Phase 4).

### 2026-07-02 — Session 3: Postgres/Supabase, all of Phase 2, platform admin panel
- **Supabase**: new account/project "HubzCRM" (`mmmsjhpdoljutekishht`,
  ap-northeast-1). MCP server `supabase-hubz` registered in the project-local
  Claude config (PAT auth, scoped to this project). DB password was reset via
  the Management API; connection strings live in `.env` (pooler transaction
  mode for runtime, session mode for migrations).
- **Postgres migration**: provider switched to `postgresql` + `directUrl`,
  fresh init migration, RLS enabled on every table (Prisma is table owner —
  unaffected; blocks Supabase's auto data API). Customer search is now
  case-insensitive (`mode: "insensitive"`).
- **Phase 2 built and browser-verified end-to-end**:
  - Mail layer `src/lib/mail.ts` (Resend REST, EmailLog audit table,
    DEV_LOGGED fallback without a key) — no RESEND_API_KEY configured yet.
  - Complaint alert on rating≤3 (fires via `after()`, deduped by
    `Review.alertSentAt`, toggle in Settings → Notifications).
  - Weekly digest (`src/lib/digest.ts`): cron route (Bearer CRON_SECRET,
    Mondays 08:00 UTC in vercel.json) + admin run-now; also purges stale
    rate-limit rows.
  - Password reset: /forgot-password + /reset-password, hashed single-use 1h
    tokens, no user enumeration; reset link is dev-logged without Resend.
  - Rate limiting (Postgres fixed-window, fail-open) on public funnel + auth
    endpoints; `website` honeypot on the funnel forms.
- **Platform admin panel `/admin`** (dark shell): overview stats, business
  CRUD + suspend (blocks login + 404s the funnel) + delete (typed confirm),
  user CRUD (self-demote/delete blocked), cross-tenant review browser,
  email log + test-send, system health (DB latency, env checks). Gated by
  `User.isPlatformAdmin` JWT claim; seed upserts the admin from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` (currently rhlhabibli@gmail.com).
- **Gotcha discovered**: Tokyo region + distant dev machine = ~1.8s warm
  queries, ~6s connection opens. `.env` now uses
  `connection_limit=10&pool_timeout=60&connect_timeout=30`. Consider moving
  the Supabase project to a closer region (DB is trivially recreatable) or
  deploying Vercel functions in hnd1/icn1.
- **In flight / next**: Vercel deploy (only remaining Phase 2 item), set
  RESEND_API_KEY + MAIL_FROM when the sending domain exists, Phase 2
  paperwork (Meta/WhatsApp/A2P). Committed locally; not yet pushed.

### 2026-07-02 — Session 2: per-business loyalty config, GitHub setup
- **Loyalty rules are now configurable per business** (user requirement:
  every business sets its own logic). New columns on `Business`:
  `pointsPerVisit`, `silverThreshold`, `goldThreshold`, `vipThreshold`
  (defaults 10/5/10/20). New Settings → "Loyalty program" card to edit them
  (Owner/Admin only, Silver < Gold < VIP enforced). Saving recalculates every
  existing customer's tier via `PATCH /api/business/loyalty`. Visit logging
  and the QR check-in now read the business's own config instead of
  constants.
- Pushed the repo to GitHub: https://github.com/o8sdev/hubzloyalty
- Created this CATCHUP.md; it gets updated every session (rule in CLAUDE.md).

### 2026-07-02 — Session 1: strategy, scaffold, full Phase 1 build
- Ran a 4-lens critique panel on the product brief. Biggest outcome: the
  spec'd ">=4 stars → Google, <=3 → private" flow is illegal review gating —
  redesigned to an ungated funnel (both options always shown, emphasis
  adapts). Also inverted the roadmap: review funnel ships first, CRM is its
  byproduct. Full analysis in `docs/00-product-strategy.md`.
- Scaffolded Next.js 15 + Prisma manually (pinned versions), 9-table schema,
  JWT session auth (jose + bcryptjs), zod validation layer, UI kit.
- Built Phase 1 with 4 parallel agents: Settings + QR code, Customer CRM
  (list/detail/edit/visits/CSV export), public review funnel `/r/[slug]`,
  dashboard + demo seed (30 customers, 376 visits, 45 reviews).
- Adversarial review pass confirmed 12 findings; all fixed. Highlights:
  open redirect in login `next` param; public endpoint could flip marketing
  consent on existing customers (now the funnel only ever *creates* customer
  records); race condition double-counting loyalty visits (atomic claim);
  CSV formula injection; cleared form fields not persisting; birthdays
  rendering a day early; a reintroduced gating pattern on the funnel's done
  screen (Google reminder was 4★+ only — now rating-neutral).
- Verified end-to-end in the browser: login → dashboard stats → 2-star guest
  flow → private note + contact capture → landed in inbox/CRM with 1 visit,
  10 points, consent recorded.
- Known accepted gaps (documented in `docs/03-api.md`): no rate limiting on
  public endpoints yet (Phase 2), no password reset (Phase 2), search is
  case-sensitive on SQLite (goes away with Postgres).
