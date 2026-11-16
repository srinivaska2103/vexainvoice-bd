const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/role');
const { sendEmail } = require('../config/email');
const { 
  sendSaleInvoiceEmail, 
  sendPurchaseOrderEmail,
  wrapHtmlEmail
} = require('../services/notification.service');
const prisma = require('../config/db');

router.use(authenticate);

/**
 * GET /api/email/status
 * Returns real server SMTP connection status without exposing credentials
 */
router.get('/status', async (req, res, next) => {
  try {
    const isConfigured = Boolean(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD));
    return res.status(200).json({
      success: true,
      data: {
        configured: isConfigured,
        status: isConfigured ? 'CONNECTED' : 'UNCONFIGURED',
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        sender: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vexainvoice.com'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/test
 * ADMIN-only test endpoint to verify SMTP configuration
 */
router.post('/test', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Recipient email address is required' });
    }

    const result = await sendEmail({
      business_id: req.user.business_id,
      recipient_email: email.trim(),
      subject: 'VEXA Invoice SMTP Test Email',
      body_text: 'Hello,\n\nThis is a test email sent from VEXA Invoice System to verify SMTP configuration.\n\nEverything is working properly!',
      body_html: `
        <div style="font-family: sans-serif; padding: 20px; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #3b82f6;">VEXA Invoice SMTP Test</h2>
          <p>This is a test email to confirm that your email notification system is configured correctly.</p>
          <p style="font-[12px]; color: #64748b;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `,
      email_type: 'TEST'
    });

    if (result.error) {
      return res.status(500).json({ success: false, message: `Failed to send test email: ${result.error}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Test email sent successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/email/logs
 * Fetch business email history logs
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, email_type } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = {
      business_id: req.user.business_id,
      ...(email_type ? { email_type } : {})
    };

    const total = await prisma.email_logs.count({ where });
    const logs = await prisma.email_logs.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' }
    });

    return res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/resend/sale/:id
 * Manual resend for sale invoice email
 */
router.post('/resend/sale/:id', authorize('ADMIN', 'MANAGER', 'BILLING_STAFF'), async (req, res, next) => {
  try {
    const result = await sendSaleInvoiceEmail(req.user.business_id, req.params.id, true);
    if (result.error) {
      return res.status(500).json({ success: false, message: `Email resend failed: ${result.error}` });
    }
    return res.status(200).json({
      success: true,
      message: result.message || `Invoice resent to ${result.recipient_email}`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/resend/purchase/:id
 * Manual resend for supplier purchase email
 */
router.post('/resend/purchase/:id', authorize('ADMIN', 'MANAGER', 'STOCK_STAFF'), async (req, res, next) => {
  try {
    const result = await sendPurchaseOrderEmail(req.user.business_id, req.params.id, true);
    if (result.error) {
      return res.status(500).json({ success: false, message: `Purchase email resend failed: ${result.error}` });
    }
    return res.status(200).json({
      success: true,
      message: result.message || 'Purchase order email sent to supplier'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/retry/:logId
 * Retry sending a failed email log
 */
router.post('/retry/:logId', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const log = await prisma.email_logs.findFirst({
      where: { id: req.params.logId, business_id: req.user.business_id }
    });

    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }

    let result = { success: false, message: 'Unknown email type' };
    if (log.email_type === 'SALE_INVOICE' && log.reference_id) {
      result = await sendSaleInvoiceEmail(req.user.business_id, log.reference_id, true);
    } else if (log.email_type === 'PURCHASE_ORDER' && log.reference_id) {
      result = await sendPurchaseOrderEmail(req.user.business_id, log.reference_id, true);
    } else {
      const biz = await prisma.businesses.findUnique({ where: { id: req.user.business_id } });
      const businessName = biz?.business_name || 'VEXA Business';
      const bodyText = log.body_text || `Resent notification for ${log.subject}`;
      const bodyHtml = log.body_html || `
        <div style="font-family: sans-serif; padding: 20px; color: #0f172a; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h3 style="color: #2563eb;">${businessName}</h3>
          <p style="font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line;">${bodyText}</p>
        </div>
      `;

      result = await sendEmail({
        business_id: req.user.business_id,
        recipient_email: log.recipient_email,
        subject: log.subject || 'Notification Update',
        body_text: bodyText,
        body_html: bodyHtml,
        email_type: log.email_type,
        reference_id: log.reference_id,
        reference_number: log.reference_number
      });
    }

    if (result.error) {
      return res.status(500).json({ success: false, message: `Retry failed: ${result.error}` });
    }

    return res.status(200).json({
      success: true,
      message: 'Email retried successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/email/settings
 * Retrieve business automatic email preference settings
 */
router.get('/settings', async (req, res, next) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id },
      select: { logo_url: true } // use existing business metadata or default settings
    });

    const defaultSettings = {
      sale_invoice: true,
      purchase_update: true,
      low_stock: true,
      customer_payment: true,
      supplier_payment: true,
      campaign_emails: true
    };

    let settings = defaultSettings;
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try {
        const parsed = JSON.parse(biz.logo_url);
        if (parsed.email_settings) {
          settings = { ...defaultSettings, ...parsed.email_settings };
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/email/settings
 * Update business automatic email preference settings
 */
router.put('/settings', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id }
    });

    let currentMeta = {};
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try { currentMeta = JSON.parse(biz.logo_url); } catch (e) {}
    } else if (biz?.logo_url) {
      currentMeta.logo = biz.logo_url;
    }

    const updatedEmailSettings = {
      sale_invoice: req.body.sale_invoice !== undefined ? !!req.body.sale_invoice : true,
      purchase_update: req.body.purchase_update !== undefined ? !!req.body.purchase_update : true,
      low_stock: req.body.low_stock !== undefined ? !!req.body.low_stock : true,
      customer_payment: req.body.customer_payment !== undefined ? !!req.body.customer_payment : true,
      supplier_payment: req.body.supplier_payment !== undefined ? !!req.body.supplier_payment : true,
      campaign_emails: req.body.campaign_emails !== undefined ? !!req.body.campaign_emails : true
    };

    currentMeta.email_settings = updatedEmailSettings;

    await prisma.businesses.update({
      where: { id: req.user.business_id },
      data: {
        logo_url: JSON.stringify(currentMeta)
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Email settings updated successfully',
      data: updatedEmailSettings
    });
  } catch (error) {
    next(error);
  }
});

const defaultEmailTemplates = {
  sale_invoice: {
    id: 'sale_invoice',
    name: 'Sales Invoice',
    description: 'Send the invoice to the customer after a sale.',
    subject: 'Invoice {{invoice_number}} from {{business_name}}',
    message: 'Hello {{customer_name}},\n\nThank you for your purchase from {{business_name}}.\n\nYour invoice {{invoice_number}} for {{invoice_total}} is ready.\n\nRegards,\n{{business_name}}'
  },
  purchase_update: {
    id: 'purchase_update',
    name: 'Purchase Update',
    description: 'Send purchase details to your supplier.',
    subject: 'Purchase Order {{order_number}} from {{business_name}}',
    message: 'Hello {{supplier_name}},\n\nPlease find purchase order {{order_number}} from {{business_name}}.\n\nRegards,\n{{business_name}}'
  },
  low_stock: {
    id: 'low_stock',
    name: 'Low Stock Alert',
    description: 'Get an alert when products are running low.',
    subject: 'Low Stock Alert for {{business_name}}',
    message: 'Attention Team,\n\nThe stock for {{product_name}} (SKU: {{sku}}) is running low.\nCurrent Stock: {{current_stock}} {{unit}}\nMinimum Threshold: {{min_stock}} {{unit}}\n\nPlease check your inventory dashboard.\n\nRegards,\n{{business_name}}'
  },
  customer_payment: {
    id: 'customer_payment',
    name: 'Customer Payment Receipt',
    description: 'Send a payment receipt to customers.',
    subject: 'Payment Receipt from {{business_name}}',
    message: 'Hello {{customer_name}},\n\nWe have received your payment of {{paid_amount}} on {{payment_date}}.\n\nYour remaining balance is {{balance}}.\n\nThank you!\n{{business_name}}'
  },
  supplier_payment: {
    id: 'supplier_payment',
    name: 'Supplier Payment Confirmation',
    description: 'Send payment confirmation to suppliers.',
    subject: 'Payment Confirmation from {{business_name}}',
    message: 'Hello {{supplier_name}},\n\nPayment of {{paid_amount}} has been issued on {{payment_date}}.\n\nRegards,\n{{business_name}}'
  },
  campaign: {
    id: 'campaign',
    name: 'Campaign Emails',
    description: 'Send special offers and updates to your customers.',
    subject: 'New Special Offer from {{business_name}}!',
    message: 'Hello {{customer_name}},\n\nDiscover our latest products and exclusive offers tailored just for you.\n\nVisit us or reply to learn more!\n\nRegards,\n{{business_name}}'
  }
};

/**
 * GET /api/email/templates
 * Retrieve business email message templates
 */
router.get('/templates', async (req, res, next) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id },
      select: { logo_url: true }
    });

    let templates = { ...defaultEmailTemplates };
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try {
        const parsed = JSON.parse(biz.logo_url);
        if (parsed.email_templates) {
          templates = { ...defaultEmailTemplates, ...parsed.email_templates };
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/email/templates
 * Save updated business email message templates
 */
router.put('/templates', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id }
    });

    let currentMeta = {};
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try { currentMeta = JSON.parse(biz.logo_url); } catch (e) {}
    } else if (biz?.logo_url) {
      currentMeta.logo = biz.logo_url;
    }

    const newTemplates = req.body.templates || req.body;
    currentMeta.email_templates = {
      ...(currentMeta.email_templates || {}),
      ...newTemplates
    };

    await prisma.businesses.update({
      where: { id: req.user.business_id },
      data: {
        logo_url: JSON.stringify(currentMeta)
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Email message templates updated successfully',
      data: currentMeta.email_templates
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/email/campaigns
 */
router.get('/campaigns', async (req, res, next) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id },
      select: { logo_url: true }
    });

    let campaigns = [];
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try {
        const parsed = JSON.parse(biz.logo_url);
        if (Array.isArray(parsed.campaigns)) {
          campaigns = parsed.campaigns;
        }
      } catch (e) {}
    }

    // Also fetch campaigns from email_logs table
    const campaignLogs = await prisma.email_logs.findMany({
      where: {
        business_id: req.user.business_id,
        email_type: 'CAMPAIGN'
      },
      orderBy: { created_at: 'desc' }
    });

    if (campaignLogs.length > 0) {
      const groupedMap = new Map();
      for (const log of campaignLogs) {
        const key = log.reference_number || log.subject || 'Campaign';
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            id: `camp-log-${log.id}`,
            name: key,
            channel: 'Email',
            audience: 'All Registered Customers',
            subject: log.subject,
            message: log.body_text || '',
            recipientsCount: 0,
            sentCount: 0,
            status: 'Sent',
            date: new Date(log.sent_at || log.created_at).toISOString().split('T')[0],
            created_at: log.created_at,
            createdBy: 'Admin'
          });
        }
        const camp = groupedMap.get(key);
        camp.recipientsCount += 1;
        if (log.status === 'SENT') camp.sentCount += 1;
      }

      const existingNames = new Set(campaigns.map(c => (c.name || '').toLowerCase()));
      for (const lc of groupedMap.values()) {
        if (!existingNames.has((lc.name || '').toLowerCase())) {
          campaigns.push(lc);
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/campaigns
 * Create and dispatch a new email campaign to matching target audience
 */
router.post('/campaigns', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { name, audienceType = 'ALL', audience, subject, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required' });
    }

    // Fetch targeted customers with non-empty emails
    const customerWhere = {
      business_id: req.user.business_id,
      NOT: [
        { email: null },
        { email: '' }
      ]
    };
    if (audienceType && audienceType !== 'ALL') {
      customerWhere.customer_type = audienceType;
    }

    const customers = await prisma.customers.findMany({
      where: customerWhere,
      select: { id: true, name: true, email: true }
    });

    const biz = await prisma.businesses.findUnique({
      where: { id: req.user.business_id }
    });
    const businessName = biz?.business_name || 'VEXA Business';

    const { extractBusinessLogo } = require('../services/notification.service');
    const logoUrl = extractBusinessLogo(biz);

    // Deduplicate recipient emails to ensure each customer receives the email exactly ONCE
    const processedEmails = new Set();
    let sentCount = 0;

    for (const cust of customers) {
      const emailAddr = cust.email?.trim().toLowerCase();
      if (emailAddr && emailAddr.includes('@') && !processedEmails.has(emailAddr)) {
        processedEmails.add(emailAddr);

        const textBody = (message || '')
          .replace(/\{\{\s*customer_name\s*\}\}/g, cust.name || 'Valued Customer')
          .replace(/\{\{\s*business_name\s*\}\}/g, businessName);

        const emailTitle = (subject || name).replace(/\{\{\s*business_name\s*\}\}/g, businessName);

        const emailTemplate = wrapHtmlEmail(
          emailTitle,
          textBody,
          businessName,
          logoUrl
        );

        await sendEmail({
          business_id: req.user.business_id,
          recipient_email: cust.email,
          subject: emailTitle,
          body_text: textBody,
          body_html: emailTemplate.htmlBody,
          attachments: emailTemplate.attachments,
          email_type: 'CAMPAIGN',
          reference_id: null,
          reference_number: name
        });
        sentCount++;
      }
    }

    let currentMeta = {};
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try { currentMeta = JSON.parse(biz.logo_url); } catch (e) {}
    } else if (biz?.logo_url) {
      currentMeta.logo = biz.logo_url;
    }

    const newCampaign = {
      id: `camp-${Date.now()}`,
      name: name.trim(),
      channel: 'Email',
      audience: 'All Registered Customers',
      audienceType: audienceType || 'ALL',
      subject: subject || name,
      message: message || '',
      recipientsCount: customers.length,
      sentCount,
      status: 'Sent',
      date: new Date().toISOString().split('T')[0],
      createdBy: req.user.name || 'Admin'
    };

    const updatedCampaigns = [newCampaign, ...(currentMeta.campaigns || [])];
    currentMeta.campaigns = updatedCampaigns;

    await prisma.businesses.update({
      where: { id: req.user.business_id },
      data: {
        logo_url: JSON.stringify(currentMeta)
      }
    });

    return res.status(201).json({
      success: true,
      message: `Campaign created and sent to ${sentCount} recipients!`,
      data: newCampaign
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/email/trigger-low-stock
 * Manually trigger low stock scan and send consolidated email alert immediately
 */
router.post('/trigger-low-stock', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { sendLowStockAlert } = require('../services/notification.service');
    const result = await sendLowStockAlert(req.user.business_id, true);
    return res.status(200).json({
      success: true,
      message: result.message || 'Low stock email alert process executed',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

