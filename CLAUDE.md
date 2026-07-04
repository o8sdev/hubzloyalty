# LoyaltyCRM — agent notes

SaaS for cafés/restaurants: ungated QR review funnel + customer CRM + (later)
loyalty & campaigns. Next.js 15 App Router, TS strict, Tailwind v4, Prisma 6,
Supabase Postgres + Supabase Auth (project ghubhzbvkfjhtywvtvuj, eu-west-1).

## Commands
- `npm run dev` / `npm run build`
- `npm run db:migrate` / `npm run db:seed` (demo login: demo@loyaltycrm.test / demo1234, funnel: /r/demo-cafe, platform admin: ADMIN_EMAIL/ADMIN_PASSWORD from .env → /admin)

## Hard rules
- **Onboarding is invite-only.** There is NO self-serve registration:
  `/api/auth/register` always returns 403 and `/register` redirects to
  `/request-demo`. Businesses are provisioned by the platform admin
  (`/admin/businesses/new`, optionally from a demo request) with a
  server-generated one-time password; the owner must change it at first
  login (`User.mustChangePassword` → `/change-password`). Never reintroduce
  public signup.
- **Tenancy:** every authenticated Prisma query is scoped by `session.businessId`
  (`findFirst({ where: { id, businessId } })`, never bare `findUnique(id)`).
  Public endpoints (`/api/public/*`) resolve business from slug/row, never
  from client input. Only `/api/admin/*` (behind `requireApiPlatformAdmin()`)
  may query cross-tenant.
- **Guest side (consumer app, in progress — see docs/05-guest-app.md).** A
  third user class alongside business members and platform admins: `Guest`
  (own table, `authId` → auth.users, no businessId). Guests **self-register**
  through a *controlled server endpoint* (`supabaseAdmin().auth.admin.*`,
  keeping Supabase `disable_signup` ON) — this is a SEPARATE door from the
  invite-only *business* onboarding above; never let a guest signup create a
  business member or reach `/dashboard`|`/admin`, and never let a business/admin
  session reach `/guest/*`. New guest tenancy rule: `/api/guest/*` is scoped by
  `session.guestId` — a guest may read the PUBLIC directory (businesses where
  `listed = true`) and read/write only their OWN cross-business records (their
  `Customer` rows where `guestId = session.guestId`, and those rows' checkins/
  visits/reviews). One `Guest` ↔ many per-business `Customer` memberships
  (`@@unique([businessId, guestId])`); a scan find-or-creates the membership,
  then reuses the existing staff-confirmed check-in + loyalty engine unchanged.
- **Compliance:** the review funnel must stay UNGATED (all ratings see both
  the Google link and the private note option; emphasis may differ). Never
  award points for reviews (funnel OR in-app `channel="APP"` reviews).
  In-app guest reviews are first-party public content shown in Discover — never
  gated by rating. Marketing consent is opt-in only and never downgraded from
  the public funnel or the guest app.
- **Schema:** enum-like values stay Strings validated in
  `src/lib/validation.ts` (no Prisma enums/Json — keeps churn low); money is
  integer cents. New tables get `ENABLE ROW LEVEL SECURITY` in their
  migration (blocks Supabase's PostgREST; Prisma is unaffected as table owner).
- Sessions: `requireSession()` in pages, `requireApiSession()` in API routes,
  `requirePlatformAdmin()` / `requireApiPlatformAdmin()` for /admin; validate
  bodies with `parseBody(req, zodSchema)` from `src/lib/http.ts`.
- **Auth is Supabase Auth** (`src/lib/supabase.ts` + the session facade in
  `src/lib/session.ts`): identities/credentials/reset emails live in
  auth.users; the domain `User` row (linked by `authId`) owns tenancy facts
  (businessId/role/isPlatformAdmin/mustChangePassword) and MIRRORS them into
  `app_metadata` — any write to those fields must call `syncAuthClaims()`.
  Creating/deleting users goes through `supabaseAdmin().auth.admin.*` with
  compensation on failure; never store passwords in the domain DB. Public
  signups are disabled project-side (`disable_signup`) — provisioning is the
  only door. Session cookies are managed by `@supabase/ssr` (middleware
  refreshes them); `getSession()` verifies via `getUser()` with a short
  in-memory cache.
- **Email** goes through `sendMail()` in `src/lib/mail.ts` (Resend REST,
  never throws, records EmailLog, DEV_LOGGED without RESEND_API_KEY). Slow
  work after a public response uses `after()` from next/server.
- **Public/auth POST endpoints get `rateLimit()`** from `src/lib/ratelimit.ts`
  (Postgres fixed-window, fail-open) and the funnel forms carry the `website`
  honeypot field.
- UI primitives come from `src/components/ui.tsx`; brand palette classes
  `bg-brand-700` etc. (defined in `src/app/globals.css` @theme). The /admin
  shell is dark (slate-900) on purpose — don't blend it with the tenant app.
- **Product brand is HUBz Loyalty** (part of the HUBz ecosystem, alongside
  HUBz Studio). The **wordmark stays monochrome black & white** — a raster asset
  (`HubzWordmark` in `src/components/brand.tsx`, variant light/dark; PNGs in
  `public/brand/`), untouched by CSS tokens. The UI runs a strict **"one colour,
  one job" system** (set 2026-07-04) — enforce it, don't drift:
  - **Grayscale = structure + every neutral action.** `--color-ink` (near-black)
    is PRIMARY buttons, active nav, selected chips/tabs, links, and the top tier
    (VIP); `--color-paper` whisper-grey page, `--color-cream` white cards;
    Tailwind `slate` is remapped to a **cool zinc** ramp (also the /admin dark
    shell). Tier badges are a grey→grey→grey→**black** ladder; star ratings are
    black. Avatars are monochrome (`src/lib/avatar.ts`).
  - **Red = risk + urgency ONLY, kept rare.** `--color-brand-*` (== `--color-ember`
    == brand-600 == `rgb(209 21 48)`) is for destructive actions (the `danger`
    button) and alerts only — complaint `NEW`/callback badges, the dashboard
    attention list. NOT primary buttons, NOT nav, NOT links, NOT tiers. If you
    reach for red on anything that isn't a risk or an alert, use ink instead.
  - **Green (`--color-moss`) = success/consent**; **gold (`--color-gold` /
    `--color-gold-deep`) = reward/loyalty moments only** (welcome-gift tickets).
    Both stay scarce.
  Don't paint the UI red, don't give the wordmark colour, and keep the accents
  rare — scarcity is what makes them read as signals.
- **One typeface product-wide: Space Grotesk** (`--font-app`, set by next/font
  in `layout.tsx`; every font role — body, `.f-display`, `.f-mono`, and
  Tailwind `--font-sans`/`--font-mono`/`--font-serif` — maps to it in
  globals.css). Don't reintroduce Fraunces/Schibsted/Spline; keep the café-print
  colors/grain, just not the old fonts.
- Next 15: `params`/`searchParams` are Promises — await them.
- **Loyalty economics are per-business** (Business.pointsPerVisit /
  silverThreshold / goldThreshold / vipThreshold). Never hardcode tier math:
  load the business config and pass it to `tierForVisits(visits, config)`.
  Threshold changes go through `applyLoyaltyConfig()` in `src/lib/loyalty.ts`
  (bulk tier recompute) — used by both the owner API and the admin panel.
- **Suspension:** `Business.suspendedAt` gates logins, the public funnel page,
  and the public review API — check it in any new public/business-facing path.

## Dev environment notes
The Supabase project lives in eu-west-1 (Ireland; the original Tokyo project
was recreated there 2026-07-03 — old ref mmmsjhpdoljutekishht is dead).
Round trips still dominate from a remote dev machine, so: keep multi-step
flows to few statements, prefer single-statement SQL over read-then-write
pairs, and keep `connection_limit=10&pool_timeout=60&connect_timeout=30` on
DATABASE_URL. On Vercel, pin functions to the DB region (dub1/lhr1).
Interactive `db.$transaction` calls need explicit generous `timeout` —
Prisma's 5s default assumes a next-door DB.

## Session hygiene
Update **CATCHUP.md** (repo root) at the end of every working session: date,
what changed, why, and anything in-flight — the user reads it on other
devices to catch up. Push to GitHub (origin = o8sdev/hubzloyalty) when the
user asks for changes to be committed.

## Roadmap discipline
Phases and their build triggers live in docs/04-roadmap.md — check the
trigger before building Phase 3+ features.
