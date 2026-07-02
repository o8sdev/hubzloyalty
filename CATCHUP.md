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

**Onboarding is INVITE-ONLY** (as of Session 5): no self-registration.
Prospects submit `/request-demo`; the platform admin works the inbox at
`/admin/demo-requests` and provisions businesses with a one-time password;
owners set their own password at first login.

---

## Session log (newest first)

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
