const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stock.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/low', stockController.getLowStock);
router.get('/out-of-stock', stockController.getOutOfStock);
router.get('/transactions', stockController.getTransactions);
router.get('/', stockController.getCurrentStock);
router.get('/:productId', stockController.getStockByProductId);

router.post('/adjustment', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), stockController.adjustStock);

module.exports = router;
