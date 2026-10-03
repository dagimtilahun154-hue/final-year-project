# Ankelba Backend Documentation — Overview & Authentication Guide

**Target Audience:** Frontend Engineering Team (Web / Mobile)  
**System:** Ankelba Daycare Communication & Activity Reporting Platform  
**Backend Base URL (Local):** `http://localhost:5000`  
**API Prefix:** `/api`  
**API Health Check:** `GET /health` (No authentication required)  
**SRS Reference:** [Ankelba_SRS_AI_Readable.md](file:///c:/Users/Mistire/Desktop/final%20year%20project/Ankelba_SRS_AI_Readable.md)

---

## 1. Network & CORS Configuration

The backend is configured with Cross-Origin Resource Sharing (CORS) for `http://localhost:3000` (or the URL specified in `.env` as `FRONTEND_URL`).

### Critical Client Requirement:
When using `axios` or native `fetch`, **you MUST enable credentials** so that secure HttpOnly cookies are transmitted back and forth.

```typescript
// Axios Configuration Example
import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true, // MANDATORY for cookie-based authentication
  headers: {
    'Content-Type': 'application/json',
  },
});
```

---

## 2. Authentication Architecture

Ankelba implements a **dual-path JWT authentication system**:
1. **HttpOnly Secure Cookie:** On successful login, the server sets a cookie named `jwt` (valid for 7 days, `sameSite: 'lax'`).
2. **Bearer Token Header:** The login response also returns `{ token, user }`. The frontend can store this in memory or localStorage and pass it in the `Authorization: Bearer <token>` header.

The backend middleware checks the `Authorization` header first; if absent, it falls back to `req.cookies.jwt`.

---

## 3. Global Response & Error Handling Standards

### 3.1 Standard Success Response Shapes
* **Single Resource / Action:**
  ```json
  {
    "id": 1,
    "name": "Sample Entity",
    "created_at": "2026-09-16T10:00:00.000Z"
  }
  ```
* **Paginated List:**
  ```json
  {
    "data": [ ... ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
  ```

### 3.2 Standard Error Response Shape
All error responses conform to the following schema:
```json
{
  "error": "Human-readable error explanation",
  "details": [ ... ] // Optional: Joi validation failure messages or field keys
}
```

### 3.3 HTTP Status Code Mapping for Frontend UI

| HTTP Status | Meaning | Frontend Action / UI State |
|:---:|---|---|
| **`200 OK`** | Request succeeded | Update UI state, resolve promise. |
| **`201 Created`** | Resource successfully created | Display success toast, redirect or refresh table. |
| **`204 No Content`** | Action completed with empty body | Typically used for deletes or link removals. |
| **`400 Bad Request`** | Invalid business request or expired token | Display error banner to user. |
| **`401 Unauthorized`** | Missing, invalid, or expired authentication | Clear local user state, redirect to `/login`. |
| **`403 Forbidden`** | Insufficient RBAC role or unlinked child access | Show "Access Denied" or lock restricted tab. |
| **`404 Not Found`** | Requested resource does not exist | Show 404 Empty State illustration. |
| **`409 Conflict`** | Unique constraint violation (e.g. email exists) | Highlight conflicting input field with inline warning. |
| **`422 Unprocessable`** | Request schema validation failure | Map `details` array to form field error texts. |
| **`429 Too Many Requests`** | Rate limit exceeded (Auth: 100/15m; API: 2000/15m) | Show "Too many attempts, please wait a few minutes". |
| **`500 Internal Error`** | Server error | Show fallback "Something went wrong" toast. |

---

## 4. User Roles & RBAC Navigation Matrix

There are three primary roles in Ankelba:

| Role Identifier | Role ID | Target Persona | Navigation & Permitted Sections |
|---|:---:|---|---|
| **`admin`** | `1` | Daycare Director / Manager | Full System Access: User Management, Children Enrollment, Roster, Groups, Attendance Center Grid, Staff Completion Monitor, Store Catalog & Orders, Events, Biometric Enrollment, Audit Logs, Center Dashboard. |
| **`caregiver`** | `2` | Teachers & Daycare Staff | Daily Classroom Hub: Assigned Children, Check-in/Check-out, Daily Activity Reports (Meals & Naps), Health & Incidents, Messaging with Parents, Biometric Pickup Verification. |
| **`parent`** | `3` | Guardians & Parents | Family Portal: Linked Children Profiles, Daily Activity Timeline, Child Attendance History, Health History, Store & Ordering, AI Parent Guide, Direct Messaging with Teachers, Center Announcements & Urgent Alerts. |

---

## 5. Authentication Endpoints Specification

### 5.1 User Login
* **Endpoint:** `POST /api/auth/login`
* **Access:** Public (Rate-limited)
* **Request Body:**
  ```json
  {
    "email": "parent@ankelba.dev",
    "password": "Parent@123!"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 24,
      "email": "parent@ankelba.dev",
      "name": "Sara Haile",
      "role": "parent",
      "role_id": 3,
      "status": "active"
    }
  }
  ```
* **Sets Cookie:** `jwt=<token>; HttpOnly; Path=/; Max-Age=604800`

---

### 5.2 Get Current User Profile
* **Endpoint:** `GET /api/auth/me`
* **Access:** Authenticated (Any role)
* **Headers:** `Authorization: Bearer <token>` (or cookie)
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 24,
    "email": "parent@ankelba.dev",
    "name": "Sara Haile",
    "role": "parent",
    "role_id": 3,
    "status": "active",
    "created_at": "2026-08-15T08:30:00.000Z"
  }
  ```
* **Failure Response (`401 Unauthorized`):**
  ```json
  { "error": "Authentication token missing" }
  ```

---

### 5.3 User Logout
* **Endpoint:** `POST /api/auth/logout`
* **Access:** Authenticated
* **Behavior:** Clears the server-side `jwt` HttpOnly cookie.
* **Success Response (`200 OK`):**
  ```json
  { "message": "Logout successful" }
  ```

---

### 5.4 Forgot Password (Initiate Reset)
* **Endpoint:** `POST /api/auth/forgot-password`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "email": "parent@ankelba.dev"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "message": "If this email exists in our system, password reset instructions have been dispatched.",
    "reset_token": "a1f9e87c0e5b..." // Provided in development environment for immediate testing
  }
  ```
  *(Note: Backend prevents email enumeration; non-existent emails return the exact same 200 response).*

---

### 5.5 Reset Password (Complete with Token)
* **Endpoint:** `POST /api/auth/reset-password`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "token": "a1f9e87c0e5b...",
    "new_password": "NewSecurePassword@123!"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "message": "Password successfully reset. You may now log in with your new credentials."
  }
  ```
* **Error Response (`400 Bad Request`):**
  ```json
  { "error": "Invalid or expired password reset token" }
  ```

---

### 5.6 Change Password (Authenticated User)
* **Endpoint:** `PATCH /api/auth/change-password`
* **Access:** Authenticated (Any role)
* **Request Body:**
  ```json
  {
    "current_password": "CurrentPassword@123!",
    "new_password": "NewSecurePassword@123!"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  { "message": "Password changed successfully" }
  ```
* **Error Response (`401 Unauthorized`):**
  ```json
  { "error": "Current password incorrect" }
  ```
