# LoyaltyCRM

Customer growth system for cafés, restaurants and small hospitality
businesses: an ungated QR review funnel that collects Google reviews,
intercepts complaints privately, and builds a consent-based customer database
with visit-driven loyalty.

## Quick start

```bash
cp .env.example .env       # fill in Supabase URLs + secrets (see comments)
npm install                # also runs prisma generate
npm run db:migrate         # apply migrations (Supabase Postgres)
npm run db:seed            # demo business + realistic data + platform admin
npm run dev                # http://localhost:3000
```

Demo login: `demo@loyaltycrm.test` / `demo1234`
Demo guest funnel: http://localhost:3000/r/demo-cafe
Platform admin: `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` → lands at `/admin`

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/00-product-strategy.md](docs/00-product-strategy.md) | Product critique, market validation, MVP scope (and why the review funnel is ungated) |
| [docs/01-architecture.md](docs/01-architecture.md) | Stack rationale, system diagram, tenancy model, folder structure |
| [docs/02-database.md](docs/02-database.md) | ER diagram, design decisions, indexes, Postgres migration plan |
| [docs/03-api.md](docs/03-api.md) | REST surface, trust zones, future module contracts |
| [docs/04-roadmap.md](docs/04-roadmap.md) | Phases 1–6 with usage-based build triggers |

## Status

Phase 1 (the wedge) and Phase 2 (notifications & trust) are implemented:
auth + password reset, business profile + QR, public review funnel (rate
limited + bot guarded), feedback inbox with complaint alert emails, weekly
owner digest, customer CRM, dashboard, Supabase Postgres, and a platform
admin panel at `/admin`. Remaining before the first pilot: Vercel deploy.
See the roadmap for what's next and what deliberately isn't built yet.

## Compliance notes

- The review funnel is **ungated**: every guest, at every rating, is offered
  both the public Google review and the private feedback option (Google
  review policy + FTC 16 CFR Part 465).
- No points or rewards are ever granted for leaving a review.
- Marketing consent is explicit opt-in, captured with clear wording, and
  never downgraded by the public funnel.
