const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');

let razorpayInstance = null;

const isConfigured = () => {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
};

const getRazorpayInstance = () => {
  if (!isConfigured()) {
    throw new Error('Razorpay credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured on the server.');
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
  }
  return razorpayInstance;
};

/**
 * Verify Webhook Signature according to official Razorpay standard:
 * HMAC-SHA256 of rawBody using RAZORPAY_WEBHOOK_SECRET, hex-encoded.
 */
const verifyWebhookSignature = (rawBody, signature, secretOverride = null) => {
  const secret = secretOverride || env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  if (!signature || !rawBody) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature.length !== signature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch (err) {
    console.error('Error verifying Razorpay webhook signature:', err.message);
    return false;
  }
};

/**
 * Verify Payment Signature for Razorpay Orders (One-Time / Lifetime)
 * HMAC-SHA256 of (order_id + "|" + razorpay_payment_id) using RAZORPAY_KEY_SECRET, hex-encoded.
 */
const verifyPaymentSignature = ({ order_id, razorpay_payment_id, razorpay_signature }, secretOverride = null) => {
  if (!order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const secret = secretOverride || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const body = `${order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature.length !== razorpay_signature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );
  } catch (err) {
    console.error('Error verifying Razorpay payment signature:', err.message);
    return false;
  }
};

/**
 * Verify Subscription Signature for Razorpay Recurring Subscriptions
 * HMAC-SHA256 of (razorpay_payment_id + "|" + subscription_id) using RAZORPAY_KEY_SECRET, hex-encoded.
 */
const verifySubscriptionSignature = ({ razorpay_payment_id, subscription_id, razorpay_signature }, secretOverride = null) => {
  if (!razorpay_payment_id || !subscription_id || !razorpay_signature) return false;
  const secret = secretOverride || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const body = `${razorpay_payment_id}|${subscription_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSignature.length !== razorpay_signature.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );
  } catch (err) {
    console.error('Error verifying Razorpay subscription signature:', err.message);
    return false;
  }
};

/**
 * Ensure Razorpay recurring monthly plan exists (₹599 / month)
 */
const ensureRazorpayPlan = async ({ planId = null, amountInPaise = 59900, name = 'VEXA Invoice Monthly' } = {}) => {
  const rzp = getRazorpayInstance();

  // If specific plan_id provided in env or DB, check it
  if (planId) {
    try {
      const plan = await rzp.plans.fetch(planId);
      if (plan && plan.id) return plan;
    } catch (e) {}
  }

  // Search existing plans
  try {
    const plansList = await rzp.plans.all({ count: 20 });
    const existing = plansList.items?.find(
      p => p.item && p.item.amount === amountInPaise && p.period === 'monthly' && p.interval === 1
    );
    if (existing) {
      return existing;
    }
  } catch (e) {
    console.warn('Could not list Razorpay plans, attempting creation:', e.message);
  }

  // Create new plan
  return await rzp.plans.create({
    period: 'monthly',
    interval: 1,
    item: {
      name,
      amount: amountInPaise,
      currency: 'INR',
      description: 'Monthly SaaS recurring billing for VEXA Invoice'
    }
  });
};

module.exports = {
  isConfigured,
  getRazorpayInstance,
  verifyWebhookSignature,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  ensureRazorpayPlan
};
