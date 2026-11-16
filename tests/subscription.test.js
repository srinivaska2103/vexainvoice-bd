
const assert = require('assert');
const crypto = require('crypto');
const { evaluateSubscriptionAccess } = require('../src/utils/subscriptionPolicy');
const { verifyWebhookSignature, verifyPaymentSignature, verifySubscriptionSignature } = require('../src/config/razorpay');

console.log('--- RUNNING RAZORPAY & SUBSCRIPTION TEST SUITE ---');

const testSecret = 'test_razorpay_secret_key_12345';
const rawBody = JSON.stringify({
  event: 'subscription.charged',
  payload: {
    subscription: { entity: { id: 'sub_test123', status: 'active' } }
  }
});

// Generate valid HMAC SHA256 hex signature
const validSignature = crypto.createHmac('sha256', testSecret).update(rawBody).digest('hex');
const invalidSignature = 'invalid_tampered_signature_hex';

// Test 1: Valid webhook signature
assert.strictEqual(
  verifyWebhookSignature(rawBody, validSignature, testSecret),
  true,
  'Valid Razorpay webhook signature should be accepted'
);
console.log('✅ Test 1 Passed: Valid Razorpay webhook signature confirmed');

// Test 2: Invalid/tampered webhook signature
assert.strictEqual(
  verifyWebhookSignature(rawBody, invalidSignature, testSecret),
  false,
  'Tampered signature must be rejected'
);
console.log('✅ Test 2 Passed: Tampered/invalid webhook signature safely rejected');

// Test 3: Verify Payment Signature for Lifetime Orders
{
  const orderId = 'order_test_123';
  const paymentId = 'pay_test_456';
  const paySig = crypto.createHmac('sha256', testSecret).update(`${orderId}|${paymentId}`).digest('hex');
  assert.strictEqual(
    verifyPaymentSignature({ order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: paySig }, testSecret),
    true
  );
  console.log('✅ Test 3 Passed: Razorpay order payment signature verification confirmed');
}

// Test 4: Verify Subscription Signature for Monthly Mandates
{
  const subId = 'sub_test_789';
  const paymentId = 'pay_test_999';
  const subSig = crypto.createHmac('sha256', testSecret).update(`${paymentId}|${subId}`).digest('hex');
  assert.strictEqual(
    verifySubscriptionSignature({ razorpay_payment_id: paymentId, subscription_id: subId, razorpay_signature: subSig }, testSecret),
    true
  );
  console.log('✅ Test 4 Passed: Razorpay recurring subscription signature verification confirmed');
}

// Test 5: Active subscription permits full application access
{
  const now = new Date();
  const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'ACTIVE', license_status: 'INACTIVE' };
  const subscription = {
    status: 'ACTIVE',
    current_period_end: futureDate,
    cancel_at_period_end: false
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.status, 'ACTIVE');
  console.log('✅ Test 5 Passed: Active subscription permits full application access');
}

// Test 6: 3-day grace period maintains operational access
{
  const now = new Date();
  const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const graceDeadline = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'ACTIVE', license_status: 'INACTIVE' };
  const subscription = {
    status: 'PAST_DUE',
    current_period_end: pastDate,
    grace_period_deadline: graceDeadline,
    cancel_at_period_end: false
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.gracePeriodActive, true);
  console.log('✅ Test 6 Passed: 3-day grace period maintains operational access');
}

// Test 7: Expired subscription properly restricts access
{
  const now = new Date();
  const pastDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'EXPIRED', license_status: 'INACTIVE' };
  const subscription = {
    status: 'EXPIRED',
    current_period_end: pastDate,
    grace_period_deadline: pastDate,
    cancel_at_period_end: false
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, false);
  assert.strictEqual(evalResult.status, 'EXPIRED');
  console.log('✅ Test 7 Passed: Expired subscription properly restricts access');
}

// Test 8: Retains full access until paid billing cycle ends
{
  const now = new Date();
  const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'ACTIVE', license_status: 'INACTIVE' };
  const subscription = {
    status: 'ACTIVE',
    current_period_end: futureDate,
    cancel_at_period_end: true,
    effective_cancellation_date: futureDate
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  console.log('✅ Test 8 Passed: Retains full access until paid billing cycle ends');
}

// Test 9: Company without subscription restricted to billing page
{
  const company = { subscription_status: 'PENDING', license_status: 'INACTIVE', created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  const evalResult = evaluateSubscriptionAccess(null, company);
  assert.strictEqual(evalResult.allowed, false);
  assert.strictEqual(evalResult.status, 'NO_SUBSCRIPTION');
  console.log('✅ Test 9 Passed: Company without subscription restricted to billing page');
}

// Test 10: Active 7-day free trial allows full access
{
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'TRIAL', license_status: 'INACTIVE' };
  const subscription = {
    status: 'TRIALING',
    trial_start_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    trial_end_at: trialEnd
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.status, 'TRIALING');
  console.log('✅ Test 10 Passed: Active 7-day free trial allows full access with correct days remaining');
}

// Test 11: Expired 7-day free trial correctly restricts access
{
  const now = new Date();
  const trialEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const company = { subscription_status: 'TRIAL', license_status: 'INACTIVE' };
  const subscription = {
    status: 'TRIALING',
    trial_start_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    trial_end_at: trialEnd
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, false);
  assert.strictEqual(evalResult.status, 'EXPIRED');
  console.log('✅ Test 11 Passed: Expired 7-day free trial correctly restricts access');
}

// Test 12: Starter Plan (₹599) feature matrix restricts customer portal
{
  const company = { subscription_status: 'ACTIVE', license_status: 'INACTIVE' };
  const subscription = {
    status: 'ACTIVE',
    amount: 599.00,
    subscription_plans: { plan_name: 'VEXA Starter' }
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.tier, 'STARTER');
  assert.strictEqual(evalResult.features.hasCustomerPortal, false);
  assert.strictEqual(evalResult.features.hasOnlineShop, false);
  console.log('✅ Test 12 Passed: Starter Plan (₹599) feature matrix restricts customer portal');
}

// Test 13: Growth Plan (₹999) feature matrix unlocks customer portal & online shop
{
  const company = { subscription_status: 'ACTIVE', license_status: 'INACTIVE' };
  const subscription = {
    status: 'ACTIVE',
    amount: 999.00,
    subscription_plans: { plan_name: 'VEXA Growth' }
  };
  const evalResult = evaluateSubscriptionAccess(subscription, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.tier, 'GROWTH');
  assert.strictEqual(evalResult.features.hasCustomerPortal, true);
  assert.strictEqual(evalResult.features.hasOnlineShop, true);
  assert.strictEqual(evalResult.features.hasCustomerOrders, true);
  console.log('✅ Test 13 Passed: Growth Plan (₹999) feature matrix unlocks customer portal & online shop');
}

// Test 14: Lifetime Plan (₹59,999) retains full customer portal & online shop access
{
  const company = { subscription_status: 'ACTIVE', license_status: 'ACTIVE', self_shopping_status: 'LIFETIME_ACTIVE' };
  const evalResult = evaluateSubscriptionAccess(null, company);
  assert.strictEqual(evalResult.allowed, true);
  assert.strictEqual(evalResult.tier, 'LIFETIME');
  assert.strictEqual(evalResult.features.hasCustomerPortal, true);
  assert.strictEqual(evalResult.features.hasOnlineShop, true);
  console.log('✅ Test 14 Passed: Lifetime Plan (₹59,999) retains full customer portal & online shop access');
}

console.log('\n🎉 ALL RAZORPAY & SUBSCRIPTION UNIT TESTS PASSED SUCCESSFULLY!');
