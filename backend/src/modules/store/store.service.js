'use strict';
/**
 * src/modules/store/store.service.js
 * Business logic for Products & E-Commerce Orders.
 * SRS Refs: FR-ECM-01–16, Architecture Plan §5.8, §6.2 Query 5
 */
const db = require('../../config/db');

/**
 * List products catalog (Architecture Plan §6.2 Query 5).
 * Uses idx_prod_available partial index.
 */
const listProducts = async (query = {}) => {
  const categoryId = query.category_id ? parseInt(query.category_id, 10) : null;
  const availableOnly = query.available_only !== 'false';

  let sql = `
    SELECT p.id, p.name, p.description, p.price, p.stock_qty, p.available, p.category_id, p.updated_at,
           pc.name AS category_name
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    WHERE 1=1
  `;

  const params = [];
  if (availableOnly) {
    sql += ` AND p.available = TRUE`;
  }
  if (categoryId) {
    params.push(categoryId);
    sql += ` AND p.category_id = $${params.length}`;
  }

  sql += ` ORDER BY p.name ASC`;

  const { rows } = await db.query(sql, params);
  return { data: rows };
};

/**
 * Create a new product in the store (Admin only).
 */
const createProduct = async (body, user) => {
  const { rows } = await db.query(
    `INSERT INTO products (name, description, price, category_id, stock_qty, available, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.name,
      body.description || null,
      body.price,
      body.category_id || null,
      body.stock_qty ?? 0,
      body.available ?? true,
      user.id,
    ]
  );
  return rows[0];
};

/**
 * Update product details or stock (Admin only).
 */
const updateProduct = async (productIdParam, body) => {
  const productId = parseInt(productIdParam, 10);

  const fields = [];
  const vals = [];
  let idx = 1;

  if (body.name !== undefined) { fields.push(`name = $${idx++}`); vals.push(body.name); }
  if (body.description !== undefined) { fields.push(`description = $${idx++}`); vals.push(body.description || null); }
  if (body.price !== undefined) { fields.push(`price = $${idx++}`); vals.push(body.price); }
  if (body.category_id !== undefined) { fields.push(`category_id = $${idx++}`); vals.push(body.category_id || null); }
  if (body.stock_qty !== undefined) { fields.push(`stock_qty = $${idx++}`); vals.push(body.stock_qty); }
  if (body.available !== undefined) { fields.push(`available = $${idx++}`); vals.push(body.available); }

  if (fields.length === 0) {
    const err = new Error('No fields provided for update');
    err.statusCode = 422;
    throw err;
  }

  fields.push(`updated_at = NOW()`);
  vals.push(productId);

  const { rows } = await db.query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  if (rows.length === 0) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
};

/**
 * Place order with transactional inventory check & snapshot pricing.
 */
const placeOrder = async (body, user) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let total = 0;
    const preparedItems = [];

    // 1. Verify stock and calculate total with price snapshot
    for (const item of body.items) {
      const prodId = parseInt(item.product_id, 10);
      const qty = parseInt(item.quantity, 10);

      const { rows: prodRows } = await client.query(
        `SELECT id, name, price, stock_qty, available FROM products WHERE id = $1 FOR UPDATE`,
        [prodId]
      );

      if (prodRows.length === 0 || !prodRows[0].available) {
        const err = new Error(`Product ID ${prodId} is not available`);
        err.statusCode = 404;
        throw err;
      }

      const prod = prodRows[0];
      if (prod.stock_qty < qty) {
        const err = new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_qty}, Requested: ${qty}`);
        err.statusCode = 422;
        throw err;
      }

      // Decrement stock
      const newStock = prod.stock_qty - qty;
      await client.query(
        `UPDATE products SET stock_qty = stock_qty - $1, updated_at = NOW() WHERE id = $2`,
        [qty, prodId]
      );

      // Low-stock auto-alert (FR-ECM-06): Alert admins when stock drops <= 5
      if (newStock <= 5) {
        await client.query(
          `INSERT INTO alerts (author_id, title, urgency, recipient_scope)
           VALUES ($1, $2, 'high', 'all')`,
          [user.id, `Low stock alert: "${prod.name}" has only ${newStock} units left`]
        );
      }

      const unitPrice = parseFloat(prod.price);
      total += unitPrice * qty;

      preparedItems.push({
        product_id: prodId,
        product_name: prod.name,
        quantity: qty,
        unit_price: unitPrice,
      });
    }

    // 2. Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (parent_id, total, order_status, payment_status)
       VALUES ($1, $2, 'placed', 'unpaid')
       RETURNING *`,
      [user.id, total]
    );

    const order = orderRows[0];

    // 3. Insert order items (snapshot price)
    const orderItems = [];
    for (const item of preparedItems) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [order.id, item.product_id, item.quantity, item.unit_price]
      );
      orderItems.push({
        ...itemRows[0],
        product_name: item.product_name,
      });
    }

    // 4. Create initial payment record
    await client.query(
      `INSERT INTO payments (order_id, method, status)
       VALUES ($1, 'pay_at_daycare', 'unpaid')`,
      [order.id]
    );

    await client.query('COMMIT');

    return {
      ...order,
      items: orderItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * List parent's orders.
 */
const listMyOrders = async (user) => {
  const { rows: orders } = await db.query(
    `SELECT o.id, o.total, o.order_status, o.payment_status, o.created_at
     FROM orders o
     WHERE o.parent_id = $1
     ORDER BY o.created_at DESC`,
    [user.id]
  );

  for (const order of orders) {
    const { rows: items } = await db.query(
      `SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [order.id]
    );
    order.items = items;
  }

  return { data: orders };
};

/**
 * List all orders for administrative view.
 */
const listAllOrders = async (query = {}) => {
  const { rows: orders } = await db.query(
    `SELECT o.id, o.parent_id, u.name AS parent_name, o.total, o.order_status, o.payment_status, o.created_at
     FROM orders o
     JOIN users u ON u.id = o.parent_id
     ORDER BY o.created_at DESC`
  );

  return { data: orders };
};

/**
 * Update order and payment status (Admin only).
 */
const updateOrderStatus = async (orderIdParam, body) => {
  const orderId = parseInt(orderIdParam, 10);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const fields = [];
    const vals = [];
    let idx = 1;

    if (body.order_status !== undefined) { fields.push(`order_status = $${idx++}`); vals.push(body.order_status); }
    if (body.payment_status !== undefined) { fields.push(`payment_status = $${idx++}`); vals.push(body.payment_status); }

    if (fields.length === 0) {
      const err = new Error('No status fields provided');
      err.statusCode = 422;
      throw err;
    }

    fields.push(`updated_at = NOW()`);
    vals.push(orderId);

    const { rows } = await client.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    if (rows.length === 0) {
      const err = new Error('Order not found');
      err.statusCode = 404;
      throw err;
    }

    const order = rows[0];

    // Synchronize payment status if payment_status changed
    if (body.payment_status !== undefined) {
      const verifiedAt = body.payment_status === 'paid' ? new Date() : null;
      await client.query(
        `UPDATE payments SET status = $1, verified_at = $2 WHERE order_id = $3`,
        [body.payment_status, verifiedAt, orderId]
      );
    }

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Category Management — §8.10 | SRS: FR-ECM-01
 */
const listCategories = async () => {
  const { rows } = await db.query(
    `SELECT c.id, c.name, COUNT(p.id)::int AS product_count
     FROM product_categories c
     LEFT JOIN products p ON p.category_id = c.id
     GROUP BY c.id, c.name
     ORDER BY c.name ASC`
  );
  return { data: rows };
};

const createCategory = async (body) => {
  const name = body.name.trim();
  const existing = await db.query(
    `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1)`,
    [name]
  );
  if (existing.rows.length > 0) {
    const err = new Error('A category with this name already exists');
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO product_categories (name) VALUES ($1) RETURNING *`,
    [name]
  );
  return rows[0];
};

const updateCategory = async (idParam, body) => {
  const id = parseInt(idParam, 10);
  const name = body.name.trim();

  const existing = await db.query(
    `SELECT id FROM product_categories WHERE LOWER(name) = LOWER($1) AND id != $2`,
    [name, id]
  );
  if (existing.rows.length > 0) {
    const err = new Error('A category with this name already exists');
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE product_categories SET name = $1 WHERE id = $2 RETURNING *`,
    [name, id]
  );
  if (rows.length === 0) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const deleteCategory = async (idParam) => {
  const id = parseInt(idParam, 10);

  const { rows: prods } = await db.query(
    `SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1`,
    [id]
  );
  if (prods[0]?.count > 0) {
    const err = new Error(`Cannot delete category: ${prods[0].count} product(s) are assigned to it`);
    err.statusCode = 409;
    throw err;
  }

  const { rows } = await db.query(
    `DELETE FROM product_categories WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) {
    const err = new Error('Category not found');
    err.statusCode = 404;
    throw err;
  }
  return { message: 'Category deleted successfully' };
};

module.exports = {
  listProducts,
  createProduct,
  updateProduct,
  placeOrder,
  listMyOrders,
  listAllOrders,
  updateOrderStatus,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
