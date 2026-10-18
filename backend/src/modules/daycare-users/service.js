'use strict';

const bcrypt = require('bcryptjs');
const { schemas, validateData } = require('./validator');

const daycareRoles = new Set(['admin', 'caregiver', 'parent']);
const managedRoles = new Set(['caregiver', 'parent']);
const error = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function safeError(failure) {
  // In particular, do not forward PostgreSQL's unique-violation detail: the
  // retained global email constraint can refer to another daycare's account.
  if (failure?.code === '23505') return error(409, 'Account information is unavailable. Please use different information.');
  if (failure?.code === '40001' || failure?.code === '40P01') return error(503, 'Please try the operation again.');
  if (failure?.code) return error(500, 'The account operation could not be completed.');
  if ([401, 403, 404, 409, 422, 503].includes(failure?.statusCode)) return failure;
  return error(500, 'The account operation could not be completed.');
}

function principal(actor) {
  if (!actor || actor.principal_kind !== 'daycare' ||
      !Number.isInteger(actor.id) || actor.id < 1 || actor.id > 2147483647 ||
      !Number.isInteger(actor.daycare_id) || actor.daycare_id < 1 || actor.daycare_id > 2147483647 ||
      !daycareRoles.has(actor.role)) {
    throw error(401, 'Authentication required');
  }
  return actor;
}

function createService(repository) {
  const run = (operation) => async (...args) => {
    try { return await operation(...args); } catch (failure) { throw safeError(failure); }
  };

  async function context(actorInput, { write = false, admin = false, targetId } = {}, work) {
    const actor = principal(actorInput);
    return repository.transaction(async (client) => {
      // This order matches login/session operations and prevents suspension or
      // role/status changes from racing an already-authorized account write.
      const daycare = await repository.lockDaycare(client, actor.daycare_id);
      if (!daycare || daycare.status !== 'active') throw error(403, 'Daycare access is unavailable');
      const users = await repository.lockUsers(client, actor.daycare_id,
        targetId ? [actor.id, targetId] : [actor.id], write);
      const currentActor = users.find((user) => user.id === actor.id);
      if (!currentActor || currentActor.status !== 'active' || !daycareRoles.has(currentActor.role)) {
        throw error(401, 'Authentication required');
      }
      if (admin && currentActor.role !== 'admin') throw error(403, 'Administrator access required');
      const target = targetId ? users.find((user) => user.id === targetId) : undefined;
      if (targetId && (!target || !daycareRoles.has(target.role))) throw error(404, 'User not found');
      return work(client, currentActor, target);
    });
  }

  function targetId(value) {
    return validateData(schemas.id, { id: value }).id;
  }

  async function requireAvailableEmail(client, actor, email, exceptId) {
    if (email && await repository.emailExists(client, actor.daycare_id, email, exceptId)) {
      throw error(409, 'Account information is unavailable. Please use different information.');
    }
  }

  function requireManagedTarget(target) {
    if (!managedRoles.has(target.role)) {
      throw error(403, 'Daycare administrator accounts are managed by the platform owner');
    }
  }

  const listUsers = run(async (actor, query = {}) => {
    const filters = validateData(schemas.list, query);
    return context(actor, { admin: true }, (client, currentActor) =>
      repository.list(client, currentActor.daycare_id, filters));
  });

  const getUserById = run(async (actor, id) => context(actor,
    { admin: true, targetId: targetId(id) }, async (client, currentActor, target) => target));

  const createUser = run(async (actor, body) => {
    principal(actor);
    // Reject a known non-admin before expensive password hashing; the current
    // database role is still checked again inside the locked transaction.
    if (actor.role !== 'admin') throw error(403, 'Administrator access required');
    const data = validateData(schemas.create, body);
    // Provisioning is limited independently in the service, not only in routes.
    if (!managedRoles.has(data.role)) throw error(422, 'Invalid account role');
    const hash = await bcrypt.hash(data.password, 12);
    return context(actor, { write: true, admin: true }, async (client, currentActor) => {
      await requireAvailableEmail(client, currentActor, data.email);
      const role = await repository.findProvisionableRole(client, data.role);
      if (!role) throw error(503, 'Account provisioning is unavailable');
      const record = await repository.insert(client, currentActor.daycare_id, data, hash, role.id);
      await repository.audit(client, currentActor, 'USER_REGISTERED', record.id, { role: data.role });
      return record;
    });
  });

  async function writeProfile(actor, id, body, self) {
    const data = validateData(schemas.update, body);
    return context(actor, { write: true, admin: !self, targetId: id }, async (client, currentActor, target) => {
      if (!self) requireManagedTarget(target);
      if (self && target.id !== currentActor.id) throw error(403, 'Access denied');
      await requireAvailableEmail(client, currentActor, data.email, target.id);
      const emailChanged = data.email !== undefined && data.email !== target.email;
      const changedFields = ['name', 'email'].filter((field) =>
        data[field] !== undefined && data[field] !== target[field]);
      const record = await repository.update(client, currentActor.daycare_id, target.id, data);
      if (emailChanged) {
        await repository.revokeSessions(client, currentActor.daycare_id, target.id);
        await repository.invalidateRecovery(client, currentActor.daycare_id, target.id);
      }
      await repository.audit(client, currentActor, self ? 'USER_PROFILE_UPDATED' : 'USER_UPDATED',
        target.id, { changed_fields: changedFields, sessions_revoked: emailChanged });
      return emailChanged ? { ...record, reauthentication_required: true } : record;
    });
  }

  const updateUser = run(async (actor, id, body) => writeProfile(actor, targetId(id), body, false));

  const updateStatus = run(async (actor, id, status) => {
    const data = validateData(schemas.status, { status });
    return context(actor, { write: true, admin: true, targetId: targetId(id) },
      async (client, currentActor, target) => {
        requireManagedTarget(target);
        const record = await repository.updateStatus(client, currentActor.daycare_id, target.id, data.status);
        // Re-activation never revives sessions, challenges, or recovery links.
        await repository.revokeSessions(client, currentActor.daycare_id, target.id);
        await repository.invalidateRecovery(client, currentActor.daycare_id, target.id);
        await repository.audit(client, currentActor, 'USER_STATUS_CHANGED', target.id,
          { status: data.status, sessions_revoked: true });
        return record;
      });
  });

  const getMyProfile = run(async (actor) => {
    principal(actor);
    return context(actor, { targetId: actor.id }, async (client, currentActor) => currentActor);
  });

  const updateMyProfile = run(async (actor, body) => {
    principal(actor);
    return writeProfile(actor, actor.id, body, true);
  });

  return { listUsers, getUserById, createUser, updateUser, updateStatus, getMyProfile, updateMyProfile };
}

module.exports = { createService };
