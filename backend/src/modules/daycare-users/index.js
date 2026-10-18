'use strict';

const express = require('express');
const { createRepository } = require('./repository');
const { createService } = require('./service');
const { createController } = require('./controller');
const { schemas, validate } = require('./validator');

function createDaycareUsers({ pool, authenticate }) {
  if (!pool?.connect || typeof authenticate !== 'function') {
    throw new TypeError('A database pool and authentication middleware are required');
  }
  const service = createService(createRepository(pool));
  const controller = createController(service);
  const router = express.Router();
  const emptyQuery = validate(schemas.empty, 'query');
  const id = validate(schemas.id, 'params');

  router.use(authenticate);
  // Profile routes must precede the /:id routes.
  router.get('/profile/me', emptyQuery, controller.getMyProfile);
  router.patch('/profile/me', emptyQuery, validate(schemas.update, 'body'), controller.updateMyProfile);
  router.get('/', validate(schemas.list, 'query'), controller.listUsers);
  router.post('/', emptyQuery, validate(schemas.create, 'body'), controller.createUser);
  router.get('/:id', emptyQuery, id, controller.getUser);
  router.patch('/:id', emptyQuery, id, validate(schemas.update, 'body'), controller.updateUser);
  router.patch('/:id/status', emptyQuery, id, validate(schemas.status, 'body'), controller.updateStatus);

  return { router, service };
}

module.exports = { createDaycareUsers };
