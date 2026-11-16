const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');

// Public active plans endpoint
router.get('/plans', subscriptionController.getActivePlans);

// Protected Customer License & Billing routes
router.use(authenticate);

// Get current company subscription and access policy status (ADMIN only)
router.get('/my-status', authorize('ADMIN'), subscriptionController.getCompanySubscriptionStatus);

// Subscription checkout initiation (Owner / Admin only)
router.post('/subscribe', authorize('ADMIN'), subscriptionController.initiateSubscription);

// Verify and reconcile with Razorpay (Owner / Admin only)
router.post('/verify', authorize('ADMIN'), subscriptionController.verifySubscription);

// Cancel subscription (Owner / Admin only)
router.post('/cancel', authorize('ADMIN'), subscriptionController.cancelSubscription);

// Lifetime QR Self-Shopping & Customer Orders Add-on (Owner / Admin only)
router.post('/purchase-lifetime', authorize('ADMIN'), subscriptionController.initiateLifetimePurchase);
router.post('/verify-lifetime', authorize('ADMIN'), subscriptionController.verifyLifetimePurchase);

// Customer billing and payment history (Owner / Admin only)
router.get('/payment-history', authorize('ADMIN'), subscriptionController.getCustomerPaymentHistory);

module.exports = router;
