# Ankelba Backend Documentation — Attendance & Daily Reports APIs

**Target Modules:** Attendance State Machine, Daily Attendance Live Grid & Aggregations, Daily Activity Reporting & Caregiver Completion Monitor  
**Base Path:** `/api`  
**SRS References:** FR-ATT-01–07, FR-DAR-01–08, FR-RPT-01–06  

---

## 1. Attendance Management API (`/api/attendance`)

### 1.1 Attendance State Machine Rules
Ankelba enforces a strict operational state machine for child check-ins and check-outs:
* **Fresh Day / After Checkout:** State is `OUT`. A child may record a `checkin`.
* **After Checkin:** State is `IN`. A child may record a `checkout`.
* **Illegal Transitions:**
  * Recording a `checkin` when already checked in $\rightarrow$ **`422 Unprocessable Entity`**.
  * Recording a `checkout` when not checked in $\rightarrow$ **`422 Unprocessable Entity`**.
  * Attempting to mark absent after check-in $\rightarrow$ **`422 Unprocessable Entity`**.

---

### 1.2 Record Child Attendance (Check-in / Check-out)
* **Endpoint:** `POST /api/attendance`
* **Access:** `admin`, `caregiver`
* **Request Body:**
  ```json
  {
    "child_id": 1,
    "attendance_type": "checkin", // 'checkin' | 'checkout'
    "notes": "Dropped off by mother; in good spirits" // optional
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 105,
    "child_id": 1,
    "recorded_by": 23,
    "attendance_type": "checkin",
    "timestamp": "2026-09-16T08:15:22.000Z",
    "notes": "Dropped off by mother; in good spirits"
  }
  ```

---

### 1.3 Center Live Attendance Grid (Admin Only)
Utilizes PostgreSQL `LATERAL JOIN` to display a real-time classroom roster with each child's latest attendance status for any calendar date.

* **Endpoint:** `GET /api/attendance`
* **Access:** `admin` only
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  |---|:---:|:---:|---|
  | `date` | `string` | `CURRENT_DATE` | Filter date formatted as `YYYY-MM-DD` |
* **Success Response (`200 OK`):**
  ```json
  {
    "date": "2026-09-16",
    "total_enrolled": 42,
    "present_today": 36,
    "grid": [
      {
        "child_id": 1,
        "full_name": "Abebe Kebede",
        "group_name": "Toddlers Group A",
        "caregiver_name": "Tigist Alemu",
        "latest_event_type": "checkin", // 'checkin' | 'checkout' | null (if not arrived)
        "latest_event_time": "2026-09-16T08:15:22.000Z"
      }
    ]
  }
  ```

---

### 1.4 Child Attendance History Timeline
* **Endpoint:** `GET /api/attendance/child/:id`
* **Access:** `admin`, assigned `caregiver`, linked `parent`
* **Query Parameters:**
  | Parameter | Type | Description |
  |---|:---:|---|
  | `startDate` | `string` | `YYYY-MM-DD` |
  | `endDate` | `string` | `YYYY-MM-DD` |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 105,
        "attendance_type": "checkin",
        "timestamp": "2026-09-16T08:15:22.000Z",
        "notes": "Dropped off by mother",
        "recorded_by_name": "Tigist Alemu"
      }
    ]
  }
  ```

---

### 1.5 Attendance Summary & Stay Hours Aggregation
Enables analytics cards on both parent portals and the admin dashboard.

* **Endpoint:** `GET /api/attendance/summary`
* **Access:** `admin`, `caregiver`, `parent`
* **Query Parameters:**
  * If `child_id` is supplied: Computes analytics for that specific child.
  * If `child_id` is omitted: Computes center-wide analytics (`admin` / `caregiver` only).
* **Center-Wide Response (`admin`):**
  ```json
  {
    "center_summary": {
      "total_active_children": 42,
      "total_recorded_events_30d": 840,
      "overall_attendance_rate": "92.4%",
      "average_daily_stay_hours": 7.8
    }
  }
  ```
* **Child-Specific Response (`GET /api/attendance/summary?child_id=1`):**
  ```json
  {
    "child_id": 1,
    "child_name": "Abebe Kebede",
    "total_days_evaluated": 22,
    "days_present": 21,
    "days_absent": 1,
    "attendance_rate_percent": 95.5,
    "average_daily_stay_hours": 8.1
  }
  ```

---

## 2. Daily Activity Reporting API (`/api/reports`)

Caregivers compose structured daily reports capturing mood, nap sleep, nutrition, and activities. The creation executes inside an ACID database transaction.

### 2.1 Submit Daily Activity Report (Caregiver Only)
* **Endpoint:** `POST /api/reports/daily`
* **Access:** `caregiver` only
* **Request Body:**
  ```json
  {
    "child_id": 1,
    "report_date": "2026-09-16",
    "mood": "happy", // 'happy' | 'playful' | 'fussy' | 'tired' | 'calm'
    "sleep_duration_min": 75,
    "activities_summary": "Great day! Participated actively in finger painting and building blocks.",
    "general_notes": "Abebe drank water frequently and enjoyed storytime.",
    "meals": [
      {
        "meal_type": "breakfast", // 'breakfast' | 'lunch' | 'snack'
        "food_items": "Oatmeal porridge with sliced bananas",
        "portion_consumed": "all", // 'all' | 'most' | 'half' | 'little' | 'none'
        "notes": "Finished everything quickly"
      },
      {
        "meal_type": "lunch",
        "food_items": "Steamed vegetables and rice",
        "portion_consumed": "most"
      }
    ],
    "activities": [
      {
        "activity_type": "arts_and_crafts", // 'arts_and_crafts' | 'outdoor_play' | 'reading' | 'nap' | 'sensory' | 'other'
        "description": "Finger painting with blue and yellow colors",
        "location": "Classroom Activity Corner"
      },
      {
        "activity_type": "outdoor_play",
        "description": "Sandcastle building in playground",
        "location": "Playground Sandpit"
      }
    ]
  }
  ```
* **Success Response (`201 Created`):** Returns the saved report header along with populated `meals` and `activities` arrays.
* **Error Response (`409 Conflict`):** If a report has already been submitted for this child on this date:
  ```json
  { "error": "A daily report for this child on 2026-09-16 already exists" }
  ```

---

### 2.2 Get Detailed Daily Report (3-Query Assembly)
* **Endpoint:** `GET /api/reports/daily/:id`
* **Access:** `admin`, assigned `caregiver`, linked `parent`
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 15,
    "child_id": 1,
    "child_name": "Abebe Kebede",
    "caregiver_id": 23,
    "caregiver_name": "Tigist Alemu",
    "report_date": "2026-09-16",
    "mood": "happy",
    "sleep_duration_min": 75,
    "activities_summary": "Great day! Participated actively...",
    "general_notes": "Abebe drank water frequently...",
    "submitted_at": "2026-09-16T15:30:00.000Z",
    "meals": [
      {
        "id": 30,
        "meal_type": "breakfast",
        "food_items": "Oatmeal porridge with sliced bananas",
        "portion_consumed": "all",
        "notes": "Finished everything quickly"
      }
    ],
    "activities": [
      {
        "id": 45,
        "activity_type": "arts_and_crafts",
        "description": "Finger painting with blue and yellow colors",
        "location": "Classroom Activity Corner"
      }
    ]
  }
  ```

---

### 2.3 List Child Reports Timeline
* **Endpoint:** `GET /api/reports/daily/child/:id`
* **Access:** `admin`, assigned `caregiver`, linked `parent`
* **Query Parameters:** `startDate` (`YYYY-MM-DD`), `endDate` (`YYYY-MM-DD`).
* **Success Response (`200 OK`):** Returns an array of report summary objects ordered by `report_date DESC`.

---

### 2.4 Admin Daily Reports Completion Monitor (Admin Only)
Enables daycare supervisors to see which caregivers have completed their mandatory daily reports before dismissal time.

* **Endpoint:** `GET /api/reports/daily`
* **Access:** `admin` only
* **Query Parameters:** `date` (`YYYY-MM-DD`, default today)
* **Success Response (`200 OK`):**
  ```json
  {
    "date": "2026-09-16",
    "monitor": [
      {
        "caregiver_id": 23,
        "caregiver_name": "Tigist Alemu",
        "assigned_children": 8,
        "reports_submitted": 6,
        "reports_missing": 2
      }
    ]
  }
  ```
* **Frontend UI Suggestion:**
  Display a progress bar per caregiver (e.g. `6/8 (75%) Submitted`) with a yellow warning badge for any staff member with `reports_missing > 0`.
