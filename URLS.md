# HUBz Loyalty — URL cheat sheet

Every route in the app and what it does. Local base URL: `http://localhost:3000`.

**Access legend:** 🌐 public · 🔑 owner/staff (logged-in business) · 👑 platform admin · 🧑 guest (consumer app) · ⚙️ machine (cron/secret)

There are really **two apps** in one codebase: the **owner/business tool** (dashboard, counter, CRM, admin) and the **consumer guest app** (`/guest/*`). The public **review funnel** at `/r/[slug]` is the front door for walk-in guests with no account.

---

## Pages (what you open in a browser)

### Public / marketing
| URL | What it does | Access |
| --- | --- | --- |
| `/` | Marketing landing page (logged-in users are redirected to their dashboard/admin) | 🌐 |
| `/about` | About / manifesto page | 🌐 |
| `/request-demo` | "Request a demo" form — the only way in (invite-only). Creates a lead + emails admins | 🌐 |
| `/register` | Retired — redirects to `/request-demo` | 🌐 |
| `/r/[slug]` | **The guest QR funnel.** Rate → Google review + private note → optional check-in/join. No account needed | 🌐 |

### Auth
| URL | What it does | Access |
| --- | --- | --- |
| `/login` | Owner / admin sign-in | 🌐 |
| `/forgot-password` | Request a password-reset email | 🌐 |
| `/reset-password` | Set a new password (opened from the reset email) | 🌐 |
| `/change-password` | Forced first-login change (OTP accounts) or voluntary change | 🔑 |

### Owner app (the business tool)
| URL | What it does | Access |
| --- | --- | --- |
| `/dashboard` | Owner home — 30-day stats, needs-attention, recent guests, scan chart | 🔑 |
| `/counter` | **Staff check-in console** — type/scan a code, confirm → credits the visit + points | 🔑 |
| `/customers` | Guests CRM — live search, tier/filter facets, CSV export | 🔑 |
| `/customers/new` | Add a guest manually | 🔑 |
| `/customers/[id]` | Guest profile — visits, feedback, tier, points, welcome gift, notes | 🔑 |
| `/customers/[id]/edit` | Edit a guest | 🔑 |
| `/reviews` | Feedback inbox — filter New / needs-attention / resolved | 🔑 |
| `/settings` | Business profile, Google link, QR code, loyalty rules, team, listing/photos, notifications, account | 🔑 |
| `/activity` | Audit log for this business (who did what) | 🔑 |

### Platform admin (dark shell)
| URL | What it does | Access |
| --- | --- | --- |
| `/admin` | Overview — platform-wide stats + new demo-request count | 👑 |
| `/admin/demo-requests` | Demo-request inbox (New/Contacted/Converted/Dismissed) | 👑 |
| `/admin/businesses` | All businesses (suspend / delete) | 👑 |
| `/admin/businesses/new` | Provision a business + owner with a one-time password | 👑 |
| `/admin/businesses/[id]` | Business detail / edit | 👑 |
| `/admin/users` | All users across tenants | 👑 |
| `/admin/users/new` | Create a user | 👑 |
| `/admin/users/[id]` | User detail / edit | 👑 |
| `/admin/reviews` | Cross-tenant review browser | 👑 |
| `/admin/emails` | Email log + test-send | 👑 |
| `/admin/activity` | Platform-wide audit log | 👑 |
| `/admin/system` | System health (DB latency, env checks) | 👑 |

### Guest app (consumer, mobile-first)
| URL | What it does | Access |
| --- | --- | --- |
| `/guest/discover` | Discover directory of listed venues | 🌐 (sign-in banner if logged out) |
| `/guest/business/[slug]` | Venue detail — hero, photos, your loyalty progress, reviews, check-in CTA | 🌐 |
| `/guest/scan` | Camera QR scanner → in-app check-in | 🧑 |
| `/guest/wallet` | Your memberships across venues (points / tier / visits) + live pending code | 🧑 |
| `/guest/profile` | Your guest profile (name/email, logout) | 🧑 |
| `/guest/login` | Guest sign-in | 🌐 |
| `/guest/register` | Guest sign-up (controlled self-signup) | 🌐 |

---

## API endpoints

### Auth `/api/auth/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `POST /api/auth/login` | Owner/admin login (Supabase Auth + profile gate + suspension check) | 🌐 |
| `POST /api/auth/logout` | Sign out (+ audit entry) | 🔑🧑 |
| `GET /api/auth/me` | Current user + their business | 🔑 |
| `POST /api/auth/register` | Always **403** — self-registration is retired | 🌐 |
| `POST /api/auth/forgot` | Send a reset email (no user-enumeration) | 🌐 |
| `POST /api/auth/reset` · `GET` | Complete a password reset via the recovery session | 🌐 |
| `POST /api/auth/change-password` | Change password (verifies current one for voluntary changes) | 🔑 |

### Public funnel `/api/public/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `POST /api/public/reviews` | Star tap — creates the Review row, returns the Google link | 🌐 |
| `PATCH /api/public/reviews/[id]` | Add note / mark Google-clicked / capture contact → mints a check-in code (+ welcome gift on first visit) | 🌐 |
| `GET /api/public/claims/[code]` | Status of a welcome-gift code (PENDING/REDEEMED/EXPIRED) | 🌐 |
| `POST /api/public/demo-requests` | Submit a demo request (rate-limited + honeypot) → emails admins | 🌐 |

### Business `/api/business/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET/PATCH /api/business` | Read / update the business profile (PATCH is owner/admin) | 🔑 |
| `GET /api/business/qr` | The venue's QR code as a PNG (`?download=1` to save) | 🔑 |
| `PATCH /api/business/loyalty` | Update points-per-visit + tier thresholds → recomputes every guest's tier | 🔑 |
| `POST/DELETE /api/business/media` | Add / remove venue photos (Supabase Storage) | 🔑 |
| `POST /api/business/team` | Invite a staff member (one-time password) | 🔑 |
| `DELETE /api/business/team/[id]` | Remove a staff member | 🔑 |

### Customers (CRM) `/api/customers/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET/POST /api/customers` | List (search/filter/paginate) / create a guest | 🔑 |
| `GET/PATCH/DELETE /api/customers/[id]` | Read / edit / delete a guest (**delete is owner-only**, full erasure) | 🔑 |
| `POST /api/customers/[id]/visits` | Log a visit manually → credits points + recomputes tier | 🔑 |
| `GET /api/customers/export` | Download the whole guest list as CSV | 🔑 |

### Reviews (inbox) `/api/reviews/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET /api/reviews` | Inbox list + summary (avg rating, Google clicks, needs-attention) | 🔑 |
| `PATCH /api/reviews/[id]` | Mark a review resolved | 🔑 |

### Counter (staff check-in) `/api/counter/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET /api/counter/pending` | Live queue of pending check-ins (waiter venues) | 🔑 |
| `GET /api/counter/codes/[code]` | Resolve a scanned/typed code → gift or check-in + status | 🔑 |
| `POST /api/counter/codes/[code]/confirm` | **Confirm** → creates the Visit + credits points/tier (the one moment points are minted) | 🔑 |

### Activity (audit) `/api/activity*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET /api/activity` | This business's audit log | 🔑 |
| `GET /api/admin/activity` | Platform-wide audit log | 👑 |

### Admin `/api/admin/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `POST /api/admin/businesses` | Provision a business + owner (returns a one-time password once) | 👑 |
| `PATCH/DELETE /api/admin/businesses/[id]` | Edit (incl. suspend/loyalty) / delete a business | 👑 |
| `POST /api/admin/users` | Create a user | 👑 |
| `PATCH/DELETE /api/admin/users/[id]` | Edit / delete a user (self-demote & self-delete blocked) | 👑 |
| `GET /api/admin/demo-requests` | List demo requests | 👑 |
| `PATCH /api/admin/demo-requests/[id]` | Update a request's status / notes | 👑 |
| `POST /api/admin/digest` | Run the weekly digest now | 👑 |
| `POST /api/admin/test-email` | Send a test email | 👑 |

### Guest app `/api/guest/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `POST /api/guest/auth/register` | Guest sign-up (creates auth user + Guest row, signs in) | 🌐 |
| `POST /api/guest/auth/login` | Guest login (rejects owner/admin identities) | 🌐 |
| `POST /api/guest/checkin` | In-app check-in for a venue → find/create membership, mint a pending code | 🧑 |
| `POST /api/guest/reviews` | Post an in-app review (**requires a confirmed check-in**; never gated, never points) | 🧑 |

### Machine `/api/cron/*`
| Method + path | What it does | Access |
| --- | --- | --- |
| `GET /api/cron/digest` | Weekly owner digest + rate-limit cleanup (Mondays; `Authorization: Bearer CRON_SECRET`) | ⚙️ |

---

## Key flows to remember

- **Walk-in guest (no account):** scan QR → `/r/[slug]` → rate → both doors (Google + private note) → optional check-in → gets a code → **staff confirm at `/counter`** → points credited.
- **App guest:** `/guest/register` → `/guest/discover` → open a venue → **check in** (scan or button) → pending code → staff confirm → points land in `/guest/wallet`. Can post a review only after a confirmed check-in.
- **Onboarding a new café (invite-only):** prospect submits `/request-demo` → you work it in `/admin/demo-requests` → **Register business** → one-time password → owner logs in → forced password change → live.
- **Points are only ever created at `/counter` confirmation** — never automatically, never for a review.
