# LoyaltyCRM — agent notes

SaaS for cafés/restaurants: ungated QR review funnel + customer CRM + (later)
loyalty & campaigns. Next.js 15 App Router, TS strict, Tailwind v4, Prisma 6,
SQLite dev / Postgres prod, jose JWT cookie sessions.

## Commands
- `npm run dev` / `npm run build`
- `npm run db:migrate` / `npm run db:seed` (demo login: demo@loyaltycrm.test / demo1234, funnel: /r/demo-cafe)

## Hard rules
- **Tenancy:** every authenticated Prisma query is scoped by `session.businessId`
  (`findFirst({ where: { id, businessId } })`, never bare `findUnique(id)`).
  Public endpoints (`/api/public/*`) resolve business from slug/row, never
  from client input.
- **Compliance:** the review funnel must stay UNGATED (all ratings see both
  the Google link and the private note option; emphasis may differ). Never
  award points for reviews. Marketing consent is opt-in only and never
  downgraded from the public funnel.
- **Schema stays SQLite-compatible** (no enums/Json) until the Postgres
  migration (docs/02-database.md). Enum-like values live in
  `src/lib/validation.ts`; money is integer cents.
- Sessions: `requireSession()` in pages, `requireApiSession()` in API routes;
  validate bodies with `parseBody(req, zodSchema)` from `src/lib/http.ts`.
- UI primitives come from `src/components/ui.tsx`; brand palette classes
  `bg-brand-700` etc. (defined in `src/app/globals.css` @theme).
- Next 15: `params`/`searchParams` are Promises — await them.
- **Loyalty economics are per-business** (Business.pointsPerVisit /
  silverThreshold / goldThreshold / vipThreshold). Never hardcode tier math:
  load the business config and pass it to `tierForVisits(visits, config)`.
  Threshold changes go through PATCH /api/business/loyalty (bulk tier
  recompute).

## Session hygiene
Update **CATCHUP.md** (repo root) at the end of every working session: date,
what changed, why, and anything in-flight — the user reads it on other
devices to catch up. Push to GitHub (origin = o8sdev/hubzloyalty) when the
user asks for changes to be committed.

## Roadmap discipline
Phases and their build triggers live in docs/04-roadmap.md — check the
trigger before building Phase 3+ features.
