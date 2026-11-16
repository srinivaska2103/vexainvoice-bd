const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Connection Endpoints
router.get('/connection', whatsappController.getConnection);
router.post('/connect', whatsappController.connectAccount);
router.post('/test-message', whatsappController.sendTestMessage);
router.post('/disconnect', whatsappController.disconnectAccount);

// Wallet Endpoints
router.get('/wallet', whatsappController.getWallet);
router.post('/wallet/topup', whatsappController.addCredits);
router.post('/wallet/recharge/order', whatsappController.createRechargeOrder);
router.post('/wallet/recharge/verify', whatsappController.verifyRechargePayment);
router.get('/wallet/transactions', whatsappController.getTransactions);

// Campaign Endpoints
router.post('/campaigns/estimate', whatsappController.estimateCampaign);
router.post('/campaigns', whatsappController.createCampaign);
router.get('/campaigns', whatsappController.listCampaigns);
router.post('/campaigns/:id/cancel', whatsappController.cancelCampaign);

// Message History Endpoints
router.get('/messages', whatsappController.listMessages);
router.get('/templates/status', whatsappController.getTemplatesStatus);

// Pricing Rate Endpoints
router.get('/rates', whatsappController.getRates);
router.put('/rates', whatsappController.updateRates);

module.exports = router;
