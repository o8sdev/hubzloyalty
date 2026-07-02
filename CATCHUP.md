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

**Roadmap position:** Phase 1 (review funnel + CRM + dashboard) is done.
Next is Phase 2: complaint alert emails, weekly owner digest, password
reset, rate limiting, first deploy. Phases and their build triggers:
`docs/04-roadmap.md`.

---

## Session log (newest first)

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
