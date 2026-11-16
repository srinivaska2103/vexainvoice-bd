const prisma = require('../config/db');
const env = require('../config/env');
const razorpay = require('../config/razorpay');
const { logAudit } = require('./audit.service');
const { evaluateSubscriptionAccess, DEFAULT_GRACE_PERIOD_DAYS } = require('../utils/subscriptionPolicy');
const {
  sendNewSubscriptionSuccessEmail,
  sendSubscriptionCancellationEmail,
  sendRenewalSuccessEmail,
  sendRenewalFailedEmail,
  sendUpcomingRenewalReminderEmail
} = require('./subscriptionEmail.service');

const PLAN_STARTER_NAME = 'VEXA Starter';
const PLAN_STARTER_AMOUNT = 599.00; // Flat ₹599/mo

const PLAN_GROWTH_NAME = 'VEXA Growth';
const PLAN_GROWTH_AMOUNT = 999.00; // Flat ₹999/mo

/**
 * Get active plans available for subscription
 */
const getActivePlans = async () => {
  return await prisma.subscription_plans.findMany({
    where: { is_active: true },
    orderBy: { price: 'asc' }
  });
};

/**
 * Ensure Razorpay has recurring monthly plan configured
 */
const ensurePlan = async (planType = 'STARTER') => {
  const isGrowth = String(planType).toUpperCase().includes('GROWTH');
  const planName = isGrowth ? PLAN_GROWTH_NAME : PLAN_STARTER_NAME;
  const planAmount = isGrowth ? PLAN_GROWTH_AMOUNT : PLAN_STARTER_AMOUNT;
  const configuredPlanId = isGrowth ? env.RAZORPAY_GROWTH_PLAN_ID : env.RAZORPAY_PLAN_ID;

  if (!razorpay.isConfigured()) {
    return {
      id: configuredPlanId || (isGrowth ? 'plan_default_vexa_growth_999' : 'plan_default_vexa_599'),
      name: planName,
      amount: planAmount * 100,
      currency: 'INR'
    };
  }
  return await razorpay.ensureRazorpayPlan({
    planId: configuredPlanId,
    amountInPaise: Math.round(planAmount * 100),
    name: planName
  });
};

/**
 * Company Subscription & Feature Access Status Policy
 */
const getCompanySubscriptionStatus = async (business_id) => {
  const company = await prisma.businesses.findUnique({
    where: { id: business_id },
    select: {
      id: true,
      company_id: true,
      business_name: true,
      email: true,
      phone: true,
      created_at: true,
      subscription_status: true,
      license_status: true,
      self_shopping_status: true
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // Find effective subscription: prioritize ACTIVE or TRIALING over an abandoned PENDING checkout session
  let latestSubscription = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id,
      status: { in: ['ACTIVE', 'TRIALING'] }
    },
    orderBy: { created_at: 'desc' },
    include: { subscription_plans: true }
  });

  if (!latestSubscription) {
    latestSubscription = await prisma.platform_subscriptions.findFirst({
      where: { business_id },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true }
    });
  }

  const lifetimeLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id,
      license_type: 'ONE_TIME_LICENSE',
      status: 'ACTIVE'
    }
  });

  const accessEvaluation = evaluateSubscriptionAccess(latestSubscription, company, lifetimeLicense);

  const isGrowthOrLifetime = accessEvaluation.tier === 'GROWTH' || accessEvaluation.tier === 'LIFETIME' || !!lifetimeLicense;

  return {
    company: {
      ...company,
      subscription_status: accessEvaluation.status,
      license_status: lifetimeLicense ? 'ACTIVE' : company.license_status,
      self_shopping_status: lifetimeLicense ? 'LIFETIME_ACTIVE' : (isGrowthOrLifetime ? 'GROWTH_ACTIVE' : company.self_shopping_status)
    },
    subscription: latestSubscription,
    lifetime_license: lifetimeLicense,
    access_policy: {
      can_access_application: accessEvaluation.allowed,
      can_create_transactions: accessEvaluation.allowed,
      access_tier: accessEvaluation.tier,
      features: accessEvaluation.features,
      reason: accessEvaluation.reason,
      days_remaining: accessEvaluation.daysRemaining,
      grace_period_active: accessEvaluation.gracePeriodActive,
      trial_active: accessEvaluation.isTrial || false,
      trial_days_remaining: accessEvaluation.daysRemaining,
      lifetime_active: !!lifetimeLicense || company.self_shopping_status === 'LIFETIME_ACTIVE',
      growth_active: isGrowthOrLifetime,
      customer_portal_unlocked: isGrowthOrLifetime,
      qr_self_shopping_unlocked: isGrowthOrLifetime
    },
    plans: {
      starter: {
        name: PLAN_STARTER_NAME,
        price: PLAN_STARTER_AMOUNT,
        currency: 'INR',
        billing_interval: 'MONTHLY'
      },
      growth: {
        name: PLAN_GROWTH_NAME,
        price: PLAN_GROWTH_AMOUNT,
        currency: 'INR',
        billing_interval: 'MONTHLY'
      },
      lifetime: {
        name: 'VEXA Lifetime Add-on',
        price: 59999.00,
        currency: 'INR',
        billing_interval: 'ONE_TIME'
      }
    },
    razorpayConfigured: razorpay.isConfigured()
  };
};

/**
 * Initiate Razorpay Monthly Subscription Mandate Checkout
 * Supports STARTER (₹599) or GROWTH (₹999)
 */
const initiateSubscription = async (business_id, user_id, requestedPlan = 'STARTER') => {
  if (!razorpay.isConfigured()) {
    throw new Error('Razorpay credentials are not configured on the server. Please provide RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend environment.');
  }

  const isGrowth = String(requestedPlan).toUpperCase().includes('GROWTH') || Number(requestedPlan) === 999;
  const targetPlanName = isGrowth ? PLAN_GROWTH_NAME : PLAN_STARTER_NAME;
  const targetAmount = isGrowth ? PLAN_GROWTH_AMOUNT : PLAN_STARTER_AMOUNT;

  const [company, user] = await Promise.all([
    prisma.businesses.findUnique({ where: { id: business_id } }),
    prisma.users.findUnique({ where: { id: user_id } })
  ]);

  if (!company) throw new Error('Company not found');
  if (!user) throw new Error('User not found');

  // Check if an already ACTIVE subscription exists for this specific plan
  const activeSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id,
      status: 'ACTIVE'
    },
    include: { subscription_plans: true },
    orderBy: { created_at: 'desc' }
  });

  if (activeSub && !activeSub.cancel_at_period_end) {
    const currentIsGrowth = (activeSub.subscription_plans?.plan_name || '').toUpperCase().includes('GROWTH') || Number(activeSub.amount) >= 900;
    if (currentIsGrowth === isGrowth) {
      throw new Error(`Your company already has an active subscription to ${targetPlanName}.`);
    }
    // Plan switch (e.g. Starter -> Growth or Growth -> Starter) is permitted to initialize
  }

  // Ensure Razorpay plan is registered
  const rzpPlan = await ensurePlan(isGrowth ? 'GROWTH' : 'STARTER');
  const planId = rzpPlan.id;

  const localPlan = await prisma.subscription_plans.findFirst({
    where: {
      OR: [
        { plan_name: targetPlanName, is_active: true },
        { plan_name: isGrowth ? 'VEXA Growth' : 'VEXA Invoice Monthly', is_active: true }
      ]
    }
  });

  const rzp = razorpay.getRazorpayInstance();

  // Create Razorpay recurring subscription
  const rzpSubscription = await rzp.subscriptions.create({
    plan_id: planId,
    total_count: 120, // up to 10 years monthly cycles
    quantity: 1,
    customer_notify: 1,
    notes: {
      business_id,
      company_id: company.company_id || company.id,
      company_name: company.business_name,
      plan_type: isGrowth ? 'GROWTH' : 'STARTER'
    }
  });

  const subId = rzpSubscription.id;

  // Record pending subscription in database
  const createdSub = await prisma.platform_subscriptions.create({
    data: {
      company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
      business_id,
      plan_id: localPlan?.id || null,
      provider: 'RAZORPAY',
      provider_subscription_id: subId,
      status: 'PENDING',
      amount: targetAmount,
      currency: 'INR',
      billing_interval: 'MONTHLY',
      mandate_status: 'INITIALIZED',
      auth_link: rzpSubscription.short_url || '',
      auto_renew: true
    }
  });

  await logAudit({
    business_id,
    user_id,
    action: 'INITIATE_SUBSCRIPTION',
    module: 'SUBSCRIPTION',
    reference_id: createdSub.id,
    new_data: { subId, plan: targetPlanName, amount: targetAmount }
  });

  return {
    subscription_id: subId,
    key_id: env.RAZORPAY_KEY_ID,
    plan_name: targetPlanName,
    amount: targetAmount,
    currency: 'INR',
    customer: {
      name: user.name || company.business_name,
      email: user.email || company.email,
      contact: (user.phone || company.phone || '').replace(/[^0-9]/g, '').slice(-10)
    }
  };
};

/**
 * Verify and reconcile subscription state directly with Razorpay
 */
const verifySubscription = async (business_id, verificationData) => {
  let subId = typeof verificationData === 'string' ? verificationData : verificationData?.subscription_id;
  const paymentId = typeof verificationData === 'object' ? verificationData?.razorpay_payment_id : null;
  const signature = typeof verificationData === 'object' ? verificationData?.razorpay_signature : null;

  // If subId is not passed in request body, resolve the latest subscription for this business automatically
  if (!subId) {
    const latestSub = await prisma.platform_subscriptions.findFirst({
      where: { business_id },
      orderBy: { created_at: 'desc' }
    });
    if (latestSub) {
      subId = latestSub.provider_subscription_id;
    }
  }

  if (!subId) {
    throw new Error('Subscription ID is required for verification.');
  }

  // Verify signature if provided by frontend checkout callback
  if (paymentId && signature) {
    const isSigValid = razorpay.verifySubscriptionSignature({
      razorpay_payment_id: paymentId,
      subscription_id: subId,
      razorpay_signature: signature
    });
    if (!isSigValid) {
      throw new Error('Invalid Razorpay subscription payment signature.');
    }
  }

  const localSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id,
      provider_subscription_id: subId
    },
    include: { businesses: true }
  });

  if (!localSub) {
    throw new Error('Subscription record not found in system');
  }

  // If this is a trial subscription (vexa_trial_*) or local simulated record, reconcile locally
  if (subId.startsWith('vexa_trial_') || localSub.mandate_status === 'TRIAL') {
    return {
      subscription: localSub,
      rzpSub: {
        id: subId,
        status: localSub.status,
        plan_name: '7-Day Free Trial',
        trial: true
      }
    };
  }

  if (!razorpay.isConfigured()) {
    throw new Error('Razorpay is not configured on the server');
  }

  // Fetch actual verified provider entity from Razorpay
  const rzp = razorpay.getRazorpayInstance();
  let rzpSub;
  try {
    rzpSub = await rzp.subscriptions.fetch(subId);
  } catch (fetchErr) {
    console.warn(`[RAZORPAY SYNC] Could not fetch subscription ${subId} from Razorpay:`, fetchErr.message);
    return {
      subscription: localSub,
      rzpSub: null,
      message: 'Subscription record is currently in trial or pending activation.'
    };
  }
  const rzpStatus = (rzpSub?.status || '').toUpperCase();

  console.log(`[RAZORPAY SYNC] SubID: ${subId} | Status: ${rzpStatus}`);

  let newStatus = localSub.status;
  let newMandateStatus = rzpStatus || localSub.mandate_status;
  const now = new Date();

  let periodStart = rzpSub.current_start ? new Date(rzpSub.current_start * 1000) : (localSub.current_period_start || now);
  let periodEnd = rzpSub.current_end ? new Date(rzpSub.current_end * 1000) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  let nextBillingDate = rzpSub.charge_at ? new Date(rzpSub.charge_at * 1000) : periodEnd;

  if (rzpStatus === 'ACTIVE' || rzpStatus === 'AUTHENTICATED') {
    newStatus = 'ACTIVE';
    newMandateStatus = 'ACTIVE';
  } else if (rzpStatus === 'CANCELLED') {
    newStatus = 'CANCELLED';
    newMandateStatus = 'CANCELLED';
  } else if (rzpStatus === 'HALTED' || rzpStatus === 'PAUSED') {
    newStatus = 'PAST_DUE';
  } else if (rzpStatus === 'COMPLETED' || rzpStatus === 'EXPIRED') {
    newStatus = 'EXPIRED';
  }

  // Update in atomic transaction
  const updated = await prisma.$transaction(async (tx) => {
    const updatedSub = await tx.platform_subscriptions.update({
      where: { id: localSub.id },
      data: {
        status: newStatus,
        mandate_status: newMandateStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        next_billing_date: nextBillingDate,
        last_successful_payment: newStatus === 'ACTIVE' ? (localSub.last_successful_payment || now) : localSub.last_successful_payment
      }
    });

    await tx.businesses.update({
      where: { id: business_id },
      data: {
        subscription_status: newStatus,
        is_active: true
      }
    });

    if (newStatus === 'ACTIVE' && localSub.status !== 'ACTIVE') {
      const existingTx = await tx.payment_transactions.findFirst({
        where: { subscription_id: localSub.id, status: 'VERIFIED' }
      });

      if (!existingTx) {
        const paymentRef = paymentId || `RZP-${subId.slice(-8)}-INIT`;
        await tx.payment_transactions.create({
          data: {
            company_id: localSub.company_id,
            business_id: localSub.business_id,
            subscription_id: localSub.id,
            payment_type: 'MONTHLY_SUBSCRIPTION',
            payment_method: 'ONLINE',
            amount: localSub.amount,
            currency: localSub.currency,
            status: 'VERIFIED',
            provider: 'RAZORPAY',
            provider_payment_id: paymentRef,
            provider_subscription_id: subId,
            reference_number: paymentRef,
            transaction_type: 'NEW_SUBSCRIPTION',
            verified_at: now,
            verified_by: 'Razorpay Direct Verification',
            notes: 'Initial recurring subscription mandate verified and activated'
          }
        });

        const owner = await tx.users.findFirst({ where: { business_id, role: 'ADMIN' } });
        sendNewSubscriptionSuccessEmail({
          businessId: business_id,
          companyName: localSub.businesses.business_name,
          subscriberName: owner?.name || 'Business Owner',
          subscriberEmail: owner?.email || localSub.businesses.email,
          planName: PLAN_NAME,
          amount: Number(localSub.amount),
          paymentReference: paymentRef,
          startDate: periodStart,
          nextRenewalDate: nextBillingDate,
          mandateStatus: 'ACTIVE',
          subscriptionId: localSub.id
        });
      }
    }

    return updatedSub;
  });

  return {
    subscription: updated,
    rzpSub
  };
};

/**
 * Cancel subscription through Razorpay
 */
const cancelSubscription = async (business_id, user_id, reason = '') => {
  const localSub = await prisma.platform_subscriptions.findFirst({
    where: { business_id, status: { in: ['ACTIVE', 'PAST_DUE', 'PENDING'] } },
    orderBy: { created_at: 'desc' },
    include: { businesses: true }
  });

  if (!localSub) {
    throw new Error('No active subscription found to cancel');
  }

  const subId = localSub.provider_subscription_id;
  const now = new Date();
  const effectiveDate = localSub.current_period_end && localSub.current_period_end > now
    ? localSub.current_period_end
    : now;

  if (razorpay.isConfigured() && subId && !subId.startsWith('vexa_')) {
    try {
      const rzp = razorpay.getRazorpayInstance();
      await rzp.subscriptions.cancel(subId, false); // false = cancel at end of cycle
    } catch (err) {
      console.warn(`[RAZORPAY CANCEL] Cancel call returned notice for ${subId}:`, err.message);
    }
  }

  const updatedSub = await prisma.$transaction(async (tx) => {
    const updated = await tx.platform_subscriptions.update({
      where: { id: localSub.id },
      data: {
        cancel_at_period_end: true,
        cancellation_requested_at: now,
        cancelled_at: now,
        effective_cancellation_date: effectiveDate,
        auto_renew: false,
        mandate_status: 'CANCELLED'
      }
    });

    await tx.payment_transactions.create({
      data: {
        company_id: localSub.company_id,
        business_id,
        subscription_id: localSub.id,
        payment_type: 'MONTHLY_SUBSCRIPTION',
        payment_method: 'ONLINE',
        amount: 0,
        currency: localSub.currency || 'INR',
        status: 'CANCELLED',
        transaction_type: 'CANCELLATION',
        provider: 'RAZORPAY',
        provider_subscription_id: subId,
        reference_number: `CANCEL-${subId ? subId.slice(-8) : Date.now()}`,
        notes: reason ? `Subscription cancelled by admin: ${reason}` : 'Subscription cancellation requested'
      }
    });

    await logAudit({
      business_id,
      user_id,
      action: 'CANCEL_SUBSCRIPTION',
      module: 'SUBSCRIPTION',
      reference_id: localSub.id,
      new_data: { subId, reason, effectiveDate }
    });

    return updated;
  });

  return {
    subscription: updatedSub,
    effectiveDate,
    message: `Subscription will remain active until ${effectiveDate.toLocaleDateString('en-GB')}. No further recurring charges will be made.`
  };
};

/**
 * Customer Billing & Payment History
 */
const getCustomerPaymentHistory = async (business_id) => {
  const transactions = await prisma.payment_transactions.findMany({
    where: { business_id },
    orderBy: { created_at: 'desc' },
    include: {
      platform_subscriptions: {
        select: {
          id: true,
          status: true,
          billing_interval: true,
          mandate_status: true,
          current_period_end: true,
          subscription_plans: { select: { plan_name: true } }
        }
      },
      platform_licenses: {
        select: {
          id: true,
          license_key: true,
          status: true,
          duration_type: true
        }
      },
      payment_receipts: {
        select: {
          id: true,
          receipt_number: true,
          pdf_url: true,
          status: true,
          payment_date: true,
          created_at: true
        }
      }
    }
  });

  return transactions.map((t) => ({
    id: t.id,
    date: t.received_at || t.created_at,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    transaction_type: t.transaction_type || 'PAYMENT',
    payment_method: t.payment_method,
    reference_number: t.reference_number || t.provider_payment_id || t.id.slice(0, 8),
    provider: t.provider || 'RAZORPAY',
    plan_name: t.platform_subscriptions?.subscription_plans?.plan_name || (t.payment_type === 'ONE_TIME_LICENSE' ? 'Lifetime Plan' : 'Monthly Subscription'),
    receipt_number: t.payment_receipts[0]?.receipt_number || null,
    receipt_url: t.payment_receipts[0]?.pdf_url || null,
    notes: t.notes
  }));
};

/**
 * Initiate Razorpay Order for Lifetime Plan (₹59,999 One-Time)
 */
const initiateLifetimePurchase = async (business_id, user_id) => {
  if (!razorpay.isConfigured()) {
    throw new Error('Razorpay credentials are not configured on the server. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  const [company, user] = await Promise.all([
    prisma.businesses.findUnique({ where: { id: business_id } }),
    prisma.users.findUnique({ where: { id: user_id } })
  ]);

  if (!company) throw new Error('Company not found');
  if (!user) throw new Error('User not found');

  const existingLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id,
      license_type: 'ONE_TIME_LICENSE',
      status: 'ACTIVE'
    }
  });

  if (existingLicense || company.self_shopping_status === 'LIFETIME_ACTIVE') {
    throw new Error('Your company already possesses verified Lifetime Access to QR Self-Shopping & Customer Orders.');
  }

  const lifetimePlan = await prisma.subscription_plans.findFirst({
    where: { billing_type: 'ONE_TIME', is_active: true }
  });

  const totalAmount = lifetimePlan ? Number(lifetimePlan.price) : 59999.00;
  const amountInPaise = Math.round(totalAmount * 100);

  const rzp = razorpay.getRazorpayInstance();
  const rzpOrder = await rzp.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `rcpt_life_${Date.now().toString().slice(-8)}`,
    notes: {
      business_id,
      company_id: company.company_id || company.id,
      plan_type: 'LIFETIME_ONE_TIME'
    }
  });

  const orderId = rzpOrder.id;

  await prisma.$transaction(async (tx) => {
    await tx.payment_transactions.create({
      data: {
        company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
        business_id,
        payment_type: 'ONE_TIME_LICENSE',
        payment_method: 'ONLINE',
        amount: totalAmount,
        currency: 'INR',
        status: 'PENDING',
        transaction_type: 'NEW_LIFETIME_PURCHASE',
        provider: 'RAZORPAY',
        provider_order_id: orderId,
        idempotency_key: `LIFETIME-ORDER-${orderId}`,
        reference_number: orderId,
        notes: `Lifetime Add-on checkout initialized via Razorpay Order ${orderId}`
      }
    });

    await tx.businesses.update({
      where: { id: business_id },
      data: {
        self_shopping_status: 'PAYMENT_PENDING'
      }
    });
  });

  return {
    order_id: orderId,
    key_id: env.RAZORPAY_KEY_ID,
    amount: totalAmount,
    amount_in_paise: amountInPaise,
    currency: 'INR',
    customer: {
      name: user.name || company.business_name,
      email: user.email || company.email,
      contact: (user.phone || company.phone || '').replace(/[^0-9]/g, '').slice(-10)
    }
  };
};

/**
 * Verify Lifetime Razorpay Order Payment & grant LIFETIME_ACTIVE entitlement
 */
const verifyLifetimePurchase = async (business_id, verificationData) => {
  const orderId = typeof verificationData === 'string' ? verificationData : verificationData?.order_id || verificationData?.orderId;
  const paymentId = typeof verificationData === 'object' ? verificationData?.razorpay_payment_id : null;
  const signature = typeof verificationData === 'object' ? verificationData?.razorpay_signature : null;

  if (!orderId) {
    throw new Error('Order ID is required to verify payment.');
  }

  // Verify payment signature
  if (paymentId && signature) {
    const isSigValid = razorpay.verifyPaymentSignature({
      order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    });
    if (!isSigValid) {
      throw new Error('Invalid Razorpay payment signature.');
    }
  }

  const company = await prisma.businesses.findUnique({ where: { id: business_id } });
  if (!company) throw new Error('Company not found');

  const rzp = razorpay.getRazorpayInstance();
  const rzpOrder = await rzp.orders.fetch(orderId);
  const isPaid = (rzpOrder.status || '').toUpperCase() === 'PAID';

  if (!isPaid) {
    throw new Error(`Razorpay order is currently ${rzpOrder.status}. Payment has not been captured yet.`);
  }

  const now = new Date();
  const paidAmount = Number(rzpOrder.amount_paid || rzpOrder.amount) / 100;
  const paymentRef = paymentId || `RZP-PAY-${orderId}`;

  const result = await prisma.$transaction(async (tx) => {
    let lic = await tx.platform_licenses.findFirst({
      where: {
        business_id,
        license_type: 'ONE_TIME_LICENSE'
      }
    });

    if (!lic) {
      lic = await tx.platform_licenses.create({
        data: {
          license_key: `LIC-LIFE-${company.company_id || company.id.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`,
          company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
          business_id,
          license_type: 'ONE_TIME_LICENSE',
          status: 'ACTIVE',
          duration_type: 'LIFETIME',
          activated_at: now,
          expiry_date: null
        }
      });
    } else {
      await tx.platform_licenses.update({
        where: { id: lic.id },
        data: { status: 'ACTIVE', activated_at: lic.activated_at || now, expiry_date: null }
      });
    }

    await tx.businesses.update({
      where: { id: business_id },
      data: {
        self_shopping_status: 'LIFETIME_ACTIVE',
        is_active: true
      }
    });

    const txRecord = await tx.payment_transactions.findFirst({
      where: { provider_order_id: orderId }
    });

    if (txRecord) {
      await tx.payment_transactions.update({
        where: { id: txRecord.id },
        data: {
          status: 'VERIFIED',
          provider: 'RAZORPAY',
          provider_payment_id: paymentRef,
          license_id: lic.id,
          verified_at: now,
          verified_by: 'Razorpay Direct Order Verification',
          notes: `Lifetime access verified via payment ${paymentRef}`
        }
      });

      await tx.payment_receipts.create({
        data: {
          company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
          business_id,
          transaction_id: txRecord.id,
          receipt_number: `RCP-LIFE-${Date.now().toString().slice(-8)}`,
          amount: paidAmount,
          currency: 'INR',
          customer_name: company.business_name || 'Business Owner',
          payment_method: 'ONLINE',
          provider: 'RAZORPAY',
          provider_reference: paymentRef,
          status: 'PAID',
          issued_at: now,
          notes: 'Official Lifetime Plan Invoice (Core SaaS + Online Store)'
        }
      });
    }

    return { lic, isPaid: true };
  });

  return {
    success: true,
    message: 'Lifetime Plan unlocked! Permanent access to all core billing modules and Custom Online Shop Store granted.',
    entitlement: 'LIFETIME_ACTIVE',
    license: result.lic
  };
};

module.exports = {
  getActivePlans,
  ensurePlan,
  getCompanySubscriptionStatus,
  initiateSubscription,
  verifySubscription,
  cancelSubscription,
  getCustomerPaymentHistory,
  initiateLifetimePurchase,
  verifyLifetimePurchase
};
