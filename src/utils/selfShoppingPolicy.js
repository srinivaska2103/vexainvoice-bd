const prisma = require('../config/db');

/**
 * Evaluate the company's QR Self-Shopping & Customer Orders Entitlement
 * 
 * Entitlement States:
 * - TRIALING: 7-day free trial active until server-confirmed expiry
 * - LIFETIME_ACTIVE: one-time ₹59,999 purchase verified, permanent access
 * - EXPIRED: trial elapsed and no lifetime entitlement exists
 * - PAYMENT_PENDING: one-time payment initiated and awaiting gateway/webhook confirmation
 * - PAYMENT_FAILED: one-time payment failed or was declined
 * 
 * @param {Object} company - businesses database record
 * @returns {Object} detailed entitlement evaluation
 */
const evaluateSelfShoppingEntitlement = async (company) => {
  const now = new Date();

  if (!company) {
    return {
      allowed: false,
      status: 'EXPIRED',
      reason: 'Company not found.',
      isLifetime: false,
      isTrial: false,
      daysRemaining: 0
    };
  }

  // 1. Check if the company has a verified lifetime license
  const lifetimeLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id: company.id,
      license_type: 'ONE_TIME_LICENSE',
      status: 'ACTIVE'
    }
  });

  if (lifetimeLicense || company.self_shopping_status === 'LIFETIME_ACTIVE') {
    return {
      allowed: true,
      status: 'LIFETIME_ACTIVE',
      reason: 'Lifetime access to QR Self-Shopping, Online Shop & Customer Orders is permanently active.',
      isLifetime: true,
      isGrowth: true,
      isTrial: false,
      daysRemaining: null,
      license: lifetimeLicense
    };
  }

  // 1b. Check if the company has an active GROWTH plan subscription (₹999/mo)
  const activeSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id: company.id,
      status: 'ACTIVE'
    },
    include: { subscription_plans: true },
    orderBy: { created_at: 'desc' }
  });

  if (activeSub) {
    const planName = (activeSub.subscription_plans?.plan_name || '').toUpperCase();
    const amount = Number(activeSub.amount || 0);

    if (planName.includes('GROWTH') || amount >= 900) {
      return {
        allowed: true,
        status: 'GROWTH_ACTIVE',
        reason: 'Growth Plan (₹999/mo) includes Online Shop, QR Self-Shopping & Customer Self-Service Portal.',
        isLifetime: false,
        isGrowth: true,
        isTrial: false,
        daysRemaining: null,
        subscription: activeSub
      };
    }
  }

  // 2. Check if a one-time payment is currently pending confirmation
  if (company.self_shopping_status === 'PAYMENT_PENDING') {
    return {
      allowed: false,
      status: 'PAYMENT_PENDING',
      reason: 'Lifetime purchase payment is pending gateway confirmation.',
      isLifetime: false,
      isTrial: false,
      daysRemaining: 0
    };
  }

  // 3. Evaluate 7-Day Free Trial
  // Entitlement rule: Free Trial only unlocks Self-Shopping/Online Shop/Customer Portal
  // IF the company's active trial is explicitly for GROWTH (or lifetime).
  // If the company is on Starter trial (VEXA Invoice Monthly ₹599), Self-Shopping is locked.
  const trialSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id: company.id,
      status: 'TRIALING'
    },
    include: { subscription_plans: true },
    orderBy: { created_at: 'desc' }
  });

  if (trialSub) {
    const planName = (trialSub.subscription_plans?.plan_name || '').toUpperCase();
    const amount = Number(trialSub.amount || 0);
    const isGrowthTrial = planName.includes('GROWTH') || amount >= 900;

    if (!isGrowthTrial) {
      return {
        allowed: false,
        status: 'STARTER_TRIAL_LOCKED',
        reason: 'Customer Self-Service Portal and QR Self-Shopping require the Growth Plan (₹999/mo) or Lifetime Plan.',
        isLifetime: false,
        isTrial: true,
        daysRemaining: 0
      };
    }
  }

  const trialStart = company.self_shopping_trial_start_at || company.created_at || now;
  const trialEnd = company.self_shopping_trial_end_at || new Date(new Date(trialStart).getTime() + 7 * 24 * 60 * 60 * 1000);

  if (now <= trialEnd) {
    const msRemaining = trialEnd.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

    // Ensure database records TRIALING status if not already set
    if (company.self_shopping_status !== 'TRIALING') {
      await prisma.businesses.update({
        where: { id: company.id },
        data: {
          self_shopping_status: 'TRIALING',
          self_shopping_trial_start_at: trialStart,
          self_shopping_trial_end_at: trialEnd,
          has_used_self_shopping_trial: true
        }
      });
    }

    return {
      allowed: true,
      status: 'TRIALING',
      reason: `7-Day Self-Shopping Free Trial is active (${daysRemaining} day(s) remaining).`,
      isLifetime: false,
      isTrial: true,
      trialStart,
      trialEnd,
      daysRemaining
    };
  }

  // 4. Trial Expired
  if (company.self_shopping_status !== 'EXPIRED') {
    await prisma.businesses.update({
      where: { id: company.id },
      data: {
        self_shopping_status: 'EXPIRED',
        has_used_self_shopping_trial: true
      }
    });
  }

  return {
    allowed: false,
    status: 'EXPIRED',
    reason: 'Your 7-day QR Self-Shopping trial has expired. Unlock lifetime access for a one-time ₹59,999 payment.',
    isLifetime: false,
    isTrial: false,
    trialStart,
    trialEnd,
    daysRemaining: 0
  };
};

module.exports = {
  evaluateSelfShoppingEntitlement
};
