const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

router.use(authenticate);

// Categories
router.get('/categories', masterController.getCategories);
router.post('/categories', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.createCategory);
router.delete('/categories/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.deleteCategory);

// Brands
router.get('/brands', masterController.getBrands);
router.post('/brands', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.createBrand);
router.delete('/brands/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.deleteBrand);

// Colors
router.get('/colors', masterController.getColors);
router.post('/colors', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.createColor);
router.delete('/colors/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.deleteColor);

// Sizes
router.get('/sizes', masterController.getSizes);
router.post('/sizes', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.createSize);
router.delete('/sizes/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), masterController.deleteSize);

module.exports = router;
