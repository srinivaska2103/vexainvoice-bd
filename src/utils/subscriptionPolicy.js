/**
 * Centralized Subscription Access Control Policy
 * Determines whether a company has valid operational access to VEXA Invoice modules.
 */

const DEFAULT_GRACE_PERIOD_DAYS = 3;

/**
 * Plan Feature Matrix
 * Defines entitlements across all 3 tiers.
 * STARTER (₹599/mo): All standard core business features. Customer self-service portal, online shop and QR shopping are locked.
 * GROWTH (₹999/mo): Inherits everything in STARTER + unlocks Customer Self-Service Portal, Online Shop storefront and QR Shopping.
 * LIFETIME (₹59,999 one-time): Inherits everything in GROWTH + lifetime software access, 1st year free custom domain & hosting.
 */
const PLAN_TIERS = {
  STARTER: {
    name: 'STARTER',
    price: 599.00,
    hasSalesAndBilling: true,
    hasInvoicesAndEstimates: true,
    hasInventoryManagement: true,
    hasBarcodeAndSku: true,
    hasCustomerAndSuppliers: true,
    hasQuotations: true,
    hasFinanceAndExpenses: true,
    hasReportsAndAnalytics: true,
    hasCrm: true,
    hasWhatsappCampaigns: true,
    hasRolesAndPermissions: true,
    hasHelpAndSupport: true,
    hasCustomerPortal: false,
    hasOnlineShop: false,
    hasCustomerOrders: false,
    hasCustomDomain: false,
    hasServerHosting: false,
    isLifetimeAccess: false
  },
  GROWTH: {
    name: 'GROWTH',
    price: 999.00,
    hasSalesAndBilling: true,
    hasInvoicesAndEstimates: true,
    hasInventoryManagement: true,
    hasBarcodeAndSku: true,
    hasCustomerAndSuppliers: true,
    hasQuotations: true,
    hasFinanceAndExpenses: true,
    hasReportsAndAnalytics: true,
    hasCrm: true,
    hasWhatsappCampaigns: true,
    hasRolesAndPermissions: true,
    hasHelpAndSupport: true,
    hasCustomerPortal: true,
    hasOnlineShop: true,
    hasCustomerOrders: true,
    hasCustomDomain: false,
    hasServerHosting: false,
    isLifetimeAccess: false
  },
  LIFETIME: {
    name: 'LIFETIME',
    price: 59999.00,
    hasSalesAndBilling: true,
    hasInvoicesAndEstimates: true,
    hasInventoryManagement: true,
    hasBarcodeAndSku: true,
    hasCustomerAndSuppliers: true,
    hasQuotations: true,
    hasFinanceAndExpenses: true,
    hasReportsAndAnalytics: true,
    hasCrm: true,
    hasWhatsappCampaigns: true,
    hasRolesAndPermissions: true,
    hasHelpAndSupport: true,
    hasCustomerPortal: true,
    hasOnlineShop: true,
    hasCustomerOrders: true,
    hasCustomDomain: true, // First year free
    hasServerHosting: true, // First year free
    isLifetimeAccess: true
  }
};

/**
 * Identify plan tier from subscription or company record
 */
const getPlanTier = (subscription, company, lifetimeLicense) => {
  if (lifetimeLicense || company?.self_shopping_status === 'LIFETIME_ACTIVE') {
    return 'LIFETIME';
  }

  const planName = (subscription?.subscription_plans?.plan_name || '').toUpperCase();
  const amount = Number(subscription?.amount || 0);

  if (planName.includes('LIFETIME') || amount >= 50000) {
    return 'LIFETIME';
  }

  // Growth plan check: plan name contains GROWTH or amount matches regular Growth (₹999) or test Growth
  if (planName.includes('GROWTH') || amount >= 900) {
    return 'GROWTH';
  }

  // Also check company self_shopping_status explicitly
  if (company?.self_shopping_status === 'GROWTH_ACTIVE') {
    return 'GROWTH';
  }

  // Default monthly subscription is STARTER
  return 'STARTER';
};

/**
 * Evaluate subscription access state
 * Supports signatures:
 *   evaluateSubscriptionAccess(subscription, company, lifetimeLicense)
 *   evaluateSubscriptionAccess(company, subscription, lifetimeLicense)
 *
 * @returns {Object} { allowed: boolean, reason: string, status: string, gracePeriodActive: boolean, daysRemaining: number, tier: string, features: Object }
 */
const evaluateSubscriptionAccess = (paramA, paramB, paramC = null) => {
  const now = new Date();

  // Distinguish parameters polymorphically
  let subscription = null;
  let company = null;
  let lifetimeLicense = paramC;

  // A company record always has `business_name`, whereas a subscription record has `business_id` and `plan_id`
  if (paramA && paramA.business_name) {
    // Called as (company, subscription, lifetimeLicense)
    company = paramA;
    subscription = paramB;
  } else if (paramB && paramB.business_name) {
    // Called as (subscription, company, lifetimeLicense)
    subscription = paramA;
    company = paramB;
  } else if (paramA && (paramA.plan_id || paramA.provider)) {
    subscription = paramA;
    company = paramB;
  } else {
    subscription = paramA;
    company = paramB;
  }

  // If company has verified Lifetime Plan (ONE_TIME_LICENSE), lifetime access includes all core features
  if (lifetimeLicense || company?.self_shopping_status === 'LIFETIME_ACTIVE') {
    return {
      allowed: true,
      canAccessApplication: true,
      canCreateTransactions: true,
      reason: 'Lifetime Plan Ownership (All core billing, online shop, and portal features included)',
      status: 'LIFETIME_ACTIVE',
      effectiveSubscriptionStatus: 'ACTIVE',
      effectiveLicenseStatus: 'ACTIVE',
      isLifetime: true,
      tier: 'LIFETIME',
      features: PLAN_TIERS.LIFETIME,
      gracePeriodActive: false,
      subscription
    };
  }

  // If no subscription record exists at all (Pay and Use product model)
  if (!subscription) {
    return {
      allowed: false,
      canAccessApplication: false,
      canCreateTransactions: false,
      reason: 'No active subscription found. VEXA Invoice is a commercial pay-and-use product. Please subscribe to continue.',
      status: 'NO_SUBSCRIPTION',
      effectiveSubscriptionStatus: 'NO_SUBSCRIPTION',
      effectiveLicenseStatus: 'INACTIVE',
      tier: 'RESTRICTED',
      features: { ...PLAN_TIERS.STARTER, hasCustomerPortal: false, hasOnlineShop: false },
      gracePeriodActive: false
    };
  }

  const tier = getPlanTier(subscription, company, lifetimeLicense);
  const features = PLAN_TIERS[tier] || PLAN_TIERS.STARTER;

  const rawStatus = subscription.status;
  const status = rawStatus ? String(rawStatus).toUpperCase() : 'PENDING';

  const {
    current_period_end,
    grace_period_deadline,
    cancel_at_period_end,
    effective_cancellation_date,
    trial_start_at,
    trial_end_at
  } = subscription;

  // 1. TRIALING Status: If a legacy trial record is encountered, treat it as expired under the Pay-and-Use model
  if (status === 'TRIALING') {
    return {
      allowed: false,
      canAccessApplication: false,
      canCreateTransactions: false,
      reason: 'VEXA Invoice is a commercial pay-and-use product. Please activate an active paid subscription to continue.',
      status: 'EXPIRED',
      effectiveSubscriptionStatus: 'EXPIRED',
      effectiveLicenseStatus: 'EXPIRED',
      tier: 'RESTRICTED',
      features,
      gracePeriodActive: false,
      isTrialExpired: true,
      trialActive: false,
      subscription
    };
  }

  // 2. ACTIVE Status
  if (status === 'ACTIVE') {
    // If cancellation was scheduled at period end
    if (cancel_at_period_end) {
      const expiry = effective_cancellation_date ? new Date(effective_cancellation_date) : (current_period_end ? new Date(current_period_end) : null);
      if (expiry && now > expiry) {
        return {
          allowed: false,
          canAccessApplication: false,
          canCreateTransactions: false,
          reason: 'Subscription period has ended following cancellation.',
          status: 'EXPIRED',
          effectiveSubscriptionStatus: 'EXPIRED',
          effectiveLicenseStatus: 'EXPIRED',
          tier: 'RESTRICTED',
          features,
          gracePeriodActive: false,
          subscription
        };
      }
      return {
        allowed: true,
        canAccessApplication: true,
        canCreateTransactions: true,
        reason: 'Subscription active until current period ends (cancellation scheduled)',
        status: 'CANCELLATION_SCHEDULED',
        effectiveSubscriptionStatus: 'ACTIVE',
        effectiveLicenseStatus: 'ACTIVE',
        tier,
        features,
        gracePeriodActive: false,
        subscription
      };
    }

    // Normal active period check
    if (current_period_end && now > new Date(current_period_end)) {
      // Past period end - check if in grace period
      const graceDeadline = grace_period_deadline ? new Date(grace_period_deadline) : new Date(new Date(current_period_end).getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      if (now <= graceDeadline) {
        const msRemaining = graceDeadline.getTime() - now.getTime();
        const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
        return {
          allowed: true,
          canAccessApplication: true,
          canCreateTransactions: true,
          reason: `Subscription period elapsed, but grace period is active (${daysRemaining} day(s) remaining).`,
          status: 'PAST_DUE',
          effectiveSubscriptionStatus: 'PAST_DUE',
          effectiveLicenseStatus: 'ACTIVE',
          tier,
          features,
          gracePeriodActive: true,
          gracePeriodDaysRemaining: daysRemaining,
          daysRemaining,
          subscription
        };
      }
      return {
        allowed: false,
        canAccessApplication: false,
        canCreateTransactions: false,
        reason: 'Subscription billing period and grace period have expired.',
        status: 'EXPIRED',
        effectiveSubscriptionStatus: 'EXPIRED',
        effectiveLicenseStatus: 'EXPIRED',
        tier: 'RESTRICTED',
        features,
        gracePeriodActive: false,
        subscription
      };
    }

    return {
      allowed: true,
      canAccessApplication: true,
      canCreateTransactions: true,
      reason: 'Active subscription',
      status: 'ACTIVE',
      effectiveSubscriptionStatus: 'ACTIVE',
      effectiveLicenseStatus: 'ACTIVE',
      tier,
      features,
      gracePeriodActive: false,
      subscription
    };
  }

  // 3. PAST_DUE or PAYMENT_FAILED (with configured Grace Period)
  if (status === 'PAST_DUE' || status === 'PAYMENT_FAILED') {
    const graceDeadline = grace_period_deadline 
      ? new Date(grace_period_deadline) 
      : (current_period_end 
          ? new Date(new Date(current_period_end).getTime() + DEFAULT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
          : null);

    if (graceDeadline && now <= graceDeadline) {
      const msRemaining = graceDeadline.getTime() - now.getTime();
      const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
      return {
        allowed: true,
        canAccessApplication: true,
        canCreateTransactions: true,
        reason: `Payment renewal failed, but grace period is active (${daysRemaining} day(s) remaining).`,
        status: status,
        effectiveSubscriptionStatus: status,
        effectiveLicenseStatus: 'ACTIVE',
        tier,
        features,
        gracePeriodActive: true,
        gracePeriodDaysRemaining: daysRemaining,
        daysRemaining,
        graceDeadline,
        subscription
      };
    }

    return {
      allowed: false,
      canAccessApplication: false,
      canCreateTransactions: false,
      reason: 'Subscription payment failed and grace period has expired. Please retry payment.',
      status: status,
      effectiveSubscriptionStatus: status,
      effectiveLicenseStatus: 'EXPIRED',
      tier: 'RESTRICTED',
      features,
      gracePeriodActive: false,
      subscription
    };
  }

  // 4. PENDING
  if (status === 'PENDING') {
    return {
      allowed: false,
      canAccessApplication: false,
      canCreateTransactions: false,
      reason: 'Subscription authorization is pending completion.',
      status: 'PENDING',
      effectiveSubscriptionStatus: 'PENDING',
      effectiveLicenseStatus: 'PENDING',
      tier: 'RESTRICTED',
      features,
      gracePeriodActive: false,
      subscription
    };
  }

  // 5. CANCELLED
  if (status === 'CANCELLED') {
    if (effective_cancellation_date && now <= new Date(effective_cancellation_date)) {
      return {
        allowed: true,
        canAccessApplication: true,
        canCreateTransactions: true,
        reason: 'Subscription cancelled but access remains active until the end of the paid billing cycle.',
        status: 'CANCELLED_ACTIVE',
        effectiveSubscriptionStatus: 'ACTIVE',
        effectiveLicenseStatus: 'ACTIVE',
        tier,
        features,
        gracePeriodActive: false,
        effectiveDate: effective_cancellation_date,
        subscription
      };
    }

    return {
      allowed: false,
      canAccessApplication: false,
      canCreateTransactions: false,
      reason: 'Subscription is cancelled. Please subscribe to restore full access.',
      status: 'CANCELLED',
      effectiveSubscriptionStatus: 'CANCELLED',
      effectiveLicenseStatus: 'CANCELLED',
      tier: 'RESTRICTED',
      features,
      gracePeriodActive: false,
      subscription
    };
  }

  // 6. EXPIRED or SUSPENDED
  const statusStr = status ? String(status).toLowerCase() : 'expired';
  return {
    allowed: false,
    canAccessApplication: false,
    canCreateTransactions: false,
    reason: `Subscription is ${statusStr}. Please renew or update your payment mandate.`,
    status: status || 'EXPIRED',
    effectiveSubscriptionStatus: status || 'EXPIRED',
    effectiveLicenseStatus: 'EXPIRED',
    tier: 'RESTRICTED',
    features,
    gracePeriodActive: false,
    subscription
  };
};

module.exports = {
  DEFAULT_GRACE_PERIOD_DAYS,
  PLAN_TIERS,
  getPlanTier,
  evaluateSubscriptionAccess
};
