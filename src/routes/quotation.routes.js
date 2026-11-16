const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT', 'quotations.view'), quotationController.getQuotations);
router.get('/metrics', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT', 'quotations.view'), quotationController.getQuotationMetrics);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT', 'quotations.view'), quotationController.getQuotationById);
router.post('/', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'quotations.create'), quotationController.createQuotation);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'quotations.edit'), quotationController.updateQuotation);
router.patch('/:id/status', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'quotations.edit'), quotationController.updateStatus);
router.post('/:id/convert-to-sale', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'quotations.convert'), quotationController.convertToSale);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'quotations.delete'), quotationController.deleteQuotation);

module.exports = router;
