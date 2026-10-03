'use strict';
/**
 * src/modules/search/search.routes.js
 */
const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const searchController = require('./search.controller');

router.get('/', auth, searchController.search);

module.exports = router;
