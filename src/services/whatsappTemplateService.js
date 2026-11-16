const axios = require('axios');
const prisma = require('../config/db');

/**
 * WhatsApp Template Service
 * Handles payload formatting, deduplication, tenant isolation and Meta Cloud API dispatch
 * for the 7 official VEXA Invoice WhatsApp templates.
 */
class WhatsAppTemplateService {
  static getMetaConfig() {
    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1391921524005638',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
      wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1438988877738498',
      apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v20.0'
    };
  }

  /**
   * Format phone number to international E.164 without '+' or spaces for Meta API
   * e.g. "8946029205" -> "918946029205"
   */
  static cleanPhoneNumber(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/[^\d]/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = '91' + cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Internal dispatcher to Meta WhatsApp Cloud API
   */
  static async sendMetaTemplateMessage({ to, templateName, languageCode = 'en', bodyParameters = [], headerParameters = null }) {
    const config = this.getMetaConfig();
    if (!config.accessToken || !config.phoneNumberId) {
      throw new Error('Meta WhatsApp Cloud API credentials are not configured in environment variables');
    }

    const recipient = this.cleanPhoneNumber(to);
    if (!recipient || recipient.length < 10) {
      throw new Error(`Invalid recipient phone number: ${to}`);
    }

    const components = [];
    if (headerParameters && Array.isArray(headerParameters) && headerParameters.length > 0) {
      components.push({
        type: 'header',
        parameters: headerParameters
      });
    }

    components.push({
      type: 'body',
      parameters: bodyParameters.map((val) => ({
        type: 'text',
        text: String(val !== undefined && val !== null ? val : '')
      }))
    });

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    };

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return {
      success: true,
      providerMessageId: response.data?.messages?.[0]?.id,
      response: response.data
    };
  }

  /**
   * Uploads a document/media buffer to Meta WhatsApp Cloud API to obtain a media ID
   */
  static async uploadMediaToMeta({ buffer, filename = 'document.pdf', mimeType = 'application/pdf' }) {
    const config = this.getMetaConfig();
    if (!config.accessToken || !config.phoneNumberId) {
      throw new Error('Meta WhatsApp Cloud API credentials not configured');
    }

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/media`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok || !data.id) {
      throw new Error(data.error?.message || 'Failed to upload media to Meta WhatsApp API');
    }

    return { mediaId: data.id };
  }

  /**
   * Sends a document attachment (e.g. PDF) via Meta WhatsApp Cloud API
   */
  static async sendMetaDocumentMessage({ to, mediaId, filename = 'Invoice.pdf', caption = '' }) {
    const config = this.getMetaConfig();
    const recipient = this.cleanPhoneNumber(to);
    if (!recipient || recipient.length < 10) {
      throw new Error(`Invalid recipient phone number: ${to}`);
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'document',
      document: {
        id: mediaId,
        filename,
        caption: caption || undefined
      }
    };

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    return {
      success: true,
      providerMessageId: response.data?.messages?.[0]?.id,
      response: response.data
    };
  }

  /**
   * Record message log in whatsapp_messages with tenant isolation
   */
  static async logMessage({
    businessId,
    customerId = null,
    campaignId = null,
    recipientPhone,
    category = 'UTILITY',
    templateName,
    providerMsgId = null,
    status = 'SENT',
    cost = 0,
    errorMessage = null,
    idempotencyKey = null,
    productId = null,
    invoiceId = null,
    orderId = null,
    subscriptionId = null,
    metadata = null
  }) {
    try {
      if (idempotencyKey) {
        return await prisma.whatsapp_messages.upsert({
          where: { idempotency_key: idempotencyKey },
          update: {
            provider_msg_id: providerMsgId,
            status,
            cost,
            error_message: errorMessage,
            metadata: metadata || {}
          },
          create: {
            business_id: businessId,
            customer_id: customerId,
            campaign_id: campaignId,
            recipient_phone: recipientPhone,
            category,
            template_name: templateName,
            provider_msg_id: providerMsgId,
            status,
            cost,
            error_message: errorMessage,
            idempotency_key: idempotencyKey,
            product_id: productId,
            invoice_id: invoiceId,
            order_id: orderId,
            subscription_id: subscriptionId,
            metadata: metadata || {}
          }
        });
      }

      return await prisma.whatsapp_messages.create({
        data: {
          business_id: businessId,
          customer_id: customerId,
          campaign_id: campaignId,
          recipient_phone: recipientPhone,
          category,
          template_name: templateName,
          provider_msg_id: providerMsgId,
          status,
          cost,
          error_message: errorMessage,
          idempotency_key: idempotencyKey,
          product_id: productId,
          invoice_id: invoiceId,
          order_id: orderId,
          subscription_id: subscriptionId,
          metadata: metadata || {}
        }
      });
    } catch (err) {
      console.error('Failed to log WhatsApp message record:', err.message);
      return null;
    }
  }

  /**
   * =========================================================================
   * TEMPLATE 1: Low Stock Alert (UTILITY, Shop Owner/User, AUTOMATIC)
   * Variables: {{1}} user name, {{2}} product name, {{3}} current stock, {{4}} min stock
   * =========================================================================
   */
  static async sendLowStockAlert({ businessId, productId, currentStockOverride = null, forceRetry = false }) {
    try {
      const { getCurrentStock } = require('./stock.service');

      const product = await prisma.products.findFirst({
        where: { id: productId, business_id: businessId },
        include: {
          businesses: {
            select: {
              id: true,
              business_name: true,
              phone: true,
              owner_name: true
            }
          }
        }
      });

      if (!product) {
        return { skipped: true, reason: 'Product not found' };
      }

      const minStock = Number(product.minimum_stock ?? product.min_stock_level ?? 0);
      if (minStock <= 0) {
        return { skipped: true, reason: 'No minimum stock level configured for product' };
      }

      let currentStock = currentStockOverride !== null ? Number(currentStockOverride) : null;
      if (currentStock === null) {
        const stockRes = await getCurrentStock(businessId, { limit: 1000 });
        const stockObj = (stockRes.stock || []).find(s => s.id === productId);
        currentStock = stockObj ? Number(stockObj.stockQuantity || 0) : 0;
      }

      if (currentStock > minStock && !forceRetry) {
        return { skipped: true, reason: `Stock (${currentStock}) is above minimum threshold (${minStock})` };
      }

      // Check business recipient phone
      const biz = product.businesses;
      const recipientPhone = biz?.phone;
      if (!recipientPhone) {
        return { skipped: true, reason: 'No business phone configured for alerts' };
      }

      // Throttle: Send at most once per 4 hours per product while below threshold
      const idempotencyKey = `LOW_STOCK_${productId}_CROSS_${minStock}`;
      if (!forceRetry) {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const existing = await prisma.whatsapp_messages.findFirst({
          where: {
            business_id: businessId,
            product_id: productId,
            template_name: 'vexa_low_stock_alert',
            status: 'SENT',
            created_at: { gte: fourHoursAgo }
          }
        });
        if (existing) {
          return { skipped: true, reason: 'Low stock alert already dispatched recently (throttled to 4 hours)' };
        }
      }

      const userName = biz.owner_name || biz.business_name || 'Store Owner';
      const productName = product.name;

      const bodyParameters = [
        userName,
        productName,
        String(currentStock),
        String(minStock)
      ];

      let metaResult;
      try {
        metaResult = await this.sendMetaTemplateMessage({
          to: recipientPhone,
          templateName: 'vexa_low_stock_alert',
          bodyParameters
        });
      } catch (sendErr) {
        await this.logMessage({
          businessId,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_low_stock_alert',
          status: 'FAILED',
          errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
          idempotencyKey,
          productId
        });
        return { success: false, error: sendErr.message };
      }

      await this.logMessage({
        businessId,
        recipientPhone,
        category: 'UTILITY',
        templateName: 'vexa_low_stock_alert',
        providerMsgId: metaResult.providerMessageId,
        status: 'SENT',
        idempotencyKey,
        productId,
        metadata: {
          productName,
          currentStock,
          minStock
        }
      });

      return {
        success: true,
        messageId: metaResult.providerMessageId,
        productName,
        currentStock,
        minStock
      };
    } catch (err) {
      console.error('sendLowStockAlert error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reset low stock alert idempotency when stock rises above threshold
   */
  static async resetLowStockAlertEligibility(productId, newStock, minStock) {
    if (newStock > minStock) {
      const idempotencyKey = `LOW_STOCK_${productId}_CROSS_${minStock}`;
      await prisma.whatsapp_messages.deleteMany({
        where: { idempotency_key: idempotencyKey }
      }).catch(() => {});
    }
  }

  /**
   * =========================================================================
   * TEMPLATE 2: Subscription Reminder (UTILITY, Shop Owner/User, AUTOMATIC)
   * Variables: {{1}} user name, {{2}} plan, {{3}} expiry date, {{4}} amount
   * Stages: 7_DAYS, 3_DAYS, 1_DAY
   * =========================================================================
   */
  static async sendSubscriptionReminder({ subscriptionId, stage, forceRetry = false }) {
    try {
      const sub = await prisma.platform_subscriptions.findUnique({
        where: { id: subscriptionId },
        include: {
          subscription_plans: true,
          businesses: {
            select: {
              id: true,
              business_name: true,
              phone: true,
              owner_name: true,
              subscription_status: true
            }
          }
        }
      });

      if (!sub || !sub.businesses) {
        return { skipped: true, reason: 'Subscription or company not found' };
      }

      const biz = sub.businesses;
      const planName = sub.subscription_plans?.plan_name || 'VEXA Plan';

      // Do not send to lifetime subscription customers
      if (planName.toUpperCase().includes('LIFETIME') || sub.is_lifetime || sub.plan_type === 'LIFETIME') {
        return { skipped: true, reason: 'Lifetime subscriptions do not require renewal reminders' };
      }

      // Check if active, trialing, or recently expired/ended
      const allowedStatuses = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'EXPIRED'];
      if (!allowedStatuses.includes(sub.status) && !forceRetry) {
        return { skipped: true, reason: `Subscription status (${sub.status}) not eligible for reminder` };
      }

      const recipientPhone = biz.phone;
      if (!recipientPhone) {
        return { skipped: true, reason: 'No phone number configured for business' };
      }

      // Idempotency check for this subscription and reminder stage
      const idempotencyKey = `SUB_REMINDER_${sub.id}_${stage}`;
      if (!forceRetry) {
        const existing = await prisma.whatsapp_messages.findUnique({
          where: { idempotency_key: idempotencyKey }
        });
        if (existing && existing.status === 'SENT') {
          return { skipped: true, reason: `Reminder for stage ${stage} already sent` };
        }
      }

      const userName = biz.owner_name || biz.business_name || 'Store Owner';
      const expiryDate = sub.current_period_end
        ? new Date(sub.current_period_end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Upcoming';
      const amount = sub.amount ? `₹${Number(sub.amount).toFixed(2)}` : (planName.toUpperCase().includes('GROWTH') ? '₹999.00' : '₹599.00');

      const bodyParameters = [
        userName,
        planName,
        expiryDate,
        amount
      ];

      let metaResult;
      try {
        metaResult = await this.sendMetaTemplateMessage({
          to: recipientPhone,
          templateName: 'vexa_subscription_reminder',
          bodyParameters
        });
      } catch (sendErr) {
        await this.logMessage({
          businessId: biz.id,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_subscription_reminder',
          status: 'FAILED',
          errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
          idempotencyKey,
          subscriptionId: sub.id
        });
        return { success: false, error: sendErr.message };
      }

      await this.logMessage({
        businessId: biz.id,
        recipientPhone,
        category: 'UTILITY',
        templateName: 'vexa_subscription_reminder',
        providerMsgId: metaResult.providerMessageId,
        status: 'SENT',
        idempotencyKey,
        subscriptionId: sub.id,
        metadata: { stage, expiryDate, amount }
      });

      return { success: true, messageId: metaResult.providerMessageId };
    } catch (err) {
      console.error('sendSubscriptionReminder error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * =========================================================================
   * TEMPLATE 3: New Offers Campaign (MARKETING, Customer, MANUAL PAY & USE)
   * Variables: {{1}} customer name, {{2}} shop name, {{3}} offer intro, {{4}} offer details, {{5}} valid until
   * =========================================================================
   */
  static async sendNewOffersCampaignMessage({
    businessId,
    customerId,
    customerName,
    recipientPhone,
    shopName,
    offerIntro,
    offerDetails,
    validUntil,
    campaignId = null
  }) {
    const bodyParameters = [
      customerName || 'Valued Customer',
      shopName,
      offerIntro,
      offerDetails,
      validUntil
    ];

    const metaResult = await this.sendMetaTemplateMessage({
      to: recipientPhone,
      templateName: 'vexa_new_offers_campaign',
      bodyParameters
    });

    await this.logMessage({
      businessId,
      customerId,
      campaignId,
      recipientPhone,
      category: 'MARKETING',
      templateName: 'vexa_new_offers_campaign',
      providerMsgId: metaResult.providerMessageId,
      status: 'SENT',
      cost: 0.85,
      metadata: { offerIntro, offerDetails, validUntil }
    });

    return metaResult;
  }

  /**
   * =========================================================================
   * TEMPLATE 4: New Product Announcement (MARKETING, Customer, MANUAL PAY & USE)
   * Variables: {{1}} customer name, {{2}} product name, {{3}} desc, {{4}} price, {{5}} shop name
   * =========================================================================
   */
  static async sendNewProductAnnouncementMessage({
    businessId,
    customerId,
    customerName,
    recipientPhone,
    productName,
    productDescription,
    productPrice,
    shopName,
    campaignId = null
  }) {
    const bodyParameters = [
      customerName || 'Valued Customer',
      productName,
      productDescription || 'Exclusive new collection',
      productPrice,
      shopName
    ];

    const metaResult = await this.sendMetaTemplateMessage({
      to: recipientPhone,
      templateName: 'vexa_new_product_announcement',
      bodyParameters
    });

    await this.logMessage({
      businessId,
      customerId,
      campaignId,
      recipientPhone,
      category: 'MARKETING',
      templateName: 'vexa_new_product_announcement',
      providerMsgId: metaResult.providerMessageId,
      status: 'SENT',
      cost: 0.85,
      metadata: { productName, productPrice }
    });

    return metaResult;
  }

  /**
   * =========================================================================
   * TEMPLATE 5: Payment Overdue (UTILITY, Customer, AUTOMATIC)
   * Variables: {{1}} customer name, {{2}} shop name, {{3}} invoice number, {{4}} outstanding amount, {{5}} due date
   * Stages: 1_DAY, 3_DAYS, 7_DAYS
   * =========================================================================
   */
  static async sendPaymentOverdueReminder({ saleId, stage }) {
    try {
      const sale = await prisma.sales.findUnique({
        where: { id: saleId },
        include: {
          customers: true,
          businesses: {
            select: { id: true, business_name: true }
          }
        }
      });

      if (!sale || !sale.customers) {
        return { skipped: true, reason: 'Sale or customer not found' };
      }

      // Check collectibility & balance
      const totalAmount = Number(sale.grand_total ?? sale.total_amount ?? 0);
      const paidAmount = Number(sale.paid_amount || 0);
      const outstanding = Number(sale.balance_amount ?? (totalAmount - paidAmount));

      if (outstanding <= 0 || sale.payment_status === 'PAID' || sale.status === 'CANCELLED') {
        return { skipped: true, reason: 'Invoice is fully paid or cancelled' };
      }

      const recipientPhone = sale.customers.phone;
      if (!recipientPhone) {
        return { skipped: true, reason: 'Customer has no registered phone number' };
      }

      const idempotencyKey = `OVERDUE_${sale.id}_STAGE_${stage}`;
      const existing = await prisma.whatsapp_messages.findUnique({
        where: { idempotency_key: idempotencyKey }
      });

      if (existing) {
        return { skipped: true, reason: `Overdue reminder for stage ${stage} already sent` };
      }

      const customerName = sale.customers.name || 'Customer';
      const shopName = sale.businesses?.business_name || 'VEXA Store';
      const invoiceNumber = sale.invoice_number || `INV-${sale.id.slice(0, 8)}`;
      const outstandingStr = `₹${outstanding.toFixed(2)}`;
      const dueDateStr = sale.due_date
        ? new Date(sale.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const bodyParameters = [
        customerName,
        shopName,
        invoiceNumber,
        outstandingStr,
        dueDateStr
      ];

      let metaResult;
      try {
        metaResult = await this.sendMetaTemplateMessage({
          to: recipientPhone,
          templateName: 'vexa_payment_overdue',
          bodyParameters
        });
      } catch (sendErr) {
        await this.logMessage({
          businessId: sale.business_id,
          customerId: sale.customer_id,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_payment_overdue',
          status: 'FAILED',
          errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
          idempotencyKey,
          invoiceId: sale.id
        });
        return { success: false, error: sendErr.message };
      }

      await this.logMessage({
        businessId: sale.business_id,
        customerId: sale.customer_id,
        recipientPhone,
        category: 'UTILITY',
        templateName: 'vexa_payment_overdue',
        providerMsgId: metaResult.providerMessageId,
        status: 'SENT',
        idempotencyKey,
        invoiceId: sale.id,
        metadata: { stage, outstanding: outstandingStr, dueDate: dueDateStr }
      });

      return { success: true, messageId: metaResult.providerMessageId };
    } catch (err) {
      console.error('sendPaymentOverdueReminder error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * =========================================================================
   * TEMPLATE 6: Order Receipt (UTILITY, Customer, AUTOMATIC)
   * Variables: {{1}} customer name, {{2}} shop name, {{3}} order/invoice number, {{4}} order date, {{5}} total amount, {{6}} payment status
   * Attached: Actual downloadable Invoice PDF
   * Supports both POS completed sales ({ saleId }) and Customer portal orders ({ orderId })
   * =========================================================================
   */
  static async sendOrderReceipt({ orderId = null, saleId = null, forceRetry = false }) {
    try {
      const InvoicePdfService = require('./invoicePdf.service');

      if (saleId) {
        // --- 1. POS Sale Triggered Receipt ---
        const sale = await prisma.sales.findUnique({
          where: { id: saleId },
          include: {
            customers: true,
            businesses: true,
            sale_payments: true
          }
        });

        if (!sale) {
          return { skipped: true, reason: 'Sale record not found' };
        }

        // Only send for active completed/confirmed sales (supports PAID, PARTIAL, CREDIT sales)
        if (sale.status === 'CANCELLED' || sale.status === 'DRAFT') {
          return { skipped: true, reason: 'Sale is not in completed state' };
        }

        const recipientPhone = sale.customers?.phone;
        if (!recipientPhone) {
          return { skipped: true, reason: 'No customer phone number recorded' };
        }

        const idempotencyKey = `POS_ORDER_RECEIPT_${sale.id}`;
        if (!forceRetry) {
          const existing = await prisma.whatsapp_messages.findUnique({
            where: { idempotency_key: idempotencyKey }
          });
          if (existing && existing.status === 'SENT') {
            return { skipped: true, reason: 'WhatsApp receipt already sent for this sale', messageId: existing.provider_msg_id };
          }
        }

        const customerName = sale.customers?.name || 'Valued Customer';
        const shopName = sale.businesses?.business_name || 'VEXA Store';
        const invoiceNumber = sale.invoice_number || `INV-${sale.id.slice(0, 8)}`;
        const saleDate = new Date(sale.invoice_date || sale.created_at || Date.now()).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
        const grandTotal = Number(sale.grand_total || sale.total_amount || 0);
        const totalAmount = `₹${grandTotal.toFixed(2)}`;

        // Payment status calculation
        const paidAmount = Number(sale.paid_amount || 0);
        let paymentStatus = 'PAID';
        if (paidAmount <= 0) {
          paymentStatus = 'CREDIT';
        } else if (paidAmount < grandTotal) {
          paymentStatus = 'PARTIALLY PAID';
        } else {
          paymentStatus = 'PAID';
        }

        const bodyParameters = [
          customerName,
          shopName,
          invoiceNumber,
          saleDate,
          totalAmount,
          paymentStatus
        ];

        // 1. Generate Invoice PDF Buffer and validate
        let pdfBuffer = null;
        let pdfFilename = `${invoiceNumber}.pdf`;
        let metaMediaId = null;
        let headerParameters = null;
        let pdfError = null;

        try {
          pdfBuffer = await InvoicePdfService.generateSaleInvoicePdfBuffer(sale.id);
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('Generated PDF buffer is empty');
          }
          const uploadRes = await this.uploadMediaToMeta({
            buffer: pdfBuffer,
            filename: pdfFilename,
            mimeType: 'application/pdf'
          });
          metaMediaId = uploadRes.mediaId;

          // Attach PDF to the template HEADER component as approved in Meta
          headerParameters = [
            {
              type: 'document',
              document: {
                id: metaMediaId,
                filename: pdfFilename
              }
            }
          ];
        } catch (genOrUpErr) {
          pdfError = genOrUpErr.message;
          console.error('Invoice PDF generation or Meta upload error:', genOrUpErr.message);
        }

        let metaResult;
        try {
          metaResult = await this.sendMetaTemplateMessage({
            to: recipientPhone,
            templateName: 'vexa_order_receipt',
            bodyParameters,
            headerParameters
          });
        } catch (sendErr) {
          await this.logMessage({
            businessId: sale.business_id,
            customerId: sale.customer_id,
            recipientPhone,
            category: 'UTILITY',
            templateName: 'vexa_order_receipt',
            status: 'FAILED',
            errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
            idempotencyKey,
            invoiceId: sale.id,
            metadata: {
              pdfFilename,
              metaMediaId,
              pdfError
            }
          });
          return { success: false, error: sendErr.message };
        }

        await this.logMessage({
          businessId: sale.business_id,
          customerId: sale.customer_id,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_order_receipt',
          providerMsgId: metaResult.providerMessageId,
          status: 'SENT',
          idempotencyKey,
          invoiceId: sale.id,
          metadata: {
            invoiceNumber,
            totalAmount,
            paymentStatus,
            pdfFilename,
            metaMediaId,
            hasDocumentHeader: Boolean(headerParameters),
            pdfError
          }
        });

        return {
          success: true,
          messageId: metaResult.providerMessageId,
          metaMediaId,
          hasDocumentHeader: Boolean(headerParameters),
          pdfError
        };
      }

      // --- 2. Customer Order (Online Store) Triggered Receipt ---
      const order = await prisma.customer_orders.findUnique({
        where: { id: orderId },
        include: {
          customers: true,
          businesses: {
            select: { id: true, business_name: true }
          }
        }
      });

      if (!order) {
        return { skipped: true, reason: 'Customer order not found' };
      }

      const recipientPhone = order.customer_phone || order.customers?.phone;
      if (!recipientPhone) {
        return { skipped: true, reason: 'No customer phone on order' };
      }

      const idempotencyKey = `ORDER_RECEIPT_${order.id}`;
      if (!forceRetry) {
        const existing = await prisma.whatsapp_messages.findUnique({
          where: { idempotency_key: idempotencyKey }
        });
        if (existing && existing.status === 'SENT') {
          return { skipped: true, reason: 'Order receipt already sent for this order' };
        }
      }

      const customerName = order.customer_name || order.customers?.name || 'Customer';
      const shopName = order.businesses?.business_name || 'VEXA Store';
      const orderNumber = order.order_number || `ORD-${order.id.slice(0, 8)}`;
      const orderDate = new Date(order.created_at || Date.now()).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const totalAmount = `₹${Number(order.estimated_total ?? order.total_amount ?? 0).toFixed(2)}`;
      const paymentStatus = order.payment_status || (order.status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING');

      const bodyParameters = [
        customerName,
        shopName,
        orderNumber,
        orderDate,
        totalAmount,
        paymentStatus
      ];

      let metaResult;
      try {
        metaResult = await this.sendMetaTemplateMessage({
          to: recipientPhone,
          templateName: 'vexa_order_receipt',
          bodyParameters
        });
      } catch (sendErr) {
        await this.logMessage({
          businessId: order.business_id,
          customerId: order.customer_id,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_order_receipt',
          status: 'FAILED',
          errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
          idempotencyKey,
          orderId: order.id
        });
        return { success: false, error: sendErr.message };
      }

      await this.logMessage({
        businessId: order.business_id,
        customerId: order.customer_id,
        recipientPhone,
        category: 'UTILITY',
        templateName: 'vexa_order_receipt',
        providerMsgId: metaResult.providerMessageId,
        status: 'SENT',
        idempotencyKey,
        orderId: order.id,
        metadata: { orderNumber, totalAmount, paymentStatus }
      });

      return { success: true, messageId: metaResult.providerMessageId };
    } catch (err) {
      console.error('sendOrderReceipt error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * =========================================================================
   * TEMPLATE 7: Thank You for Purchasing (UTILITY, Customer, AUTOMATIC)
   * Variables: {{1}} customer name, {{2}} shop name, {{3}} invoice number, {{4}} purchase amount
   * =========================================================================
   */
  static async sendThankYouForPurchase({ saleId }) {
    try {
      const sale = await prisma.sales.findUnique({
        where: { id: saleId },
        include: {
          customers: true,
          businesses: {
            select: { id: true, business_name: true }
          }
        }
      });

      if (!sale) {
        return { skipped: true, reason: 'Sale record not found' };
      }

      // Do not send for draft, failed, or cancelled sales
      if (sale.status === 'CANCELLED' || sale.status === 'DRAFT') {
        return { skipped: true, reason: 'Sale is not confirmed or cancelled' };
      }

      const recipientPhone = sale.customers?.phone;
      if (!recipientPhone) {
        return { skipped: true, reason: 'No customer phone number available' };
      }

      // Send once per completed invoice
      const idempotencyKey = `THANK_YOU_SALE_${sale.id}`;
      const existing = await prisma.whatsapp_messages.findUnique({
        where: { idempotency_key: idempotencyKey }
      });

      if (existing) {
        return { skipped: true, reason: 'Thank you message already sent for this sale' };
      }

      const customerName = sale.customers?.name || 'Valued Customer';
      const shopName = sale.businesses?.business_name || 'VEXA Store';
      const invoiceNumber = sale.invoice_number || `INV-${sale.id.slice(0, 8)}`;
      const grandTotal = Number(sale.grand_total ?? sale.total_amount ?? 0);
      const purchaseAmount = `₹${grandTotal.toFixed(2)}`;

      const bodyParameters = [
        customerName,
        shopName,
        invoiceNumber,
        purchaseAmount
      ];

      let metaResult;
      try {
        metaResult = await this.sendMetaTemplateMessage({
          to: recipientPhone,
          templateName: 'vexa_thank_you_purchase',
          bodyParameters
        });
      } catch (sendErr) {
        await this.logMessage({
          businessId: sale.business_id,
          customerId: sale.customer_id,
          recipientPhone,
          category: 'UTILITY',
          templateName: 'vexa_thank_you_purchase',
          status: 'FAILED',
          errorMessage: sendErr.response?.data ? JSON.stringify(sendErr.response.data) : sendErr.message,
          idempotencyKey,
          invoiceId: sale.id
        });
        return { success: false, error: sendErr.message };
      }

      await this.logMessage({
        businessId: sale.business_id,
        customerId: sale.customer_id,
        recipientPhone,
        category: 'UTILITY',
        templateName: 'vexa_thank_you_purchase',
        providerMsgId: metaResult.providerMessageId,
        status: 'SENT',
        idempotencyKey,
        invoiceId: sale.id,
        metadata: { invoiceNumber, purchaseAmount }
      });

      return { success: true, messageId: metaResult.providerMessageId };
    } catch (err) {
      console.error('sendThankYouForPurchase error:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Scheduled Background Job: Scan Subscriptions approaching expiry (7d, 3d, 1d)
   */
  static async scanAndSendSubscriptionReminders() {
    try {
      const now = new Date();
      const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const oneDay = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

      // Find active/trialing subscriptions ending within 8 days
      const activeSubs = await prisma.platform_subscriptions.findMany({
        where: {
          status: { in: ['ACTIVE', 'TRIALING'] },
          current_period_end: {
            gte: now,
            lte: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)
          }
        }
      });

      for (const sub of activeSubs) {
        const diffMs = new Date(sub.current_period_end) - now;
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

        let stage = null;
        if (diffDays <= 1) {
          stage = '1_DAY';
        } else if (diffDays <= 3) {
          stage = '3_DAYS';
        } else if (diffDays <= 7) {
          stage = '7_DAYS';
        }

        if (stage) {
          await this.sendSubscriptionReminder({ subscriptionId: sub.id, stage });
        }
      }
    } catch (err) {
      console.error('scanAndSendSubscriptionReminders error:', err);
    }
  }

  /**
   * Scheduled Background Job: Scan Overdue Invoices (1d, 3d, 7d after due date)
   */
  static async scanAndSendOverdueReminders() {
    try {
      const now = new Date();
      // Overdue sales that have outstanding balance
      const overdueSales = await prisma.sales.findMany({
        where: {
          balance_amount: { gt: 0 },
          status: { notIn: ['CANCELLED', 'DRAFT'] }
        },
        include: {
          customers: true,
          businesses: true
        },
        take: 100
      });

      for (const sale of overdueSales) {
        if (!sale.due_date) continue;
        const overdueDays = Math.floor((now - new Date(sale.due_date)) / (24 * 60 * 60 * 1000));

        let stage = null;
        if (overdueDays >= 7) {
          stage = '7_DAYS';
        } else if (overdueDays >= 3) {
          stage = '3_DAYS';
        } else if (overdueDays >= 1) {
          stage = '1_DAY';
        }

        if (stage) {
          await this.sendPaymentOverdueReminder({ saleId: sale.id, stage });
        }
      }
    } catch (err) {
      console.error('scanAndSendOverdueReminders error:', err);
    }
  }
}

module.exports = WhatsAppTemplateService;

