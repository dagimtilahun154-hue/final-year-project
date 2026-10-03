'use strict';
/**
 * src/modules/payments/payments.controller.js
 * Controller for Payment Operations.
 */
const svc = require('./payments.service');

const initiatePayment = async (req, res, next) => {
  try {
    const result = await svc.initiatePayment(req.body, req.user);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
};

const handleWebhook = async (req, res, next) => {
  try {
    const result = await svc.handleWebhook(req.body);
    res.status(200).json(result);
  } catch (e) {
    next(e);
  }
};

const getPaymentByOrder = async (req, res, next) => {
  try {
    const result = await svc.getPaymentByOrder(req.params.id, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

module.exports = {
  initiatePayment,
  handleWebhook,
  getPaymentByOrder,
};
