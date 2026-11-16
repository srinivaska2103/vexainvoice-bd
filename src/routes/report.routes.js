const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/dashboard', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT', 'dashboard.view'), reportController.getDashboard);
router.get('/sales', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT', 'reports.sales'), reportController.getSalesReport);
router.get('/purchases', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT', 'reports.purchases'), reportController.getPurchaseReport);
router.get('/stock/valuation', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF', 'reports.stock'), reportController.getStockValuationReport);
router.get('/customers/outstanding', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT', 'reports.customers'), reportController.getCustomersOutstandingReport);
router.get('/suppliers/outstanding', authorize('ADMIN', 'MANAGER', 'ACCOUNTANT', 'reports.suppliers'), reportController.getSuppliersOutstandingReport);

module.exports = router;
