# Ankelba Backend Documentation — Events Calendar & AI Parent Guide APIs

**Target Modules:** Simple Events Calendar, AI Parent Guide Assistant with Safety Guardrails  
**Base Path:** `/api`  
**SRS References:** FR-EVT-01–07, FR-AI-01–10  

---

## 1. Events Calendar API (`/api/events`)

Tracks center field trips, parent-teacher conferences, immunizations, and holiday celebrations. Active upcoming events are indexed with high-performance PostgreSQL partial indexes.

### 1.1 List Upcoming Events
* **Endpoint:** `GET /api/events`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 8,
        "title": "Annual Parent-Teacher Conference",
        "description": "Progress reviews for Toddlers & Infants classrooms",
        "event_date": "2026-09-28",
        "start_time": "14:00:00",
        "end_time": "17:30:00",
        "location": "Main Assembly Hall",
        "is_cancelled": false,
        "created_at": "2026-09-10T08:00:00.000Z"
      }
    ]
  }
  ```

---

### 1.2 Create Event (Admin Only)
* **Endpoint:** `POST /api/events`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "title": "Daycare Cultural Heritage Day",
    "description": "Traditional clothing exhibition and cultural storytelling",
    "event_date": "2026-10-05",
    "start_time": "09:30:00",
    "end_time": "12:00:00",
    "location": "Daycare Courtyard"
  }
  ```
* **Success Response (`201 Created`):** Returns created event record.

---

### 1.3 Update Event (Admin Only)
* **Endpoint:** `PATCH /api/events/:id`
* **Access:** `admin` only
* **Request Body (All fields optional):**
  ```json
  {
    "location": "Auditorium Room B",
    "start_time": "10:00:00"
  }
  ```
* **Success Response (`200 OK`):** Returns updated event record.

---

### 1.4 Cancel Event (Soft Delete - Admin Only)
In accordance with **FR-EVT-04**, events are not hard-purged; they are soft-cancelled to maintain parent audit context.

* **Endpoint:** `DELETE /api/events/:id`
* **Access:** `admin` only
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 8,
    "is_cancelled": true,
    "message": "Event successfully cancelled"
  }
  ```

---

## 2. AI Parent Guide Assistant API (`/api/ai/guide`)

A rule-governed AI assistant providing personalized parenting advice, age-appropriate play ideas, morning routines, and nutrition suggestions.

> [!IMPORTANT]
> **Strict Non-Medical Safety Guardrails (FR-AI-05, FR-AI-06):**  
> 1. The backend automatically scans queries for forbidden medical and diagnostic terms (*fever, medicine, dosage, diagnose, symptoms, antibiotics, infection*).  
> 2. If detected, the backend **refuses medical diagnosis**, returns `safety_redirected: true` and `is_medical_query: true`, and directs the parent to professional medical care.  
> 3. Every response contains the mandatory legal disclaimer:  
>    *"General informational guidance only. Not a substitute for professional medical, health, or psychological advice."*

### 2.1 Submit Question to AI Guide
* **Endpoint:** `POST /api/ai/guide`
* **Access:** `parent` only (Caregivers and unauthenticated requests are blocked with `403 Forbidden` and `401 Unauthorized`).
* **Request Body:**
  ```json
  {
    "question": "What sensory learning games can we play at home this weekend?",
    "child_id": 1 // Optional: Injects child age and classroom group for tailored advice
  }
  ```

---

### 2.2 Standard Success Response (Contextual Parenting Advice)
When a valid parenting inquiry is sent:
```json
{
  "question": "What sensory learning games can we play at home this weekend?",
  "child_context": {
    "name": "Abebe",
    "age_years": 3,
    "group_name": "Toddlers Group A"
  },
  "answer": "Engaging activities for Abebe (3 years old) include sensory sorting games, building block towers, finger painting with non-toxic paints, and interactive storybook reading.",
  "disclaimer": "General informational guidance only. Not a substitute for professional medical, health, or psychological advice.",
  "safety_redirected": false,
  "is_medical_query": false
}
```

---

### 2.3 Medical Safety Interception Response
When a medical diagnosis or symptom query is attempted:
* **Request Body:**
  ```json
  {
    "question": "What medicine dosage should I give for my child's 39C fever?"
  }
  ```
* **Success Response (`200 OK` with Safety Interception):**
  ```json
  {
    "question": "What medicine dosage should I give for my child's 39C fever?",
    "child_context": null,
    "answer": "I am an AI Parenting Guide assistant designed for general daycare routines, meal ideas, and age-appropriate activities. I cannot provide medical diagnosis, dosage advice, or healthcare treatments. If your child is experiencing medical symptoms, fever, or illness, please consult a qualified healthcare professional or daycare staff immediately.",
    "disclaimer": "General informational guidance only. Not a substitute for professional medical, health, or psychological advice.",
    "safety_redirected": true,
    "is_medical_query": true
  }
  ```

### 2.4 Frontend UI Recommendation for AI Guide
1. **Disclaimer Banner:** Permanently display `disclaimer` at the bottom of the AI chat window.
2. **Medical Alert Callout:** If `safety_redirected === true`, render the response bubble with a distinct **Red/Amber Warning Icon** and a button: *"Contact Daycare Staff / Emergency Helpline"*.
3. **Child Context Selector:** Provide a dropdown allowing the parent to select which of their linked children the question relates to, automatically passing `child_id`.
