'use strict';
/**
 * src/modules/payments/payments.service.js
 * Business logic for Daycare Payments & Gateway Integration.
 * SRS Refs: FR-ECM-07–10, TBD-02 (Chapa), NFR-REL-03
 */
const db = require('../../config/db');

/**
 * Payment processing is deferred until a verified provider integration exists.
 * Keep this guard in the service so internal callers cannot bypass the HTTP route.
 * Do not add an environment switch that re-enables the former unverified flow.
 */
const paymentUnavailable = () => {
  const err = new Error('Payment processing is not available yet.');
  err.statusCode = 503;
  err.code = 'PAYMENTS_UNAVAILABLE';
  return err;
};

const initiatePayment = async () => {
  throw paymentUnavailable();
};

/**
 * Never acknowledge or apply an unverified payment callback. Replacing this guard
 * requires provider signature/transaction verification and idempotent transitions.
 */
const handleWebhook = async () => {
  throw paymentUnavailable();
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
