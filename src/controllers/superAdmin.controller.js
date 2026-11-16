const superAdminService = require('../services/superAdmin.service');
const { sendSuccess, sendError } = require('../utils/response.util');

const sendOtp = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await superAdminService.sendSuperAdminOtp(email, password);
    return sendSuccess(res, 'Verification OTP sent successfully', result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await superAdminService.verifySuperAdminOtp(email, otp);
    return sendSuccess(res, 'Super Admin authenticated successfully', result);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 'Super Admin profile retrieved', { admin: req.superAdmin });
  } catch (error) {
    next(error);
  }
};

const getDashboardMetrics = async (req, res, next) => {
  try {
    const data = await superAdminService.getDashboardMetrics();
    return sendSuccess(res, 'Dashboard metrics retrieved', data);
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const { page, limit, search, status, subscription_status } = req.query;
    const result = await superAdminService.getCompanies({ page, limit, search, status, subscription_status });
    return sendSuccess(res, 'Companies retrieved', result.items, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const data = await superAdminService.getCompanyById(req.params.id);
    return sendSuccess(res, 'Company details retrieved', data);
  } catch (error) {
    next(error);
  }
};

const toggleCompanyStatus = async (req, res, next) => {
  try {
    const { is_active, reason } = req.body;
    if (typeof is_active !== 'boolean') {
      return sendError(res, 'is_active boolean required', 400);
    }
    const updated = await superAdminService.toggleCompanyStatus(req.params.id, is_active, reason, req.superAdmin);
    return sendSuccess(res, `Company ${is_active ? 'reactivated' : 'suspended'} successfully`, updated);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { page, limit, search, role, company_id, status } = req.query;
    const result = await superAdminService.getUsers({ page, limit, search, role, company_id, status });
    return sendSuccess(res, 'Users retrieved', result.items, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { is_active, reason } = req.body;
    if (typeof is_active !== 'boolean') {
      return sendError(res, 'is_active boolean required', 400);
    }
    const updated = await superAdminService.toggleUserStatus(req.params.id, is_active, reason, req.superAdmin);
    return sendSuccess(res, `User ${is_active ? 'activated' : 'deactivated'} successfully`, updated);
  } catch (error) {
    next(error);
  }
};

const getSubscriptions = async (req, res, next) => {
  try {
    const { page, limit, search, status, plan_id } = req.query;
    const result = await superAdminService.getSubscriptions({ page, limit, search, status, plan_id });
    return sendSuccess(res, 'Subscriptions retrieved', result.items, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getSubscriptionById = async (req, res, next) => {
  try {
    const data = await superAdminService.getSubscriptionById(req.params.id);
    return sendSuccess(res, 'Subscription details retrieved', data);
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const { page, limit, search, status, payment_type, transaction_type } = req.query;
    const result = await superAdminService.getPayments({ page, limit, search, status, payment_type, transaction_type });
    return sendSuccess(res, 'Payment transactions retrieved', {
      transactions: result.items,
      verified_total_amount: result.verified_total_amount
    }, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const { days } = req.query;
    const data = await superAdminService.getAnalytics(days);
    return sendSuccess(res, 'Analytics retrieved', data);
  } catch (error) {
    next(error);
  }
};

const getNotificationsAndLogs = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await superAdminService.getPlatformNotificationsAndLogs({ page, limit });
    return sendSuccess(res, 'Notifications and logs retrieved', {
      audit_logs: result.audit_logs,
      recent_events: result.recent_events
    }, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const data = await superAdminService.getPlatformSettings();
    return sendSuccess(res, 'Platform settings retrieved', data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  getMe,
  getDashboardMetrics,
  getCompanies,
  getCompanyById,
  toggleCompanyStatus,
  getUsers,
  toggleUserStatus,
  getSubscriptions,
  getSubscriptionById,
  getPayments,
  getAnalytics,
  getNotificationsAndLogs,
  getSettings
};
