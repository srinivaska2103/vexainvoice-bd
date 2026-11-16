const subscriptionService = require('../services/subscription.service');
const { sendSuccess, sendError } = require('../utils/response.util');

const getActivePlans = async (req, res, next) => {
  try {
    const plans = await subscriptionService.getActivePlans();
    return sendSuccess(res, 'Active plans retrieved successfully', plans);
  } catch (err) {
    next(err);
  }
};

const getCompanySubscriptionStatus = async (req, res, next) => {
  try {
    const status = await subscriptionService.getCompanySubscriptionStatus(req.user.business_id);
    return sendSuccess(res, 'Subscription status retrieved successfully', status);
  } catch (err) {
    next(err);
  }
};

const initiateSubscription = async (req, res, next) => {
  try {
    const { plan, plan_type } = req.body || {};
    const requestedPlan = plan || plan_type || 'STARTER';
    const result = await subscriptionService.initiateSubscription(req.user.business_id, req.user.id, requestedPlan);
    return sendSuccess(res, 'Razorpay subscription session initialized', result);
  } catch (err) {
    next(err);
  }
};

const verifySubscription = async (req, res, next) => {
  try {
    const result = await subscriptionService.verifySubscription(req.user.business_id, req.body || req.query);
    return sendSuccess(res, 'Subscription verified successfully with Razorpay', result);
  } catch (err) {
    next(err);
  }
};

const cancelSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body || {};
    const result = await subscriptionService.cancelSubscription(req.user.business_id, req.user.id, reason);
    return sendSuccess(res, 'Subscription cancellation processed', result);
  } catch (err) {
    next(err);
  }
};

const getCustomerPaymentHistory = async (req, res, next) => {
  try {
    const history = await subscriptionService.getCustomerPaymentHistory(req.user.business_id);
    return sendSuccess(res, 'Payment history retrieved successfully', history);
  } catch (err) {
    next(err);
  }
};

const initiateLifetimePurchase = async (req, res, next) => {
  try {
    const result = await subscriptionService.initiateLifetimePurchase(req.user.business_id, req.user.id);
    return sendSuccess(res, 'Lifetime purchase order initialized successfully', result);
  } catch (err) {
    next(err);
  }
};

const verifyLifetimePurchase = async (req, res, next) => {
  try {
    const result = await subscriptionService.verifyLifetimePurchase(req.user.business_id, req.body || req.query);
    return sendSuccess(res, result.message || 'Lifetime access verified', result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getActivePlans,
  getCompanySubscriptionStatus,
  initiateSubscription,
  verifySubscription,
  cancelSubscription,
  getCustomerPaymentHistory,
  initiateLifetimePurchase,
  verifyLifetimePurchase
};
