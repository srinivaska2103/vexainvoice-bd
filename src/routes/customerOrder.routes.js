const express = require('express');
const router = express.Router();
const customerOrderController = require('../controllers/customerOrder.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { requireActiveSubscription } = require('../middleware/subscription.middleware');

router.use(authenticate);
router.use(requireActiveSubscription);

// Middleware enforcing Growth or Lifetime plan entitlement for QR Self-Shopping & Customer Orders
const requireGrowthOrLifetimeEntitlement = async (req, res, next) => {
  try {
    const prisma = require('../config/db');
    const { evaluateSelfShoppingEntitlement } = require('../utils/selfShoppingPolicy');
    const company = await prisma.businesses.findUnique({
      where: { id: req.user.business_id }
    });

    const entitlement = await evaluateSelfShoppingEntitlement(company);
    if (!entitlement.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access to Customer Orders requires the Growth (₹999/mo) or Lifetime Plan. Please upgrade in Subscription & Billing.',
        locked: true
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

router.use(requireGrowthOrLifetimeEntitlement);

// Customer orders section available to authorized sales & billing roles
router.get('/', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerOrderController.getCustomerOrders);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerOrderController.getCustomerOrderById);
router.patch('/:id/status', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerOrderController.updateCustomerOrderStatus);
router.post('/:id/link-sale', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), customerOrderController.linkSaleToOrder);

module.exports = router;
