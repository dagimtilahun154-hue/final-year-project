# Ankelba Backend Documentation — Store & Payments APIs

**Target Modules:** Product Categories, Daycare E-Commerce Catalog, Order Placement & Stock Engine, Payment Gateways  
**Base Path:** `/api`  
**SRS References:** FR-ECM-01–16, UC-08, TBD-02  

---

## 1. Product Categories API (`/api/store/categories`)

Organizes daycare merchandise (uniforms, storybooks, diapers, art supplies, emergency backup kits).

### 1.1 List Categories
* **Endpoint:** `GET /api/store/categories`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 1,
        "name": "Uniforms & Clothing",
        "description": "Daycare aprons, bibs, and change clothes",
        "product_count": 5,
        "created_at": "2026-08-20T10:00:00.000Z"
      },
      {
        "id": 2,
        "name": "Learning & Books",
        "description": "Sensory books and alphabet puzzles",
        "product_count": 8,
        "created_at": "2026-08-20T10:00:00.000Z"
      }
    ]
  }
  ```

---

### 1.2 Category Management (Admin Only)
* **Create Category:** `POST /api/store/categories`
  * Body: `{ "name": "Arts & Crafts", "description": "Coloring materials" }`
  * Response: `201 Created`
* **Update Category:** `PATCH /api/store/categories/:id`
  * Body: `{ "name": "Arts & Sensory Crafts" }`
* **Delete Category:** `DELETE /api/store/categories/:id`
  * Response: `200 OK` (Fails if products are assigned to this category).

---

## 2. Store Catalog API (`/api/store/products`)

### 2.1 List Products
* **Endpoint:** `GET /api/store/products`
* **Access:** Authenticated (`admin`, `caregiver`, `parent`)
* **Query Parameters:**
  | Parameter | Type | Default | Description |
  |---|:---:|:---:|---|
  | `page` | `integer` | `1` | Page number |
  | `limit` | `integer` | `20` | Results per page |
  | `category_id`| `integer` | — | Filter by category ID |
  | `is_active` | `boolean` | `true` | Filter available items (Admin can pass `false`) |
* **Success Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": 18,
        "category_id": 1,
        "category_name": "Uniforms & Clothing",
        "name": "Ankelba Embroidered Toddler Apron",
        "description": "Waterproof cotton apron for meal and paint time",
        "price": "350.00",
        "stock_quantity": 25,
        "image_url": "https://example.com/assets/apron.jpg",
        "is_active": true
      }
    ],
    "total": 18,
    "page": 1,
    "limit": 20
  }
  ```

---

### 2.2 Create / Update Product (Admin Only)
* **Create Product:** `POST /api/store/products`
  * Body:
    ```json
    {
      "category_id": 1,
      "name": "Preschool Storybook Pack",
      "description": "Set of 3 bilingual Amharic-English books",
      "price": 450.00,
      "stock_quantity": 30,
      "image_url": "https://example.com/images/books.png",
      "is_active": true
    }
    ```
  * Response: `201 Created`
* **Update Product:** `PATCH /api/store/products/:id`
  * Body (optional fields): `{ "price": 420.00, "stock_quantity": 15 }`

---

## 3. Order Processing & Low-Stock Engine (`/api/store/orders`)

Ankelba freezes product pricing into the `order_items` record upon placement to guarantee historical fiscal integrity.

### 3.1 Place Order (Parent Only)
* **Endpoint:** `POST /api/store/orders`
* **Access:** `parent` only
* **Request Body:**
  ```json
  {
    "items": [
      {
        "product_id": 18,
        "quantity": 2
      }
    ],
    "notes": "Please package for Dawit Haile"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "id": 19,
    "user_id": 24,
    "total_amount": "700.00",
    "order_status": "pending",
    "payment_status": "unpaid",
    "notes": "Please package for Dawit Haile",
    "items": [
      {
        "product_id": 18,
        "product_name": "Ankelba Embroidered Toddler Apron",
        "unit_price": "350.00",
        "quantity": 2,
        "subtotal": "700.00"
      }
    ],
    "created_at": "2026-09-16T12:30:00.000Z"
  }
  ```
* **Error Guards:**
  * If requested quantity exceeds current inventory:
    ```json
    { "error": "Insufficient stock for product \"Ankelba Embroidered Toddler Apron\" (Available: 1)" } // HTTP 422
    ```

> [!TIP]
> **Automatic Low-Stock Alert Engine (FR-ECM-06):**  
> If an order causes product inventory to fall to **$\le 5$ units**, the backend automatically dispatches a system alert to administrators:  
> *"Low stock alert: 'Ankelba Apron' has only 4 units left. Please reorder."*

---

### 3.2 List Parent Orders
* **Endpoint:** `GET /api/store/orders/my`
* **Access:** `parent` only
* **Success Response (`200 OK`):** Returns the logged-in parent's order history array with nested items.

---

### 3.3 List All System Orders (Admin Only)
* **Endpoint:** `GET /api/store/orders`
* **Access:** `admin` only
* **Query Parameters:** `status`, `payment_status`, `page`, `limit`
* **Success Response (`200 OK`):** Returns all daycare orders with customer names and contact phone numbers.

---

### 3.4 Update Order & Payment Status (Admin Only)
* **Endpoint:** `PATCH /api/store/orders/:id/status`
* **Access:** `admin` only
* **Request Body:**
  ```json
  {
    "order_status": "ready_for_pickup", // 'pending' | 'confirmed' | 'ready_for_pickup' | 'completed' | 'cancelled'
    "payment_status": "paid" // 'unpaid' | 'paid' | 'refunded'
  }
  ```
* **Success Response (`200 OK`):** Returns updated order record.

---

## 4. Payments API (`/api/payments`)

Ankelba supports dual payment modes: **Pay at Daycare** (cash/POS at front desk) and **Digital Payments** (Chapa / Mobile Money).

### 4.1 Initiate Payment
* **Endpoint:** `POST /api/payments/initiate`
* **Access:** `parent` only
* **Request Body (Pay at Daycare):**
  ```json
  {
    "order_id": 19,
    "payment_method": "pay_at_daycare"
  }
  ```
* **Response for Pay at Daycare (`200 OK`):**
  ```json
  {
    "status": "pending_daycare_collection",
    "order_id": 19,
    "payment_method": "pay_at_daycare",
    "message": "Order confirmed. Please complete payment at the daycare administrative office upon pickup."
  }
  ```
* **Request Body (Digital Payment):**
  ```json
  {
    "order_id": 19,
    "payment_method": "digital"
  }
  ```
* **Response for Digital Payment (`200 OK`):**
  ```json
  {
    "status": "initiated",
    "order_id": 19,
    "payment_method": "digital",
    "tx_ref": "CHAPA_TX_19_1789557131019",
    "checkout_url": "https://checkout.chapa.co/checkout/payment/CHAPA_TX_19_1789557131019"
  }
  ```
  *Frontend Action:* Redirect user to `checkout_url`. After completion, the gateway redirects back to the frontend success route.

---

### 4.2 Get Payment Record by Order ID
* **Endpoint:** `GET /api/payments/order/:id`
* **Access:** `admin`, `parent` (Order owner)
* **Success Response (`200 OK`):**
  ```json
  {
    "id": 8,
    "order_id": 19,
    "amount": "700.00",
    "currency": "ETB",
    "payment_method": "digital",
    "status": "completed",
    "gateway_tx_ref": "CHAPA_TX_19_1789557131019",
    "paid_at": "2026-09-16T12:35:00.000Z"
  }
  ```
