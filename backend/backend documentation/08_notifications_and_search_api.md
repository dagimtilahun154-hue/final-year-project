# Ankelba Backend Documentation — Notifications & Global Search APIs

**Target Modules:** Aggregated Notification Header Badges, Role-Scoped Global Multi-Entity Search  
**Base Path:** `/api`  
**SRS References:** FR-COM-01–05, FR-UAM-02, Priority 2 & 3 Enhancements  

---

## 1. Aggregated Notifications Inbox & Badges API (`/api/notifications`)

Designed to drive the top-bar bell notification icon and dashboard badges with zero redundant API round-trips.

* **Endpoint:** `GET /api/notifications`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Behavior:** The backend automatically aggregates unread badges tailored specifically to the authenticated user's active role.

### 1.1 Response for Parent Role
```json
{
  "total_badges": 4,
  "breakdown": {
    "active_alerts": 2,          // Urgent daycare alerts currently broadcasting
    "unread_messages": 1,        // Direct messages from teachers awaiting reading
    "unpaid_orders": 1           // Store orders placed awaiting payment
  },
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

### 1.2 Response for Caregiver Role
```json
{
  "total_badges": 3,
  "breakdown": {
    "active_alerts": 1,
    "unread_messages": 2,
    "unnotified_health_incidents": 0, // Children health incidents pending parent notice
    "missing_daily_reports_today": 0  // Assigned children missing today's report
  },
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

### 1.3 Response for Admin Role
```json
{
  "total_badges": 7,
  "breakdown": {
    "active_alerts": 2,
    "unread_messages": 1,
    "low_stock_products": 2,          // Inventory items with stock <= 5
    "pending_store_orders": 2,        // Orders placed awaiting fulfillment
    "missing_daily_reports_today": 0
  },
  "timestamp": "2026-09-16T12:00:00.000Z"
}
```

### 1.4 Frontend Integration Recommendation
* Call `GET /api/notifications` on app mount and poll every 60 seconds (or on window focus).
* Render `total_badges` inside the red pill badge over the navbar bell icon.
* In the dropdown popover, render separate badge tags linking directly to the relevant view:
  * Clicking `unread_messages` navigates to `/messages`.
  * Clicking `active_alerts` opens `/alerts`.
  * Clicking `low_stock_products` navigates to `/admin/store?low_stock=true`.

---

## 2. Role-Scoped Global Multi-Entity Search API (`/api/search`)

Powers the universal search bar in the top navigation bar. Performs parallel substring queries across multiple tables while strictly preserving user privacy and role boundaries.

* **Endpoint:** `GET /api/search`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Query Parameters:**
  | Parameter | Type | Required | Description |
  |---|:---:|:---:|---|
  | `q` | `string` | **Yes** | Search keyword (Minimum 2 characters) |

### 2.1 Role-Based Privacy & Scoping Rules
* **User Directory (`results.users`):**
  * `admin`: Returns matching user accounts (name, email, role).
  * `caregiver` & `parent`: **Always returns `[]`** (User directory is strictly hidden to prevent contact scraping).
* **Children (`results.children`):**
  * `admin`: Searches all registered children.
  * `caregiver`: Searches **only** children assigned to this caregiver.
  * `parent`: Searches **only** children linked to this parent.
* **Products (`results.products`):** Returns active catalog items matching title/description.
* **Announcements (`results.announcements`):** Returns active notices visible to the viewer's role.

---

### 2.2 Success Response Example (`GET /api/search?q=toddler`)
```json
{
  "query": "toddler",
  "total_matches": 4,
  "results": {
    "users": [],
    "children": [
      {
        "id": 1,
        "type": "child",
        "title": "Abebe Kebede",
        "subtitle": "Toddlers Group A",
        "link": "/children/1"
      }
    ],
    "products": [
      {
        "id": 18,
        "type": "product",
        "title": "Ankelba Embroidered Toddler Apron",
        "subtitle": "350.00 ETB — In Stock (25)",
        "link": "/store/products/18"
      }
    ],
    "announcements": [
      {
        "id": 4,
        "type": "announcement",
        "title": "Toddler Room Outdoor Play Schedule",
        "subtitle": "Published on 2026-09-12",
        "link": "/announcements/4"
      }
    ]
  }
}
```

### 2.3 Error Responses
* If `q` is shorter than 2 characters:
  ```json
  { "error": "Search query must be at least 2 characters long" } // HTTP 422
  ```
