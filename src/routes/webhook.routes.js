const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');

// Razorpay official webhook listener
router.post('/razorpay', webhookController.handlePaymentWebhook);
router.post('/payment-provider', webhookController.handlePaymentWebhook);

module.exports = router;
