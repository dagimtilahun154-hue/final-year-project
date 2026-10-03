# Ankelba Backend Documentation — Users, Groups & Dashboard APIs

**Target Modules:** User Administration, User Self-Service Profile, Class Groups Management, Admin Center Dashboard  
**Base Path:** `/api`  
**SRS References:** FR-UAM-01–08, FR-CH-05, UC-01, UC-02  

---

## 1. User Administration API (`/api/users`)

The user management module allows administrators to onboard staff, register parent accounts, manage contact profiles, and control account activation status.

### 1.1 List Users (Admin Only)
* **Endpoint:** `GET /api/users`
* **Access:** `admin` only
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  |---|:---:|:---:|---|
  | `page` | `integer` | `1` | Page number |
  | `limit` | `integer` | `20` | Items per page (max 100) |
  | `role` | `string` | — | Filter by role: `'admin'`, `'caregiver'`, or `'parent'` |
  | `status` | `string` | — | Filter by status: `'active'` or `'inactive'` |
  | `search` | `string` | — | Substring search against user name or email |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 23,
        "name": "Tigist Alemu",
        "email": "caregiver@ankelba.dev",
        "phone": "+251911000002",
        "role": "caregiver",
        "role_id": 2,
        "status": "active",
        "created_at": "2026-08-15T09:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
  ```

---

### 1.2 Create User Account (Admin Only)
* **Endpoint:** `POST /api/users`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "name": "Helen Bekele",
    "email": "helen.b@ankelba.dev",
    "password": "Password@123!",
    "role": "caregiver", // 'admin' | 'caregiver' | 'parent'
    "phone": "+251912345678" // optional
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 67,
    "name": "Helen Bekele",
    "email": "helen.b@ankelba.dev",
    "phone": "+251912345678",
    "role": "caregiver",
    "status": "active",
    "created_at": "2026-09-16T11:20:00.000Z"
  }
  ```
* **Error Response (`409 Conflict`):**
  ```json
  { "error": "A user with this email address already exists" }
  ```

---

### 1.3 Get Single User Details (Admin Only)
* **Endpoint:** `GET /api/users/:id`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 24,
    "name": "Sara Haile",
    "email": "parent@ankelba.dev",
    "phone": "+251911000003",
    "role": "parent",
    "role_id": 3,
    "status": "active",
    "created_at": "2026-08-15T09:15:00.000Z"
  }
  ```

---

### 1.4 Update User (Admin Only)
* **Endpoint:** `PATCH /api/users/:id`
* **Access:** `admin` only
* **Request Body (All fields optional):**
  ```json
  {
    "name": "Sara Haile-Tesfaye",
    "phone": "+251911999888",
    "role": "parent"
  }
  ```
* **Success Response (`200 OK`):** Returns the updated user object.

---

### 1.5 Toggle User Status (Admin Only)
* **Endpoint:** `PATCH /api/users/:id/status`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "status": "inactive" // 'active' | 'inactive'
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 24,
    "status": "inactive",
    "updated_at": "2026-09-16T11:25:00.000Z"
  }
  ```

---

## 2. Self-Service Profile API (`/api/users/profile/me`)

Enables currently authenticated users of any role to inspect their profile and linked children/classes, and update their personal phone or name.

### 2.1 Get My Profile (Any Role)
* **Endpoint:** `GET /api/users/profile/me`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Response for Parent:**
  Attaches `linked_children` array containing the child's ID, full name, DOB, enrollment status, class group, and relationship.
  ```json
  {
    "id": 24,
    "name": "Sara Haile",
    "email": "parent@ankelba.dev",
    "phone": "+251911000003",
    "role": "parent",
    "status": "active",
    "linked_children": [
      {
        "id": 1,
        "full_name": "Abebe Kebede",
        "dob": "2023-04-12",
        "gender": "male",
        "enrollment_status": "active",
        "relationship": "Mother",
        "group_name": "Toddlers Group A"
      }
    ]
  }
  ```
* **Response for Caregiver:**
  Attaches `assigned_children` array containing all children currently assigned to this caregiver.
  ```json
  {
    "id": 23,
    "name": "Tigist Alemu",
    "email": "caregiver@ankelba.dev",
    "role": "caregiver",
    "assigned_children": [
      {
        "id": 1,
        "full_name": "Abebe Kebede",
        "group_name": "Toddlers Group A",
        "enrollment_status": "active"
      }
    ]
  }
  ```

---

### 2.2 Update My Profile (Any Role)
* **Endpoint:** `PATCH /api/users/profile/me`
* **Access:** Authenticated
* **Request Body:**
  ```json
  {
    "name": "Sara Haile Updated",
    "phone": "+251911223344"
  }
  ```
* **Success Response (`200 OK`):** Returns the updated profile object.

---

## 3. Class Groups API (`/api/groups`)

Class groups represent daycare classrooms or age cohorts (e.g., *Infants*, *Toddlers*, *Preschool*).

### 3.1 List Class Groups
* **Endpoint:** `GET /api/groups`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Toddlers Group A",
        "description": "Ages 1.5 to 3 years old",
        "active_children_count": 8,
        "created_at": "2026-08-10T08:00:00.000Z"
      },
      {
        "id": 2,
        "name": "Infants Group B",
        "description": "Ages 6 months to 1.5 years",
        "active_children_count": 4,
        "created_at": "2026-08-10T08:00:00.000Z"
      }
    ]
  }
  ```

---

### 3.2 Create Class Group (Admin Only)
* **Endpoint:** `POST /api/groups`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "name": "Preschool Stars",
    "description": "Children preparing for kindergarten"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 28,
    "name": "Preschool Stars",
    "description": "Children preparing for kindergarten",
    "created_at": "2026-09-16T11:30:00.000Z"
  }
  ```

---

### 3.3 Update Class Group (Admin Only)
* **Endpoint:** `PATCH /api/groups/:id`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "name": "Preschool Superstars",
    "description": "Updated room description"
  }
  ```
* **Success Response (`200 OK`):** Returns updated group record.

---

### 3.4 Delete Class Group (Admin Only)
* **Endpoint:** `DELETE /api/groups/:id`
* **Access:** `admin` only
* **Safeguard:** Cannot delete a group if active children are currently enrolled in it.
* **Success Response (`200 OK`):**
  ```json
  { "message": "Group deleted successfully" }
  ```
* **Error Response (`409 Conflict`):**
  ```json
  { "error": "Cannot delete group: 8 active children are currently assigned to it" }
  ```

---

## 4. Admin Dashboard Metrics API (`/api/dashboard`)

Provides centralized statistics and operational telemetry for the daycare administrative dashboard screen.

* **Endpoint:** `GET /api/dashboard`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  {
    "active_children": 42,
    "total_enrolled": 45,
    "checked_in_today": 36,
    "attendance_rate_today": "85.7%",
    "open_alerts": 2,
    "low_stock_items": 1,
    "pending_store_orders": 3,
    "missing_daily_reports_today": 6
  }
  ```
* **Frontend Component Suggestion:**
  Render 4 KPI summary cards (Total Children, Checked In Today, Pending Orders, Missing Reports) and 2 Alert Callouts (Low-Stock warnings, Emergency alerts).
