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
Prisma 6, SQLite dev (Postgres for prod later), jose JWT sessions.

**Roadmap position:** Phases 1 AND 2 are done (plus a platform-admin panel
at `/admin`). The only Phase 2 item left is the first Vercel deploy. Phases
and their build triggers: `docs/04-roadmap.md`.

---

## Session log (newest first)

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
