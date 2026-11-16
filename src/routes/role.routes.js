const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Public route to resolve role slug for dynamic login routing
router.get('/slug/:slug', roleController.getRoleBySlug);

// Protected routes:
// - Reading roles: Accessible to ADMIN, MANAGER, and any user/role with 'roles.view' permission (or custom roles like Stock Role if granted)
// - Modifying roles: Restricted to ADMIN / 'roles.manage_permissions'
router.use(authenticate);

router.get('/', authorize('ADMIN', 'MANAGER', 'roles.view'), roleController.getRoles);
router.post('/', authorize('ADMIN', 'roles.manage_permissions'), roleController.createRole);
router.put('/:id', authorize('ADMIN', 'roles.manage_permissions'), roleController.updateRole);
router.delete('/:id', authorize('ADMIN', 'roles.manage_permissions'), roleController.deleteRole);

module.exports = router;
