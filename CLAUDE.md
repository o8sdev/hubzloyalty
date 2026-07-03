# LoyaltyCRM — agent notes

SaaS for cafés/restaurants: ungated QR review funnel + customer CRM + (later)
loyalty & campaigns. Next.js 15 App Router, TS strict, Tailwind v4, Prisma 6,
Supabase Postgres + Supabase Auth (project mmmsjhpdoljutekishht).

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
- **Compliance:** the review funnel must stay UNGATED (all ratings see both
  the Google link and the private note option; emphasis may differ). Never
  award points for reviews. Marketing consent is opt-in only and never
  downgraded from the public funnel.
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
- Next 15: `params`/`searchParams` are Promises — await them.
- **Loyalty economics are per-business** (Business.pointsPerVisit /
  silverThreshold / goldThreshold / vipThreshold). Never hardcode tier math:
  load the business config and pass it to `tierForVisits(visits, config)`.
  Threshold changes go through `applyLoyaltyConfig()` in `src/lib/loyalty.ts`
  (bulk tier recompute) — used by both the owner API and the admin panel.
- **Suspension:** `Business.suspendedAt` gates logins, the public funnel page,
  and the public review API — check it in any new public/business-facing path.

## Dev environment gotcha
The Supabase project lives in ap-northeast-1 (Tokyo); from a distant dev
machine a warm query is ~1.8s and a new connection ~6s. `.env` therefore uses
`connection_limit=10&pool_timeout=60&connect_timeout=30` on DATABASE_URL.
Avoid huge `Promise.all` query bursts; on Vercel, deploy functions near the
DB region (hnd1/icn1) or move the Supabase project closer.

## Session hygiene
Update **CATCHUP.md** (repo root) at the end of every working session: date,
what changed, why, and anything in-flight — the user reads it on other
devices to catch up. Push to GitHub (origin = o8sdev/hubzloyalty) when the
user asks for changes to be committed.

## Roadmap discipline
Phases and their build triggers live in docs/04-roadmap.md — check the
trigger before building Phase 3+ features.
