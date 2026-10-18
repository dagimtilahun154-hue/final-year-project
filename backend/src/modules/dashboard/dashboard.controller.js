'use strict';
const svc = require('./dashboard.service');
const getStats = async (req, res, next) => { try { res.json(await svc.getStats(req.user)); } catch(e) { next(e); } };
module.exports = { getStats };
