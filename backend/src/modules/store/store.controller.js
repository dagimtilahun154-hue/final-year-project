'use strict';
/**
 * src/modules/store/store.controller.js
 * Controller for Products & E-Commerce Orders.
 */
const svc = require('./store.service');

const listProducts = async (req, res, next) => {
  try {
    const result = await svc.listProducts(req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const result = await svc.createProduct(req.body, req.user);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const result = await svc.updateProduct(req.params.id, req.body, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const placeOrder = async (req, res, next) => {
  try {
    const result = await svc.placeOrder(req.body, req.user);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const listMyOrders = async (req, res, next) => {
  try {
    const result = await svc.listMyOrders(req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const listAllOrders = async (req, res, next) => {
  try {
    const result = await svc.listAllOrders(req.query, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const updateOrderStatus = async (req, res, next) => {
  try {
    const result = await svc.updateOrderStatus(req.params.id, req.body, req.user);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const result = await svc.listCategories();
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const result = await svc.createCategory(req.body);
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const result = await svc.updateCategory(req.params.id, req.body);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const result = await svc.deleteCategory(req.params.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
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
