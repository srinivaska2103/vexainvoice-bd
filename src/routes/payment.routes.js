const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

// Customer Payments
router.post('/customer', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), paymentController.createCustomerPayment);
router.get('/customer', paymentController.getCustomerPayments);
router.get('/customer/:customerId', paymentController.getCustomerPayments);

// Supplier Payments
router.post('/supplier', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF', 'ACCOUNTANT'), paymentController.createSupplierPayment);
router.get('/supplier', paymentController.getSupplierPayments);
router.get('/supplier/:supplierId', paymentController.getSupplierPayments);

module.exports = router;
