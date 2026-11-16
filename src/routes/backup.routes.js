const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get('/export', authorize('ADMIN'), backupController.exportBackup);
router.post('/restore', authorize('ADMIN'), backupController.restoreBackup);
router.post('/revert', authorize('ADMIN'), backupController.revertBackup);
router.get('/revert-status', authorize('ADMIN'), backupController.getRevertStatus);
router.get('/list', authorize('ADMIN'), backupController.getDailyBackups);
router.post('/trigger-daily', authorize('ADMIN'), backupController.triggerDailyBackup);
router.get('/download/:filename', authorize('ADMIN'), backupController.downloadDailyBackup);

module.exports = router;
