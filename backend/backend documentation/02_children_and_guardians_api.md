# Ankelba Backend Documentation — Children & Guardians APIs

**Target Modules:** Child Profile Management, Guardian Linkage, Emergency Contacts & Care Instructions Sub-resources  
**Base Path:** `/api/children`  
**SRS References:** FR-CH-01–07, UC-03, UC-04  

---

## 1. Children Management Overview

The children module is the core registry of Ankelba. Access is protected by relationship enforcement:
* **Admin:** Unrestricted access to create, update, and manage all enrolled children.
* **Caregiver:** Can query only children actively assigned to their classroom roster.
* **Parent:** Can query and view **only** children linked to their user account via the `guardian_links` table (attempting to access an unlinked child returns `403 Forbidden`).

---

## 2. Children Catalog & Profiles

### 2.1 List Children
* **Endpoint:** `GET /api/children`
* **Access:** `admin`, `caregiver`
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  |---|:---:|:---:|---|
  | `page` | `integer` | `1` | Page number |
  | `limit` | `integer` | `20` | Results per page |
  | `group_id` | `integer` | — | Filter by class group ID |
  | `caregiver_id`| `integer` | — | Filter by assigned caregiver user ID (Admin only) |
  | `status` | `string` | `'active'` | Filter by status: `'active'`, `'inactive'`, `'graduated'` |
  | `search` | `string` | — | Search by child full name |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "full_name": "Abebe Kebede",
        "dob": "2023-04-12",
        "gender": "male",
        "enrollment_status": "active",
        "group_id": 1,
        "group_name": "Toddlers Group A",
        "caregiver_id": 23,
        "caregiver_name": "Tigist Alemu",
        "created_at": "2026-08-15T10:00:00.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
  ```

---

### 2.2 Get Detailed Child Profile (3-Query Assembly)
* **Endpoint:** `GET /api/children/:id`
* **Access:** `admin`, assigned `caregiver`, linked `parent`
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 1,
    "full_name": "Abebe Kebede",
    "dob": "2023-04-12",
    "gender": "male",
    "enrollment_status": "active",
    "group_id": 1,
    "group_name": "Toddlers Group A",
    "caregiver_id": 23,
    "caregiver_name": "Tigist Alemu",
    "emergency_contacts": [
      {
        "id": 10,
        "name": "Almaz Tesfaye",
        "relationship": "Grandmother",
        "phone": "+251911998877",
        "is_primary": true
      }
    ],
    "care_instructions": [
      {
        "id": 5,
        "instruction_type": "allergy", // 'allergy' | 'diet' | 'medical' | 'general'
        "description": "Peanut allergy — carries EpiPen",
        "created_at": "2026-08-15T10:00:00.000Z"
      }
    ]
  }
  ```
* **Security Guard:** If an unlinked parent attempts to access `/api/children/1`, the backend responds:
  ```json
  { "error": "Access denied: You are not linked to this child record" } // HTTP 403
  ```

---

### 2.3 Enroll New Child (Admin Only)
* **Endpoint:** `POST /api/children`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "full_name": "Dawit Haile",
    "dob": "2023-09-01",
    "gender": "male", // 'male' | 'female'
    "group_id": 1,
    "caregiver_id": 23,
    "emergency_contacts": [
      {
        "name": "Sara Haile",
        "relationship": "Mother",
        "phone": "+251911000003",
        "is_primary": true
      }
    ],
    "care_instructions": [
      {
        "instruction_type": "diet",
        "description": "Lactose intolerant — dairy-free milk only"
      }
    ]
  }
  ```
* **Success Response (`201 Created`):** Returns the complete newly created child profile object.

---

### 2.4 Update Child Information (Admin Only)
* **Endpoint:** `PATCH /api/children/:id`
* **Access:** `admin` only
* **Request Body (All fields optional):**
  ```json
  {
    "full_name": "Dawit Haile-Tesfaye",
    "group_id": 2,
    "caregiver_id": 25,
    "enrollment_status": "active" // 'active' | 'inactive' | 'graduated'
  }
  ```
* **Success Response (`200 OK`):** Returns updated child record.

---

## 3. Emergency Contacts Sub-Resource

Allows dynamic management of authorized emergency contacts without rewriting the entire child profile.

### 3.1 Add Emergency Contact
* **Endpoint:** `POST /api/children/:id/contacts`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "name": "Kassahun Tadesse",
    "relationship": "Uncle",
    "phone": "+251922334455",
    "is_primary": false
  }
  ```
* **Success Response (`201 Created`):** Returns the contact record with new `id`.

---

### 3.2 Update Emergency Contact
* **Endpoint:** `PATCH /api/children/contacts/:cid`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "phone": "+251922998877",
    "is_primary": true
  }
  ```
* **Success Response (`200 OK`):** Returns updated contact.

---

### 3.3 Delete Emergency Contact
* **Endpoint:** `DELETE /api/children/contacts/:cid`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  { "message": "Emergency contact deleted successfully" }
  ```

---

## 4. Care Instructions Sub-Resource

Tracks critical medical warnings, dietary restrictions, and developmental instructions.

### 4.1 Add Care Instruction
* **Endpoint:** `POST /api/children/:id/instructions`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "instruction_type": "allergy", // 'allergy' | 'diet' | 'medical' | 'general'
    "description": "Mild eczema — apply moisture lotion after outdoor play"
  }
  ```
* **Success Response (`201 Created`):** Returns new care instruction record.

---

### 4.2 Update Care Instruction
* **Endpoint:** `PATCH /api/children/instructions/:iid`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "description": "Updated eczema instructions: apply lotion twice daily"
  }
  ```
* **Success Response (`200 OK`):** Returns updated record.

---

### 4.3 Delete Care Instruction
* **Endpoint:** `DELETE /api/children/instructions/:iid`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  { "message": "Care instruction deleted successfully" }
  ```

---

## 5. Guardian Linkage & Pickup Authorization

Connects registered parent user accounts to children, specifying pickup privileges and tracking biometric enrollment status.

### 5.1 List Linked Guardians for Child
* **Endpoint:** `GET /api/children/:id/guardians`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 10,
        "child_id": 1,
        "parent_user_id": 24,
        "parent_name": "Sara Haile",
        "parent_email": "parent@ankelba.dev",
        "parent_phone": "+251911000003",
        "relationship": "Mother",
        "is_primary": true,
        "can_pickup": true,
        "biometric_enrolled": true, // Boolean flag indicates if biometric template exists
        "created_at": "2026-08-15T10:30:00.000Z"
      }
    ]
  }
  ```

---

### 5.2 Link Guardian to Child (Admin Only)
* **Endpoint:** `POST /api/children/:id/guardians`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "parent_user_id": 24,
    "relationship": "Mother",
    "is_primary": true,
    "can_pickup": true
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 14,
    "child_id": 1,
    "parent_user_id": 24,
    "relationship": "Mother",
    "is_primary": true,
    "can_pickup": true
  }
  ```
* **Validation Guards:**
  * If `parent_user_id` does not have role `'parent'`, returns `422 Unprocessable Entity`.
  * If this parent is already linked to this child, returns `409 Conflict`.

---

### 5.3 Remove Guardian Link (Admin Only)
* **Endpoint:** `DELETE /api/children/:id/guardians/:gid`
* **Access:** `admin` only
* **Success Response (`204 No Content`):** Empty body upon successful revocation.
