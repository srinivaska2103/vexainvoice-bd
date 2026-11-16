const salesEnquiryService = require('../services/salesEnquiry.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * Public/Client: Submit Lifetime Plan Contact Sales Enquiry
 */
const submitEnquiry = async (req, res, next) => {
  try {
    const payload = req.body;
    // Authenticated user context if logged in (from auth middleware or optional token)
    const authenticatedContext = req.user || null;

    const result = await salesEnquiryService.createSalesEnquiry(payload, authenticatedContext);
    return sendSuccess(res, result.message, result);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

/**
 * Super Admin: Get all Lifetime Sales Enquiries
 */
const getSuperAdminEnquiries = async (req, res, next) => {
  try {
    const result = await salesEnquiryService.getSuperAdminEnquiries(req.query);
    return sendSuccess(res, 'Sales enquiries retrieved successfully', result);
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * Super Admin: Get Enquiry Details by ID
 */
const getEnquiryDetails = async (req, res, next) => {
  try {
    const result = await salesEnquiryService.getEnquiryDetails(req.params.id);
    return sendSuccess(res, 'Enquiry details retrieved successfully', result);
  } catch (err) {
    return sendError(res, err.message, 404);
  }
};

/**
 * Super Admin: Update Status, Notes, Follow-up
 */
const updateEnquiry = async (req, res, next) => {
  try {
    const result = await salesEnquiryService.updateEnquiryStatusAndNotes(req.params.id, req.body, req.superAdmin);
    return sendSuccess(res, 'Enquiry updated successfully', result);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

/**
 * Super Admin: Create Razorpay Lifetime Order for Enquiry
 */
const createLifetimePayment = async (req, res, next) => {
  try {
    const result = await salesEnquiryService.createLifetimePaymentForEnquiry(req.params.id, req.superAdmin);
    return sendSuccess(res, 'Lifetime order created successfully', result);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

/**
 * Super Admin or Client: Verify Lifetime Payment for Enquiry
 */
const verifyLifetimePayment = async (req, res, next) => {
  try {
    const result = await salesEnquiryService.verifyEnquiryLifetimePayment(req.params.id, req.body);
    return sendSuccess(res, 'Lifetime payment verified successfully', result);
  } catch (err) {
    return sendError(res, err.message, 400);
  }
};

module.exports = {
  submitEnquiry,
  getSuperAdminEnquiries,
  getEnquiryDetails,
  updateEnquiry,
  createLifetimePayment,
  verifyLifetimePayment
};
