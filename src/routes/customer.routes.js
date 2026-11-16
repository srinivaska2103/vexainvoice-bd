const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/export', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), require('../controllers/export.controller').exportCustomersExcel);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.get('/:id/ledger', customerController.getLedger);
router.get('/:id/outstanding', customerController.getOutstanding);

router.post('/', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerController.createCustomer);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerController.updateCustomer);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerController.updateCustomer);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), customerController.deleteCustomer);

module.exports = router;
