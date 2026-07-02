# System Architecture — LoyaltyCRM

## Tech stack (and why)

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | One deployable for marketing site, public funnel, owner app, and API. Server components keep the guest-facing funnel page tiny and fast on bad cafe wifi. |
| Styling | **Tailwind CSS v4** | Fast iteration, no design-system overhead at MVP stage. |
| Database | **SQLite (dev) → PostgreSQL (prod)** | Zero-setup local dev. The Prisma schema deliberately avoids enums/Json columns so the switch is a provider + `DATABASE_URL` change and one fresh migration. Production target: Postgres on Supabase/Neon/Railway. |
| ORM | **Prisma 6** | Type-safe queries, migrations, seed tooling. Pinned to v6 (v7 is a major with breaking changes — upgrade deliberately later). |
| Auth | **Hand-rolled JWT sessions (jose + bcryptjs, httpOnly cookie)** | ~120 lines, zero beta dependencies, works on the Edge runtime for middleware. NextAuth v5 is still beta and Clerk is a paid vendor; for credentials-only auth this is the least-risk option. The session layer is a clean seam — swap in Auth.js when Google OAuth is wanted. |
| Validation | **zod** at every API boundary | Single source of truth for enum-like values (SQLite has no enums). |
| QR codes | **`qrcode`** (server-side PNG) | No client JS, downloadable asset for print. |
| Email (Phase 2) | **Resend** | Owner notifications + weekly digest. No approval process, works day 1. |
| Messaging (Phase 4) | **Twilio SMS + WhatsApp Cloud API** behind a `send(channel, template, recipient)` abstraction | Channel registration (A2P 10DLC, Meta verification) starts as paperwork on day 1; code comes later. |
| AI (Phase 5) | **Claude API** (claude-sonnet-5 for copy/summaries) | Feedback summarization, suggested complaint replies, campaign copy. |
| Jobs (Phase 4) | **Vercel Cron / Railway cron** hitting an internal endpoint | A full queue (BullMQ etc.) is unjustified before campaign volume exists. |
| Hosting | **Vercel** (app) + managed Postgres | Zero-ops. Railway as the all-in-one alternative if we outgrow serverless limits. |

**Explicitly not in the stack (yet):** NestJS/separate backend (a second
deployable with zero benefit at this scale), n8n (nothing to orchestrate until
Phase 4), Redis, message queues.

## System diagram

```
                        ┌─────────────────────────────────────────────┐
                        │                 Next.js app                 │
                        │                                             │
  Guest phone ──QR──▶   │  /r/[slug]        public funnel (SSR+tiny   │
                        │                   client flow)              │
                        │      │                                      │
                        │      ▼                                      │
                        │  /api/public/*    unauthenticated, slug/id  │
                        │                   scoped writes             │
                        │                                             │
  Owner browser ──────▶ │  /login /register                           │
                        │  middleware (jose JWT verify, Edge)         │
                        │      │                                      │
                        │      ▼                                      │
                        │  /(app)/*         dashboard, customers,     │
                        │                   reviews, settings (RSC)   │
                        │  /api/*           authenticated REST,       │
                        │                   businessId-scoped         │
                        └──────┬──────────────────────────────────────┘
                               │ Prisma
                               ▼
                        ┌─────────────┐     Phase 2+:  Resend (email)
                        │  SQLite /   │     Phase 4+:  Twilio / WhatsApp
                        │  PostgreSQL │                Cloud API, cron
                        └─────────────┘     Phase 5+:  Claude API
```

## Multi-tenancy model

Single database, shared tables, `businessId` column on every tenant-owned
table. Enforcement rules (reviewed in CI and code review):

1. Every authenticated query includes `businessId` from the session JWT —
   `findFirst({ where: { id, businessId } })`, never bare `findUnique(id)`.
2. Public endpoints resolve the business from the URL slug (or from the
   review row being amended) and never accept a `businessId` from the client.
3. One user belongs to one business (MVP). Multi-location comes later as
   `Organization → Business[]` — the reason `businessId` lives on `Visit` and
   `Review` directly (avoids join-path rewrites later).

## Folder structure

```
loyaltycrm/
├── docs/                       # this documentation set
├── prisma/
│   ├── schema.prisma           # data model (SQLite-compatible subset)
│   ├── migrations/
│   └── seed.ts                 # demo business + realistic data (npm run db:seed)
├── src/
│   ├── middleware.ts           # Edge JWT check for /(app) routes
│   ├── app/
│   │   ├── layout.tsx          # root layout
│   │   ├── page.tsx            # marketing landing
│   │   ├── login/ register/    # auth pages (client forms)
│   │   ├── r/[slug]/           # PUBLIC guest funnel (rate → act → capture)
│   │   ├── (app)/              # authenticated shell (sidebar layout)
│   │   │   ├── dashboard/
│   │   │   ├── customers/      # list, new, [id], [id]/edit + client forms
│   │   │   ├── reviews/        # feedback inbox
│   │   │   └── settings/       # business profile + QR
│   │   └── api/
│   │       ├── auth/           # register, login, logout, me
│   │       ├── business/       # profile CRUD + qr (PNG)
│   │       ├── customers/      # CRUD, visits, export
│   │       ├── reviews/        # inbox list, resolve
│   │       └── public/reviews/ # unauthenticated funnel endpoints
│   ├── components/
│   │   ├── ui.tsx              # server-safe UI kit (Button, Card, badges…)
│   │   ├── app-nav.tsx         # sidebar nav (client, active-state)
│   │   └── logout-button.tsx
│   └── lib/
│       ├── db.ts               # Prisma singleton
│       ├── session.ts          # JWT session create/get/require/destroy
│       ├── http.ts             # json/error helpers, parseBody, requireApiSession
│       ├── validation.ts       # zod schemas, enum constants, tier math, slugify
│       └── utils.ts            # cn, formatMoney, formatDate, daysSince
├── .env / .env.example
└── package.json                # dev/build/db:migrate/db:seed scripts
```

## UI/page map

| Page | Purpose | Key elements |
| --- | --- | --- |
| `/` | Marketing | value prop, CTA to register, link to demo funnel |
| `/login`, `/register` | Auth | minimal card forms |
| `/r/[slug]` | **Guest funnel (mobile-first)** | logo → 5 big stars → *both* Google + private-note options → optional loyalty opt-in → done |
| `/dashboard` | Owner home | 6 stat cards (customers, new 30d, avg rating, Google clicks, visits, needs-attention), attention list, recent customers, onboarding callouts |
| `/customers` | CRM | search/tier filter, table, pagination, CSV export, add |
| `/customers/[id]` | Profile | stats, visits, feedback, log-visit, tags/notes/consent, edit/delete |
| `/reviews` | Feedback inbox | avg rating, tabs (all/attention/resolved), resolve action |
| `/settings` | Business profile | profile form, Google review URL (with how-to), QR preview/download, guest-page preview |
| Sidebar | Navigation | Dashboard/Customers/Reviews/Settings + greyed "Loyalty (Phase 3) / Campaigns (Phase 4) / Analytics (Phase 6)" |

Design language: white cards on `slate-50`, teal brand (`brand-700`), amber
accents for ratings/warnings, generous touch targets on the guest funnel.
