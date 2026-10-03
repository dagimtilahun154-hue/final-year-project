# Ankelba Backend

> Parent Communication and Child Activity Reporting Platform for Daycare Centers  
> **HiLCoE — School of Computer Science and Technology, Senior Project 2026**

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js |
| Database | PostgreSQL 15+ |
| Migrations | Knex.js |
| Auth | JWT (HttpOnly cookie) |
| Validation | Joi |
| Logging | Winston + Morgan |
| Password Hashing | bcryptjs |

---

## Project Structure

```
backend/
├── src/
│   ├── config/          # db.js (pg pool), logger.js, knexfile.js
│   ├── middleware/       # auth.js, rbac.js, errorHandler.js, validator.js
│   ├── modules/
│   │   ├── auth/         # login, logout, /me (FULLY IMPLEMENTED)
│   │   ├── users/        # admin user CRUD (FULLY IMPLEMENTED)
│   │   ├── children/     # child profiles, guardian links (SPRINT 1)
│   │   ├── attendance/   # check-in/out (PHASE 2)
│   │   ├── reports/      # daily activity reports (PHASE 2)
│   │   ├── health/       # health & incidents (PHASE 2)
│   │   ├── communication/# messages, announcements, alerts (PHASE 2)
│   │   ├── ai-guide/     # AI parent guide (TBD-03 STUB)
│   │   ├── biometric/    # guardian verification (TBD-01 STUB)
│   │   ├── store/        # products & orders (PHASE 3)
│   │   ├── payments/     # Chapa + Pay at Daycare (TBD-02 STUB)
│   │   ├── events/       # events calendar (PHASE 3)
│   │   └── audit/        # audit logs (PHASE 4)
│   └── db/
│       ├── migrations/   # 010 Knex migration files
│       └── seeds/        # test data (NFR-TST-02)
├── .env                  # NEVER commit — see .env.example
├── .env.example          # template with all required variables
└── server.js             # entry point
```

---

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your local PostgreSQL credentials
```

### 3. Create the PostgreSQL database

```sql
-- Run in psql as superuser:
CREATE DATABASE ankelba_dev;
```

Or via psql CLI:
```bash
psql -U postgres -c "CREATE DATABASE ankelba_dev;"
```

### 4. Run migrations

```bash
npx knex migrate:latest --knexfile src/config/knexfile.js
```

This creates all **28 tables** + **50+ indexes** in dependency order.

### 5. Seed test data

```bash
npx knex seed:run --knexfile src/config/knexfile.js
```

Inserts:
- 3 roles (admin, caregiver, parent)
- 3 test user accounts (one per role)

**Test credentials (dev/test only):**

| Email | Password | Role |
|---|---|---|
| admin@ankelba.dev | Admin@123! | admin |
| caregiver@ankelba.dev | Care@123! | caregiver |
| parent@ankelba.dev | Parent@123! | parent |

### 6. Start the development server

```bash
npm run dev
```

Server runs at `http://localhost:5000`

---

## API Routes

| Method | Route | Access |
|---|---|---|
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/logout` | Authenticated |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/users` | Admin |
| POST | `/api/users` | Admin |
| GET/PATCH | `/api/users/:id` | Admin |
| GET/POST | `/api/children` | Role-based |
| GET/POST | `/api/attendance` | Admin, Caregiver |
| GET/POST | `/api/reports/daily` | Role-based |
| GET/POST | `/api/health` | Role-based |
| GET/POST | `/api/announcements` | Role-based |
| GET/POST | `/api/messages` | Authenticated |
| GET/POST | `/api/alerts` | Role-based |
| POST | `/api/ai/guide` | Parent |
| POST | `/api/biometric/enroll` | Admin |
| GET/POST | `/api/store/products` | Role-based |
| GET/POST | `/api/store/orders` | Role-based |
| GET/POST | `/api/events` | Role-based |
| GET | `/api/audit` | Admin |

---

## Migration Reference

| File | Tables |
|---|---|
| 001_lookup_tables | roles, product_categories, groups |
| 002_core_identity | users, children, emergency_contacts, care_instructions, guardian_links |
| 003_attendance | attendance |
| 004_reporting | daily_reports, report_meals, report_activities, health_records |
| 005_communication | announcements, messages, alerts |
| 006_events | events |
| 007_biometric | biometric_references, guardian_verification_events |
| 008_ecommerce | products, orders, order_items, payments |
| 009_audit | audit_logs |
| 010_indexes | 50+ custom indexes (partial, composite, GIN) |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development` or `production` |
| `PORT` | Yes | Server port (default: 5000) |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (default: 5432) |
| `DB_NAME` | Yes | Database name |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | Strong random secret (64+ chars) |
| `JWT_EXPIRES_IN` | Yes | JWT lifetime (e.g., `24h`) |
| `FRONTEND_URL` | Yes | CORS allowed origin |
| `AI_API_KEY` | No | AI provider key (TBD-03) |
| `CHAPA_SECRET_KEY` | No | Chapa payment key (TBD-02) |
| `CHAPA_WEBHOOK_SECRET` | No | Chapa webhook verification secret |

---

## Implementation Phases

| Phase | Modules | Target |
|---|---|---|
| Foundation | auth ✅, users ✅, children (Sprint 1) | Sep 27 – Oct 10 |
| Core Daycare | attendance, reports, health, communication | Phase 2 |
| Extended | events, store, AI guide | Phase 3 |
| Advanced | payments, biometric, audit | Phase 4 |

---

## TBD Items (Advisor Confirmation Required)

| ID | Item |
|---|---|
| TBD-01 | Biometric device modality and integration API |
| TBD-02 | Chapa payment gateway (sandbox vs. live) |
| TBD-03 | AI provider and data-minimization design |
| TBD-04 | Activity photo sharing |
| TBD-05 | Notification delivery (in-app only vs. email/SMS) |
| TBD-06 | Caregiver-to-child assignment rules |

---

*SRS v1.0 · Backend Architecture Plan v2.0 · Ankelba Project, HiLCoE 2026*
