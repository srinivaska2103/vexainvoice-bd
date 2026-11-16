const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/', purchaseController.getPurchases);
router.get('/:id', purchaseController.getPurchaseById);

router.post('/', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), purchaseController.createPurchase);
router.post('/:id/confirm', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), purchaseController.createPurchase);
router.post('/:id/return', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), purchaseController.returnPurchase);

module.exports = router;
