'use strict';
const svc = require('./groups.service');
const listGroups   = async (req, res, next) => { try { res.json(await svc.listGroups(req.user)); } catch(e) { next(e); } };
const createGroup  = async (req, res, next) => { try { res.status(201).json(await svc.createGroup(req.body, req.user)); } catch(e) { next(e); } };
const updateGroup  = async (req, res, next) => { try { res.json(await svc.updateGroup(req.params.id, req.body, req.user)); } catch(e) { next(e); } };
const deleteGroup  = async (req, res, next) => { try { res.json(await svc.deleteGroup(req.params.id, req.user)); } catch(e) { next(e); } };
module.exports = { listGroups, createGroup, updateGroup, deleteGroup };
