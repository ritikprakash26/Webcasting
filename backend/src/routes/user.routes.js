const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} = require('../controllers/user.controller');
const authenticate = require('../middlewares/auth.middleware');
const { checkRole } = require('../middlewares/role.middleware');
const { ensureTenant } = require('../middlewares/tenant.middleware');

// All routes require authentication, tenant context, and admin role
router.use(authenticate);
router.use(ensureTenant);
router.use(checkRole('admin'));

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
