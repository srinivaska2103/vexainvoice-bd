const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

// Dashboard
router.get('/dashboard', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.getDashboardMetrics);

// CRM Customers Intelligence
router.get('/customers', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.getCrmCustomers);
router.get('/customers/:customerId/360', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.getCustomer360);

// Follow-ups
router.get('/followups', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.getFollowups);
router.post('/followups', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), crmController.createFollowup);
router.patch('/followups/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), crmController.updateFollowup);
router.delete('/followups/:id', authorize('ADMIN', 'MANAGER'), crmController.deleteFollowup);

// Notes
router.post('/notes', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), crmController.createCustomerNote);

// Customer Segments
router.get('/segments', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.getSavedSegments);
router.post('/segments/evaluate', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), crmController.evaluateSegmentFilters);
router.post('/segments', authorize('ADMIN', 'MANAGER'), crmController.createSavedSegment);
router.delete('/segments/:id', authorize('ADMIN', 'MANAGER'), crmController.deleteSavedSegment);

// Product Insights
router.get('/product-insights', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT', 'STOCK_STAFF'), crmController.getProductInsights);

module.exports = router;
