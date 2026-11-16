const express = require('express');
const router = express.Router();
const exportController = require('../controllers/export.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

router.get(
  '/sales',
  authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'),
  exportController.exportSalesExcel
);

router.get(
  '/customers',
  authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'),
  exportController.exportCustomersExcel
);

module.exports = router;
