const { Router } = require('express');
const authCtrl = require('../controllers/authController');
const { authenticate, checkPermission } = require('../services/authService');
const { validate, loginSchema, registerSchema, updateRoleSchema } = require('../middlewares/validate');

function createAuthRouter() {
  const router = Router();

  router.post('/register', validate(registerSchema), authCtrl.register);
  router.post('/login', validate(loginSchema), authCtrl.login);
  router.get('/me', authenticate, authCtrl.getProfile);
  router.get('/users', authenticate, checkPermission('view_users'), authCtrl.listUsers);
  router.patch('/users/:id/role', authenticate, checkPermission('manage_users'), validate(updateRoleSchema), authCtrl.updateUserRole);

  return router;
}

module.exports = createAuthRouter;