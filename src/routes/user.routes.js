const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get('/', authorize('ADMIN', 'MANAGER', 'users.view'), userController.getUsers);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'users.view'), userController.getUserById);
router.post('/', authorize('ADMIN', 'users.create'), userController.createUser);
router.put('/:id', authorize('ADMIN', 'users.edit'), userController.updateUser);
router.delete('/:id', authorize('ADMIN', 'users.deactivate'), userController.deleteUser);

module.exports = router;
