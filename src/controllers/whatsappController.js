const WhatsAppWalletService = require('../services/whatsappWalletService');
const WhatsAppCampaignService = require('../services/whatsappCampaignService');
const WhatsAppConnectionService = require('../services/whatsappConnectionService');
const prisma = require('../config/db');

// GET /api/whatsapp/connection
exports.getConnection = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const status = await WhatsAppConnectionService.getConnectionStatus(businessId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/connect
exports.connectAccount = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { phoneNumberId, wabaId, displayPhoneNumber, verifiedName, accessToken } = req.body;

    const result = await WhatsAppConnectionService.connectAccount(businessId, {
      phoneNumberId,
      wabaId,
      displayPhoneNumber,
      verifiedName,
      accessToken
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/test-message
exports.sendTestMessage = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { recipientPhone } = req.body;

    const result = await WhatsAppConnectionService.sendTestMessage(businessId, recipientPhone);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/disconnect
exports.disconnectAccount = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const result = await WhatsAppConnectionService.disconnectAccount(businessId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/wallet
exports.getWallet = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const wallet = await WhatsAppWalletService.getWallet(businessId);
    res.json({ success: true, data: wallet });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/wallet/topup
exports.addCredits = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { amount, reference, description } = req.body;

    const result = await WhatsAppWalletService.addCredits(businessId, amount, {
      reference,
      createdBy: userId,
      description
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/wallet/recharge/order
exports.createRechargeOrder = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { amount } = req.body;

    const orderData = await WhatsAppWalletService.createRechargeOrder(businessId, userId, amount);
    res.json({ success: true, data: orderData });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/wallet/recharge/verify
exports.verifyRechargePayment = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    const result = await WhatsAppWalletService.verifyRechargePayment(businessId, userId, {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/wallet/transactions
exports.getTransactions = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { limit = 50, page = 1 } = req.query;

    const result = await WhatsAppWalletService.getTransactions(businessId, { limit, page });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/campaigns/estimate
exports.estimateCampaign = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { name, category, audienceFilter } = req.body;

    const estimate = await WhatsAppCampaignService.estimateCampaign(businessId, {
      name,
      category,
      audienceFilter
    });

    res.json({ success: true, data: estimate });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/campaigns
exports.createCampaign = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;

    const campaign = await WhatsAppCampaignService.createCampaign(businessId, userId, req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/campaigns
exports.listCampaigns = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { limit = 20, page = 1 } = req.query;

    const result = await WhatsAppCampaignService.listCampaigns(businessId, { limit, page });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// POST /api/whatsapp/campaigns/:id/cancel
exports.cancelCampaign = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await WhatsAppCampaignService.cancelCampaign(businessId, id, userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/rates
exports.getRates = async (req, res, next) => {
  try {
    const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'];
    const rates = {};

    for (const cat of categories) {
      rates[cat] = await WhatsAppCampaignService.getRate(cat);
    }

    res.json({ success: true, data: rates });
  } catch (err) {
    next(err);
  }
};

// PUT /api/whatsapp/rates (Platform Admin Only)
exports.updateRates = async (req, res, next) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Platform Administrator privileges required' });
    }

    const { rates } = req.body; // e.g. { MARKETING: 0.85, UTILITY: 0.35 }
    if (!rates || typeof rates !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid rates object' });
    }

    const updated = [];
    for (const [category, rate] of Object.entries(rates)) {
      const numRate = Number(rate);
      if (!isNaN(numRate) && numRate >= 0) {
        const item = await prisma.whatsapp_rate_configs.upsert({
          where: { category },
          update: { rate_per_msg: numRate, updated_at: new Date() },
          create: { category, rate_per_msg: numRate, currency: 'INR' }
        });
        updated.push(item);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/messages (Authenticated Company Message History)
exports.listMessages = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const { category, status, search, limit = 50, page = 1 } = req.query;

    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const where = {
      business_id: businessId,
      ...(category && category !== 'ALL' ? { category } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(search ? {
        OR: [
          { recipient_phone: { contains: search, mode: 'insensitive' } },
          { template_name: { contains: search, mode: 'insensitive' } },
          { provider_msg_id: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    };

    const [total, messages] = await Promise.all([
      prisma.whatsapp_messages.count({ where }),
      prisma.whatsapp_messages.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take,
        skip,
        include: {
          customers: {
            select: { id: true, name: true, phone: true }
          }
        }
      })
    ]);

    res.json({
      success: true,
      total,
      page: Number(page),
      limit: take,
      data: messages
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/whatsapp/templates/status (Check Live Meta Templates Approval)
exports.getTemplatesStatus = async (req, res, next) => {
  try {
    const axios = require('axios');
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!token || !wabaId) {
      return res.json({ success: false, message: 'Meta credentials not configured' });
    }

    const metaRes = await axios.get(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const approvedTemplates = (metaRes.data?.data || []).filter(t => t.name.startsWith('vexa_'));
    res.json({
      success: true,
      count: approvedTemplates.length,
      templates: approvedTemplates.map(t => ({
        name: t.name,
        category: t.category,
        status: t.status,
        language: t.language
      }))
    });
  } catch (err) {
    next(err);
  }
};
