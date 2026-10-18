'use strict';

function createController(service) {
  const handle = (work, status = 200) => async (req, res, next) => {
    try {
      // The principal comes from authentication, never from query/body fields.
      if (!req.authSession || req.user?.principal_kind !== 'daycare' ||
          !Number.isInteger(req.daycareId) || req.daycareId !== req.user.daycare_id) {
        throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
      }
      res.status(status).json(await work(req));
    } catch (error) {
      next(error);
    }
  };

  return {
    listUsers: handle((req) => service.listUsers(req.user, req.query)),
    createUser: handle((req) => service.createUser(req.user, req.body), 201),
    getUser: handle((req) => service.getUserById(req.user, req.params.id)),
    updateUser: handle((req) => service.updateUser(req.user, req.params.id, req.body)),
    updateStatus: handle((req) => service.updateStatus(req.user, req.params.id, req.body.status)),
    getMyProfile: handle((req) => service.getMyProfile(req.user)),
    updateMyProfile: handle((req) => service.updateMyProfile(req.user, req.body)),
  };
}

module.exports = { createController };
