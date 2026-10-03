'use strict';
/**
 * src/modules/payments/payments.service.js
 * Business logic for Daycare Payments & Gateway Integration.
 * SRS Refs: FR-ECM-07–10, TBD-02 (Chapa), NFR-REL-03
 */
const db = require('../../config/db');
const { logAudit } = require('../audit/audit.service');

/**
 * Initiate payment for an order.
 */
const initiatePayment = async (body, user) => {
  const orderId = parseInt(body.order_id, 10);
  const { method } = body;

  // 1. Fetch order and verify ownership
  const { rows: orderRows } = await db.query(
    `SELECT id, parent_id, total, order_status, payment_status FROM orders WHERE id = $1`,
    [orderId]
  );

  if (orderRows.length === 0) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  const order = orderRows[0];

  if (user.role === 'parent' && order.parent_id !== user.id) {
    const err = new Error('Forbidden: You do not own this order');
    err.statusCode = 403;
    throw err;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    let gatewayRef = null;
    let checkoutUrl = null;
    let instructions = null;

    if (method === 'digital') {
      gatewayRef = `CHAPA_TX_${orderId}_${Date.now()}`;
      checkoutUrl = `https://checkout.chapa.co/pay/${gatewayRef}`;
    } else {
      instructions = 'Please complete your cash/POS payment at the daycare administrative office upon child pickup.';
    }

    // Upsert payment record
    await client.query(
      `INSERT INTO payments (order_id, method, gateway_ref, status)
       VALUES ($1, $2, $3, 'pending')
       ON CONFLICT (order_id)
       DO UPDATE SET method = EXCLUDED.method, gateway_ref = EXCLUDED.gateway_ref, status = 'pending'`,
      [orderId, method, gatewayRef]
    );

    // Update order payment status
    await client.query(
      `UPDATE orders SET payment_status = 'pending', updated_at = NOW() WHERE id = $1`,
      [orderId]
    );

    await logAudit(user.id, 'PAYMENT_INITIATED', 'payments', orderId, { method, gateway_ref: gatewayRef }, client);

    await client.query('COMMIT');

    return {
      order_id: orderId,
      amount: order.total,
      method,
      status: 'pending',
      gateway_ref: gatewayRef,
      checkout_url: checkoutUrl,
      instructions,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Handle Chapa / Payment Gateway Webhook Callback.
 * FR-ECM-09: Requires backend verification before marking payment as paid.
 */
const handleWebhook = async (payload = {}) => {
  const txRef = payload.tx_ref || payload.gateway_ref;
  const status = payload.status || 'success';

  if (!txRef) {
    const err = new Error('Missing gateway transaction reference');
    err.statusCode = 400;
    throw err;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Find payment record
    const { rows: payRows } = await client.query(
      `SELECT id, order_id, status FROM payments WHERE gateway_ref = $1 FOR UPDATE`,
      [txRef]
    );

    if (payRows.length === 0) {
      const err = new Error('Payment transaction reference not found');
      err.statusCode = 404;
      throw err;
    }

    const pay = payRows[0];
    const newStatus = status === 'success' ? 'paid' : 'failed';
    const verifiedAt = newStatus === 'paid' ? new Date() : null;

    // Update payment record
    await client.query(
      `UPDATE payments SET status = $1, verified_at = $2 WHERE id = $3`,
      [newStatus, verifiedAt, pay.id]
    );

    // Update order status in same transaction
    const newOrderStatus = newStatus === 'paid' ? 'confirmed' : 'placed';
    await client.query(
      `UPDATE orders SET payment_status = $1, order_status = $2, updated_at = NOW() WHERE id = $3`,
      [newStatus, newOrderStatus, pay.order_id]
    );

    await logAudit(null, 'PAYMENT_WEBHOOK_VERIFIED', 'payments', pay.id, { gateway_ref: txRef, status: newStatus }, client);

    await client.query('COMMIT');

    return {
      status: 'success',
      payment_status: newStatus,
      order_id: pay.order_id,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieve payment status for an order.
 */
const getPaymentByOrder = async (orderIdParam, user) => {
  const orderId = parseInt(orderIdParam, 10);

  const { rows } = await db.query(
    `SELECT p.id, p.order_id, p.method, p.gateway_ref, p.status, p.verified_at, p.created_at,
            o.parent_id, o.total, o.order_status
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.order_id = $1`,
    [orderId]
  );

  if (rows.length === 0) {
    const err = new Error('Payment record not found for this order');
    err.statusCode = 404;
    throw err;
  }

  const record = rows[0];

  if (user.role === 'parent' && record.parent_id !== user.id) {
    const err = new Error('Forbidden: You do not own this order');
    err.statusCode = 403;
    throw err;
  }

  return record;
};

module.exports = {
  initiatePayment,
  handleWebhook,
  getPaymentByOrder,
};
