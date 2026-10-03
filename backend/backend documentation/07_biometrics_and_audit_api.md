# Ankelba Backend Documentation — Biometrics & Security Audit APIs

**Target Modules:** Biometric Pickup Identity Verification, Manual Fallback Workflows, Security Audit Trail  
**Base Path:** `/api`  
**SRS References:** FR-BIO-01–10, FR-AUD-01–05, UC-07  

---

## 1. Biometric Guardian Verification API (`/api/biometric`)

Ankelba enhances child dismissal safety by performing biometric template verification (or authorized manual fallback) before releasing a child to an adult guardian.

### 1.1 Enroll Guardian Biometric Reference (Admin Only)
* **Endpoint:** `POST /api/biometric/enroll`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "guardian_link_id": 10,
    "modality": "fingerprint", // 'fingerprint' | 'facial'
    "template_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 5,
    "guardian_link_id": 10,
    "modality": "fingerprint",
    "is_active": true,
    "enrolled_at": "2026-09-16T12:00:00.000Z"
  }
  ```

---

### 1.2 Verify Guardian at Child Pickup (Caregiver & Admin)
Executed by the caregiver at the daycare gate or classroom door when an adult arrives to collect a child.

* **Endpoint:** `POST /api/biometric/verify`
* **Access:** `admin`, `caregiver`
* **Request Body — Biometric Mode:**
  ```json
  {
    "child_id": 1,
    "guardian_link_id": 10,
    "verification_mode": "biometric",
    "similarity_score": 0.94, // Float value from scanner
    "notes": "Verified via entrance fingerprint scanner"
  }
  ```
* **Request Body — Manual Fallback Mode (e.g. Scratched finger / Sensor offline):**
  ```json
  {
    "child_id": 1,
    "guardian_link_id": 10,
    "verification_mode": "manual_fallback",
    "override_reason": "Guardian bandaged index finger; government ID badge inspected by Teacher Tigist",
    "notes": "Verified against national ID"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "verification_event_id": 48,
    "child_id": 1,
    "guardian_link_id": 10,
    "verified_by": 23,
    "verification_mode": "biometric",
    "status": "verified",
    "timestamp": "2026-09-16T16:05:00.000Z"
  }
  ```
* **Error Guards:**
  * If the guardian is not authorized or not linked to the child:
    ```json
    { "error": "Unauthorized pickup attempt: Guardian is not linked to this child" } // HTTP 403
    ```
  * If `manual_fallback` is submitted without `override_reason`:
    ```json
    { "error": "override_reason is required for manual fallback verification" } // HTTP 422
    ```

---

### 1.3 Check Guardian Biometric Enrollment Status (Admin Only)
* **Endpoint:** `GET /api/biometric/guardian/:id`
* **Access:** `admin` only
* **Success Response (`200 OK`):** Returns whether a biometric template is on file, the active modality, and last verification timestamp.

---

## 2. Security Audit Trail API (`/api/audit`)

In compliance with **FR-AUD-01 through FR-AUD-05**, Ankelba maintains an append-only, tamper-evident security audit log recording administrative operations, role modifications, and child records mutations.

### 2.1 List Audit Log Records (Admin Only)
* **Endpoint:** `GET /api/audit`
* **Access:** `admin` only (Parents and Caregivers are strictly blocked with `403 Forbidden`).
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  |---|:---:|:---:|---|
  | `page` | `integer` | `1` | Page number |
  | `limit` | `integer` | `50` | Records per page (max 100) |
  | `action` | `string` | — | Filter by action (e.g. `USER_CREATED`, `ORDER_PLACED`, `BIOMETRIC_ENROLLED`) |
  | `user_id` | `integer` | — | Filter actions performed by a specific user |
  | `startDate` | `string` | — | `YYYY-MM-DD` |
  | `endDate` | `string` | — | `YYYY-MM-DD` |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 52,
        "user_id": 22,
        "user_name": "Admin Director",
        "action": "CHILD_ENROLLED",
        "entity_type": "children",
        "entity_id": 4,
        "ip_address": "::1",
        "metadata": {
          "child_name": "Dawit Haile",
          "group_id": 1,
          "enrolled_by": "admin@ankelba.dev"
        },
        "created_at": "2026-09-16T11:15:30.000Z"
      }
    ],
    "total": 52,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
  ```

### 2.2 Frontend UI Suggestions for Security Audit
* Implement a search bar and multi-select filter for `action` types (`AUTH_LOGIN`, `CHILD_ENROLLED`, `STATUS_CHANGED`, `PAYMENT_RECEIVED`).
* Render `metadata` as an expandable JSON or formatted key-value badge list.
