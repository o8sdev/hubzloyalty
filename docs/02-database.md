# Database Design — LoyaltyCRM

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma).
Dev runs SQLite; production is PostgreSQL. The schema avoids enums and Json
columns so the provider switch is mechanical. Enum-like values are validated
with zod in `src/lib/validation.ts` (the single source of truth for allowed
values), and money is stored as **integer cents**.

## ER diagram

```mermaid
erDiagram
    Business ||--o{ User : "has staff"
    Business ||--o{ Customer : "owns"
    Business ||--o{ Visit : "records"
    Business ||--o{ Review : "receives"
    Business ||--o{ Reward : "offers"
    Business ||--o{ Campaign : "runs"
    Customer ||--o{ Visit : "makes"
    Customer ||--o{ Review : "leaves (optional link)"
    Customer ||--o{ Redemption : "redeems"
    Reward   ||--o{ Redemption : "is redeemed as"
    Campaign ||--o{ CampaignRecipient : "targets"

    Business {
        string id PK
        string name
        string slug UK "public handle: /r/[slug]"
        string googleReviewUrl "nullable"
        string socialLinks "JSON string"
        string timezone
    }
    User {
        string id PK
        string email UK
        string passwordHash
        string role "OWNER|STAFF|ADMIN"
        string businessId FK
    }
    Customer {
        string id PK
        string businessId FK
        string firstName
        string phone "nullable"
        string email "nullable"
        datetime birthday "nullable"
        boolean marketingConsent
        int totalVisits
        int totalSpendCents
        int loyaltyPoints
        string tier "BRONZE|SILVER|GOLD|VIP"
        datetime lastVisitAt "nullable"
        string tags "comma-separated"
        string source "MANUAL|QR|IMPORT"
    }
    Visit {
        string id PK
        string businessId FK
        string customerId FK
        int amountCents
        int pointsEarned
        datetime visitedAt
    }
    Review {
        string id PK
        string businessId FK
        string customerId FK "nullable"
        int rating "1-5"
        string comment "nullable"
        boolean clickedGoogle
        string status "NEW|RESOLVED"
        datetime createdAt
    }
    Reward {
        string id PK
        string businessId FK
        string name
        int pointsCost
        boolean active
    }
    Redemption {
        string id PK
        string rewardId FK
        string customerId FK
        int pointsSpent
    }
    Campaign {
        string id PK
        string businessId FK
        string type "WINBACK|BIRTHDAY|VIP|FIRST_VISIT|MANUAL"
        string channel "SMS|EMAIL|WHATSAPP"
        string message
        string status "DRAFT|ACTIVE|PAUSED|SENT"
    }
    CampaignRecipient {
        string id PK
        string campaignId FK
        string customerId
        string status "PENDING|SENT|FAILED"
        datetime sentAt "nullable"
    }
```

## Design decisions

- **`businessId` denormalized onto `Visit` and `Review`** even though it is
  reachable through `Customer`: reviews can exist without a customer (anonymous
  rating), and tenant-scoped queries/aggregations stay single-hop. This is the
  column every dashboard query filters on.
- **`Review` is one table for the whole funnel.** A row is created the moment
  a guest taps a star; `comment`, `clickedGoogle`, and `customerId` are filled
  in by later funnel steps. Rows with `rating <= 3 AND status = 'NEW'` form
  the "needs attention" inbox. No separate Complaint table.
- **Loyalty economics are per-business columns** on `Business`
  (`pointsPerVisit`, `silverThreshold`, `goldThreshold`, `vipThreshold`;
  defaults 10 / 5 / 10 / 20). `tierForVisits(visits, config)` in
  `src/lib/validation.ts` applies them. Tiers are still *stored* on
  `Customer` so lists/filters stay cheap; changing thresholds triggers a
  ranged bulk recompute of all customer tiers (`PATCH /api/business/loyalty`).
- **Consent is a boolean now, an audit log later.** Before Phase 4 messaging
  ships, add `ConsentEvent(customerId, channel, action, wording, ip,
  createdAt)` — required for TCPA/GDPR defensibility. Documented so we don't
  forget why.
- **Cascades:** deleting a Business cascades everywhere (GDPR-friendly
  offboarding). Deleting a Customer cascades visits/redemptions but leaves
  Reviews (`customerId → SetNull`) because ratings are business analytics.
- **No unique constraint on `Customer.phone`**: phones are optional and shared
  devices exist; dedup is handled in the funnel's merge logic (match by phone,
  else email, within the business).

## Indexes

| Table | Index | Serves |
| --- | --- | --- |
| Customer | `(businessId, lastVisitAt)` | winback segments ("no visit in 30d") |
| Customer | `(businessId, phone)` | funnel merge-by-phone |
| Customer | `(businessId, tier)` / `(businessId, createdAt)` | CRM filters, dashboards |
| Visit | `(businessId, visitedAt)` / `(customerId)` | 30-day stats, profile timeline |
| Review | `(businessId, createdAt)` / `(businessId, status, rating)` | inbox + attention filter |
| Campaign | `(businessId, status)` | Phase 4 scheduler |
| CampaignRecipient | `(campaignId, status)` | Phase 4 send loop |

## PostgreSQL migration plan (when a pilot goes live)

1. Provision Postgres (Supabase/Neon), set `DATABASE_URL`.
2. `provider = "postgresql"` in schema; delete `prisma/migrations` (SQLite
   lineage); `prisma migrate dev --name init-postgres`.
3. Optional hardening, same migration: convert enum-like Strings to real
   enums, `socialLinks` to `jsonb`, add `citext` for `User.email`.
4. Seed or CSV-import pilot data. No application code changes required.
