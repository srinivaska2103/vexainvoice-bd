const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.get('/:id/ledger', supplierController.getLedger);

router.post('/', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), supplierController.createSupplier);
router.put('/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), supplierController.updateSupplier);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), supplierController.updateSupplier);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), supplierController.deleteSupplier);

module.exports = router;
