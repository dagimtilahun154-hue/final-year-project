'use strict';
const usersService = require('./users.service');

const listUsers   = async (req, res, next) => { try { res.json(await usersService.listUsers(req.query, req.user)); } catch(e) { next(e); } };
const createUser  = async (req, res, next) => { try { res.status(201).json(await usersService.createUser(req.body, req.user)); } catch(e) { next(e); } };
const getUser     = async (req, res, next) => { try { res.json(await usersService.getUserById(req.params.id, req.user)); } catch(e) { next(e); } };
const updateUser  = async (req, res, next) => { try { res.json(await usersService.updateUser(req.params.id, req.body, req.user)); } catch(e) { next(e); } };
const updateStatus = async (req, res, next) => { try { res.json(await usersService.updateStatus(req.params.id, req.body.status, req.user)); } catch(e) { next(e); } };
const getMyProfile  = async (req, res, next) => { try { res.json(await usersService.getMyProfile(req.user)); } catch(e) { next(e); } };
const updateMyProfile = async (req, res, next) => { try { res.json(await usersService.updateMyProfile(req.user, req.body)); } catch(e) { next(e); } };

module.exports = { listUsers, createUser, getUser, updateUser, updateStatus, getMyProfile, updateMyProfile };
