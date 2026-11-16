const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

// Scanner resolution endpoint
router.get('/scan/:code', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF', 'BILLING_STAFF'), productController.scanProduct);
router.get('/barcode/:barcode', productController.getProductByBarcode);
router.get('/sku/:sku', productController.getProductBySku);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

router.post('/', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), productController.createProduct);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), productController.updateProduct);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), productController.updateProduct);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), productController.deleteProduct);

// Variants
router.get('/:productId/variants', productController.getVariants);
router.post('/:productId/variants', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), productController.addVariant);

module.exports = router;
