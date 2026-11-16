const prisma = require('../config/db');
const WhatsAppWalletService = require('./whatsappWalletService');

/**
 * WhatsApp Campaign Service
 * Handles campaign target filtering, rate calculations, wallet checks, and execution.
 */
class WhatsAppCampaignService {
  /**
   * Get active message rates configured by Platform Admin
   */
  static async getRate(category = 'MARKETING') {
    let rateConfig = await prisma.whatsapp_rate_configs.findUnique({
      where: { category }
    });

    if (!rateConfig) {
      // Default initial platform rates if not yet configured
      const defaultRates = {
        MARKETING: 0.85,
        UTILITY: 0.35,
        AUTHENTICATION: 0.25,
        SERVICE: 0.35
      };

      rateConfig = await prisma.whatsapp_rate_configs.create({
        data: {
          category,
          rate_per_msg: defaultRates[category] || 0.85,
          currency: 'INR',
          is_active: true
        }
      });
    }

    return Number(rateConfig.rate_per_msg);
  }

  /**
   * Filter and validate eligible customers for campaign
   */
  static async getTargetAudience(businessId, audienceFilter = {}) {
    const { segment = 'ALL', selectedCustomerIds } = audienceFilter;

    let whereClause = {
      business_id: businessId,
      is_active: true
    };

    if (Array.isArray(selectedCustomerIds) && selectedCustomerIds.length > 0) {
      whereClause.id = { in: selectedCustomerIds };
    } else if (segment === 'NEW') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      whereClause.created_at = { gte: thirtyDaysAgo };
    } else if (segment === 'REPEAT') {
      whereClause.sales = { some: {} };
    } else if (segment === 'HIGH_VALUE') {
      whereClause.current_balance = { gte: 5000 };
    }

    const customers = await prisma.customers.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        phone: true
      }
    });

    const eligible = [];
    const excluded = [];

    for (const c of customers) {
      const cleanPhone = c.phone ? c.phone.replace(/[^\d+]/g, '') : '';
      if (!cleanPhone || cleanPhone.length < 10) {
        excluded.push({ ...c, reason: 'Invalid or missing phone number' });
      } else {
        eligible.push({ ...c, formattedPhone: cleanPhone.startsWith('+') ? cleanPhone : `+91${cleanPhone.replace(/^0+/, '')}` });
      }
    }

    return {
      totalCount: customers.length,
      eligible,
      excluded,
      eligibleCount: eligible.length,
      excludedCount: excluded.length
    };
  }

  /**
   * Estimate Campaign Cost & Wallet Check
   */
  static async estimateCampaign(businessId, { name, category = 'MARKETING', audienceFilter }) {
    const rate = await this.getRate(category);
    const audience = await this.getTargetAudience(businessId, audienceFilter);
    const wallet = await WhatsAppWalletService.getWallet(businessId);

    const estimatedCost = Number((audience.eligibleCount * rate).toFixed(2));
    const availableBalance = wallet.available_balance;
    const canAfford = availableBalance >= estimatedCost;

    return {
      category,
      ratePerMsg: rate,
      totalAudience: audience.totalCount,
      eligibleCount: audience.eligibleCount,
      excludedCount: audience.excludedCount,
      estimatedCost,
      walletAvailable: availableBalance,
      canAfford,
      shortfall: canAfford ? 0 : Number((estimatedCost - availableBalance).toFixed(2))
    };
  }

  /**
   * Create Campaign & Reserve Wallet Funds
   */
  static async createCampaign(businessId, createdBy, campaignData) {
    const { name, templateName, category = 'MARKETING', audienceFilter } = campaignData;

    if (!name || !templateName) {
      throw new Error('Campaign name and WhatsApp template name are required');
    }

    const estimate = await this.estimateCampaign(businessId, { name, category, audienceFilter });

    if (!estimate.canAfford) {
      throw new Error(`Insufficient WhatsApp balance. Required: ₹${estimate.estimatedCost}, Available: ₹${estimate.walletAvailable}`);
    }

    const audience = await this.getTargetAudience(businessId, audienceFilter);

    // Create Campaign Record & Reserve Funds atomically
    return await prisma.$transaction(async (tx) => {
      const campaign = await tx.whatsapp_campaigns.create({
        data: {
          business_id: businessId,
          name,
          template_name: templateName,
          category,
          audience_filter: audienceFilter || {},
          total_audience: audience.totalCount,
          eligible_count: audience.eligibleCount,
          excluded_count: audience.excludedCount,
          rate_per_msg: estimate.ratePerMsg,
          estimated_cost: estimate.estimatedCost,
          reserved_amount: estimate.estimatedCost,
          status: 'QUEUED',
          created_by: createdBy
        }
      });

      // Insert Recipient Queue Records
      if (audience.eligible.length > 0) {
        await tx.whatsapp_campaign_recipients.createMany({
          data: audience.eligible.map((rec) => ({
            campaign_id: campaign.id,
            customer_id: rec.id,
            phone: rec.formattedPhone,
            status: 'QUEUED'
          }))
        });
      }

      // Reserve Wallet Funds
      await WhatsAppWalletService.reserveBalance(businessId, campaign.id, estimate.estimatedCost, createdBy);

      // Async process sending queue
      setImmediate(() => {
        this.processCampaignQueue(campaign.id).catch((err) => console.error(`Error processing campaign ${campaign.id}:`, err));
      });

      return campaign;
    });
  }

  /**
   * Process Asynchronous Campaign Queue
   */
  static async processCampaignQueue(campaignId) {
    const campaign = await prisma.whatsapp_campaigns.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          include: {
            customers: true
          }
        },
        businesses: true
      }
    });

    if (!campaign || campaign.status === 'CANCELLED') return;

    await prisma.whatsapp_campaigns.update({
      where: { id: campaignId },
      data: { status: 'SENDING', updated_at: new Date() }
    });

    let sent = 0;
    let failed = 0;
    const rate = Number(campaign.rate_per_msg);
    const WhatsAppTemplateService = require('./whatsappTemplateService');

    const shopName = campaign.businesses?.business_name || 'VEXA Store';
    const filter = campaign.audience_filter || {};

    for (const rec of campaign.recipients) {
      try {
        let metaResult;
        const customerName = rec.customers?.name || 'Valued Customer';

        if (campaign.template_name === 'vexa_new_product_announcement') {
          metaResult = await WhatsAppTemplateService.sendNewProductAnnouncementMessage({
            businessId: campaign.business_id,
            customerId: rec.customer_id,
            customerName,
            recipientPhone: rec.phone,
            productName: filter.product_name || 'Featured Product',
            productDescription: filter.product_description || 'Check out our latest product arrivals.',
            productPrice: filter.product_price ? `₹${Number(filter.product_price).toFixed(2)}` : 'Special Price',
            shopName,
            campaignId: campaign.id
          });
        } else {
          // Default: vexa_new_offers_campaign
          metaResult = await WhatsAppTemplateService.sendNewOffersCampaignMessage({
            businessId: campaign.business_id,
            customerId: rec.customer_id,
            customerName,
            recipientPhone: rec.phone,
            shopName,
            offerIntro: filter.offer_intro || 'We have exciting offers for you!',
            offerDetails: filter.offer_details || 'Special discounts available on selected collections.',
            validUntil: filter.valid_until || 'Limited Period',
            campaignId: campaign.id
          });
        }

        sent++;
        await prisma.whatsapp_campaign_recipients.update({
          where: { id: rec.id },
          data: {
            status: 'SENT',
            message_id: metaResult.providerMessageId,
            sent_at: new Date()
          }
        });
      } catch (err) {
        failed++;
        await prisma.whatsapp_campaign_recipients.update({
          where: { id: rec.id },
          data: {
            status: 'FAILED',
            error_reason: err.response?.data ? JSON.stringify(err.response.data) : (err.message || 'Transmission failed')
          }
        });
      }
    }

    const actualCost = Number((sent * rate).toFixed(2));

    await prisma.whatsapp_campaigns.update({
      where: { id: campaignId },
      data: {
        status: 'COMPLETED',
        sent_count: sent,
        delivered_count: sent,
        failed_count: failed,
        actual_cost: actualCost,
        updated_at: new Date()
      }
    });

    // Finalize Wallet Charge & Release remaining reservation
    await WhatsAppWalletService.finalizeCampaignCharge(
      campaign.business_id,
      campaign.id,
      actualCost,
      Number(campaign.reserved_amount),
      campaign.created_by
    );
  }

  /**
   * Cancel Queued Campaign
   */
  static async cancelCampaign(businessId, campaignId, createdBy) {
    const campaign = await prisma.whatsapp_campaigns.findFirst({
      where: { id: campaignId, business_id: businessId }
    });

    if (!campaign) throw new Error('Campaign not found');

    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new Error(`Campaign cannot be cancelled in ${campaign.status} status`);
    }

    await prisma.whatsapp_campaigns.update({
      where: { id: campaignId },
      data: { status: 'CANCELLED', updated_at: new Date() }
    });

    await WhatsAppWalletService.releaseReservation(
      businessId,
      campaignId,
      Number(campaign.reserved_amount),
      createdBy
    );

    return { message: 'Campaign cancelled successfully' };
  }

  /**
   * List Business Campaigns
   */
  static async listCampaigns(businessId, { limit = 20, page = 1 } = {}) {
    const take = Number(limit);
    const skip = (Number(page) - 1) * take;

    const [total, campaigns] = await Promise.all([
      prisma.whatsapp_campaigns.count({ where: { business_id: businessId } }),
      prisma.whatsapp_campaigns.findMany({
        where: { business_id: businessId },
        orderBy: { created_at: 'desc' },
        take,
        skip,
        include: {
          users: { select: { name: true, email: true } }
        }
      })
    ]);

    return {
      total,
      page: Number(page),
      limit: take,
      data: campaigns.map((c) => ({
        ...c,
        rate_per_msg: Number(c.rate_per_msg),
        estimated_cost: Number(c.estimated_cost),
        actual_cost: Number(c.actual_cost),
        reserved_amount: Number(c.reserved_amount)
      }))
    };
  }
}

module.exports = WhatsAppCampaignService;
