'use strict';
/**
 * src/modules/search/search.controller.js
 */
const searchService = require('./search.service');

const search = async (req, res, next) => {
  try {
    const result = await searchService.globalSearch(req.query.q, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  search,
};
