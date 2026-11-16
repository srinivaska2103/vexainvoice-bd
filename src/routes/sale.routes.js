const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/', saleController.getSales);
router.get('/next/number', saleController.getNextNumber);
router.get('/next-number', saleController.getNextNumber);
router.get('/:id/pdf', saleController.getSalePdf);
router.get('/:id/whatsapp-status', saleController.getSaleWhatsAppStatus);
router.post('/:id/retry-whatsapp', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), saleController.retryWhatsAppReceipt);
router.get('/:id', saleController.getSaleById);

router.get('/export', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF', 'ACCOUNTANT'), require('../controllers/export.controller').exportSalesExcel);
router.post('/', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), saleController.createSale);
router.post('/:id/confirm', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), saleController.createSale);
router.post('/:id/return', authorize('ADMIN', 'MANAGER'), saleController.returnSale);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), saleController.deleteSale);

module.exports = router;
