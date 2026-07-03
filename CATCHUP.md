# CATCHUP — read this first on a new device

**What this is:** LoyaltyCRM (repo: hubzloyalty) — a SaaS for cafés/restaurants.
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
invite-only onboarding, staff-confirmed check-ins, welcome rewards, and an
installable PWA. Only Phase 2 item left is the first Vercel deploy. Phases
and their build triggers: `docs/04-roadmap.md`.

**Onboarding is INVITE-ONLY** (as of Session 5): no self-registration.
Prospects submit `/request-demo`; the platform admin works the inbox at
`/admin/demo-requests` and provisions businesses with a one-time password;
owners set their own password at first login.

---

## Session log (newest first)

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
