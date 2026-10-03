# Ankelba Backend Documentation — Health, Announcements & Messaging APIs

**Target Modules:** Child Health & Incident Documentation, Center Announcements & Meal Plans, Structured In-App Messaging, Urgent Alerts  
**Base Path:** `/api`  
**SRS References:** FR-HIR-01–06, FR-COM-01–05  

---

## 1. Health & Incident Records API (`/api/health`)

Provides structured logging for daycare bumps, scrapes, fever spikes, or behavioral observations.

> [!IMPORTANT]
> **Mandatory Medical Disclaimer (FR-HIR-06):**  
> Every response from the health module includes the legal disclaimer:  
> *"Records are for informational daycare documentation only and do not constitute professional medical diagnosis or treatment."*  
> The frontend UI **must** display this disclaimer banner on all health history views.

### 1.1 Create Health / Incident Record
* **Endpoint:** `POST /api/health`
* **Access:** `admin`, `caregiver`
* **Request Body:**
  ```json
  {
    "child_id": 1,
    "record_type": "injury", // 'illness' | 'injury' | 'observation'
    "severity": "low", // 'low' | 'medium' | 'high'
    "description": "Small scrape on left knee during outdoor recess.",
    "symptoms": "Mild redness and slight abrasion.",
    "action_taken": "Cleaned with sterile antiseptic wash and applied clean bandage. Child resumed play happily."
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 12,
    "child_id": 1,
    "recorded_by": 23,
    "record_type": "injury",
    "severity": "low",
    "description": "Small scrape on left knee...",
    "parent_notified": false,
    "created_at": "2026-09-16T11:45:00.000Z",
    "disclaimer": "Records are for informational daycare documentation only and do not constitute professional medical diagnosis or treatment."
  }
  ```

---

### 1.2 Get Child Health History
* **Endpoint:** `GET /api/health/child/:id`
* **Access:** `admin`, assigned `caregiver`, linked `parent`
* **Query Parameters:** `startDate` (`YYYY-MM-DD`), `endDate` (`YYYY-MM-DD`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 12,
        "record_type": "injury",
        "severity": "low",
        "description": "Small scrape on left knee...",
        "action_taken": "Cleaned with sterile antiseptic...",
        "parent_notified": true,
        "recorded_by_name": "Tigist Alemu",
        "created_at": "2026-09-16T11:45:00.000Z"
      }
    ],
    "disclaimer": "Records are for informational daycare documentation only and do not constitute professional medical diagnosis or treatment."
  }
  ```

---

### 1.3 Mark Parent Notified
Staff can flag that the child's guardian was verbally informed during pickup or telephoned.

* **Endpoint:** `PATCH /api/health/:id/notify`
* **Access:** `admin`, `caregiver`
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 12,
    "parent_notified": true,
    "notified_at": "2026-09-16T15:45:00.000Z"
  }
  ```

---

## 2. Announcements & Meal Plans API (`/api/announcements`)

Broadcasts newsletters, holiday closures, nutritional meal plans, and general classroom updates.

### 2.1 List Announcements
* **Endpoint:** `GET /api/announcements`
* **Access:** Authenticated (Filtered automatically by viewer's role)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 5,
        "title": "Daycare Closed on Ethiopian Meskel Holiday",
        "content": "Dear Parents, please be reminded that Ankelba will be closed on Friday, Sept 26.",
        "audience": "all", // 'all' | 'parents' | 'caregivers'
        "is_pinned": true,
        "author_name": "Admin Director",
        "created_at": "2026-09-15T09:00:00.000Z"
      }
    ]
  }
  ```

---

### 2.2 Dedicated Meal Plan Endpoint
Returns current weekly nutritional schedules, breakfast/lunch menus, and snack rotations.

* **Endpoint:** `GET /api/announcements/meal-plan`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 6,
        "title": "Weekly Nutrition & Meal Plan — Week 3",
        "content": "Monday: Scrambled eggs & papaya. Tuesday: Lentil porridge & steamed pumpkin...",
        "audience": "parents",
        "created_at": "2026-09-14T08:00:00.000Z"
      }
    ]
  }
  ```

---

### 2.3 Post Center Announcement (Admin Only)
* **Endpoint:** `POST /api/announcements`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "title": "Annual Vaccination Checkup Reminder",
    "content": "Please submit updated immunization booster slips by October 1.",
    "audience": "parents", // 'all' | 'parents' | 'caregivers'
    "is_pinned": false
  }
  ```
* **Success Response (`201 Created`):** Returns the created announcement record.

---

## 3. In-App Direct Messaging API (`/api/messages`)

Private messaging channel between parents and assigned teachers.

### 3.1 List Messages / Conversations
* **Endpoint:** `GET /api/messages`
* **Access:** Authenticated (`caregiver`, `parent`)
* **Query Parameters:**
  | Parameter | Type | Description |
  |---|:---:|---|
  | `with_user_id` | `integer` | Filter direct thread with a specific user |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 4,
        "sender_id": 24,
        "sender_name": "Sara Haile",
        "recipient_id": 23,
        "recipient_name": "Tigist Alemu",
        "body": "Hi Teacher Tigist, Abebe drank lots of water before leaving home today.",
        "is_read": true,
        "read_at": "2026-09-16T08:45:00.000Z",
        "created_at": "2026-09-16T08:30:00.000Z"
      }
    ]
  }
  ```

---

### 3.2 Send Message
* **Endpoint:** `POST /api/messages`
* **Access:** Authenticated
* **Request Body:**
  ```json
  {
    "recipient_id": 23,
    "body": "Good morning! Can you check if he left his blue jacket?"
  }
  ```
* **Success Response (`201 Created`):** Returns sent message object.

---

### 3.3 Mark Message as Read
* **Endpoint:** `PATCH /api/messages/:id/read`
* **Access:** Authenticated (Recipient only)
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 4,
    "is_read": true,
    "read_at": "2026-09-16T12:00:00.000Z"
  }
  ```

---

## 4. Urgent Center Alerts API (`/api/alerts`)

High-priority broadcasts (e.g. weather advisories, sudden early closure notices).

### 4.1 List Active Alerts
* **Endpoint:** `GET /api/alerts`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 3,
        "title": "Heavy Rain Alert — Early Pickup Encouraged",
        "message": "Due to flooding forecasts in the district, parents may collect children starting at 3:00 PM.",
        "urgency": "high", // 'low' | 'medium' | 'high'
        "is_active": true,
        "expires_at": "2026-09-16T18:00:00.000Z",
        "created_at": "2026-09-16T11:00:00.000Z"
      }
    ]
  }
  ```

---

### 4.2 Broadcast Urgent Alert (Admin Only)
* **Endpoint:** `POST /api/alerts`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "title": "Facility Power Outage",
    "message": "Daycare generator is active; heating is operating normally.",
    "urgency": "medium", // 'low' | 'medium' | 'high'
    "expires_at": "2026-09-16T22:00:00.000Z" // optional
  }
  ```
* **Success Response (`201 Created`):** Returns created alert record.
