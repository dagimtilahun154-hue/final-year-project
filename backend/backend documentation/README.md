# Ankelba Backend API Documentation for Frontend Engineering

Welcome to the **Ankelba Backend Documentation Suite**. This repository of technical guides was prepared specifically for the frontend engineering team to design, build, and integrate the user interfaces for the Ankelba Daycare Platform.

All endpoints, response shapes, error contracts, and schemas documented here reflect the **live, tested, and audited PostgreSQL 18 + Node.js Express backend**.

---

## 📚 Documentation Index

| File | Document Title | Target Features / Scope |
|:---:|---|---|
| [**`00_overview_and_auth_guide.md`**](./00_overview_and_auth_guide.md) | **Overview & Authentication Guide** | Network & CORS, dual-path JWT (Cookies + Headers), login, logout, password recovery, error handling standards, and RBAC matrix. |
| [**`01_users_and_groups_api.md`**](./01_users_and_groups_api.md) | **Users, Groups & Dashboard APIs** | Admin user management, self-service profile (`/me`), class groups CRUD with child counter, and admin dashboard KPI telemetry. |
| [**`02_children_and_guardians_api.md`**](./02_children_and_guardians_api.md) | **Children & Guardians APIs** | Child enrollment, 3-query profile assembly, emergency contacts CRUD, care instructions CRUD, and guardian linkage with biometric flag. |
| [**`03_attendance_and_reports_api.md`**](./03_attendance_and_reports_api.md) | **Attendance & Daily Reports APIs** | Attendance state machine (`checkin`/`checkout`), live center roster grid, summary aggregations, daily activity reporting (meals & naps), and caregiver completion monitor. |
| [**`04_health_and_communication_api.md`**](./04_health_and_communication_api.md) | **Health, Announcements & Messaging APIs** | Incident documentation, mandatory medical disclaimer (`FR-HIR-06`), announcements, weekly meal plans, direct messaging threads, and urgent alerts. |
| [**`05_store_and_payments_api.md`**](./05_store_and_payments_api.md) | **Store & Payments APIs** | Merchandise categories, product catalog browsing, cart ordering with price snapshots, automatic low-stock alert engine ($\le 5$), and payments (Pay at Daycare + Digital Chapa). |
| [**`06_events_and_ai_guide_api.md`**](./06_events_and_ai_guide_api.md) | **Events Calendar & AI Guide APIs** | Center events calendar, soft-cancellations, rule-governed AI Parent Guide assistant with non-medical safety guardrails and age-context injection. |
| [**`07_biometrics_and_audit_api.md`**](./07_biometrics_and_audit_api.md) | **Biometrics & Security Audit APIs** | Guardian pickup biometric template enrollment, pickup identity verification, manual fallback with mandatory reason note, and security audit log trail. |
| [**`08_notifications_and_search_api.md`**](./08_notifications_and_search_api.md) | **Notifications & Global Search APIs** | Universal header bell notification badge counter, role-specific badge breakdown, and privacy-preserving multi-entity global search bar. |
| [**`09_frontend_data_types_and_enums.md`**](./09_frontend_data_types_and_enums.md) | **TypeScript Models, DTOs & Enums** | Complete TypeScript type definitions, domain enums, and ready-to-use Axios client setup with interceptors. |

---

## 🚀 Quick Setup for Frontend Devs

1. **Backend Server URL:** `http://localhost:5000`
2. **API Prefix:** `/api`
3. **Health Check:**
   ```bash
   curl http://localhost:5000/health
   # Response: {"status":"ok","service":"ankelba-backend", ...}
   ```
4. **Seed Test Accounts:**
   * **Admin:** `admin@ankelba.dev` / `Admin@123!`
   * **Caregiver:** `caregiver@ankelba.dev` / `Care@123!`
   * **Parent:** `parent@ankelba.dev` / `Parent@123!`
5. **Running Test Verification:**
   ```bash
   cd backend
   npm test
   # Runs master_audit.js (54/54 automated test assertions)
   ```
