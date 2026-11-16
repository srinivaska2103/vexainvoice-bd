const crmService = require('../services/crm.service');
const {
  createFollowupSchema,
  updateFollowupSchema,
  createCustomerNoteSchema,
  saveSegmentSchema
} = require('../validators/crm.validator');
const { sendSuccess } = require('../utils/response.util');

const getDashboardMetrics = async (req, res, next) => {
  try {
    const data = await crmService.getDashboardMetrics(req.user.business_id);
    return sendSuccess(res, 'CRM Dashboard metrics fetched', data);
  } catch (error) { next(error); }
};

const getCrmCustomers = async (req, res, next) => {
  try {
    const result = await crmService.getCrmCustomers(req.user.business_id, req.query);
    return sendSuccess(res, 'CRM Customers list fetched', result.customers, 200, result.pagination);
  } catch (error) { next(error); }
};

const getCustomer360 = async (req, res, next) => {
  try {
    const data = await crmService.getCustomer360(req.user.business_id, req.params.customerId);
    return sendSuccess(res, 'Customer 360 data fetched', data);
  } catch (error) { next(error); }
};

const getFollowups = async (req, res, next) => {
  try {
    const list = await crmService.getFollowups(req.user.business_id, req.query);
    return sendSuccess(res, 'Follow-ups list fetched', list);
  } catch (error) { next(error); }
};

const createFollowup = async (req, res, next) => {
  try {
    const validated = createFollowupSchema.parse(req.body);
    const followup = await crmService.createFollowup(req.user.business_id, req.user.id, validated);
    return sendSuccess(res, 'Follow-up created successfully', followup, 201);
  } catch (error) { next(error); }
};

const updateFollowup = async (req, res, next) => {
  try {
    const validated = updateFollowupSchema.parse(req.body);
    const updated = await crmService.updateFollowup(req.user.business_id, req.params.id, req.user.id, validated);
    return sendSuccess(res, 'Follow-up updated successfully', updated);
  } catch (error) { next(error); }
};

const deleteFollowup = async (req, res, next) => {
  try {
    const result = await crmService.deleteFollowup(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

const createCustomerNote = async (req, res, next) => {
  try {
    const validated = createCustomerNoteSchema.parse(req.body);
    const note = await crmService.createCustomerNote(req.user.business_id, req.user.id, validated);
    return sendSuccess(res, 'Customer note added successfully', note, 201);
  } catch (error) { next(error); }
};

const evaluateSegmentFilters = async (req, res, next) => {
  try {
    const customers = await crmService.evaluateSegmentFilters(req.user.business_id, req.body);
    return sendSuccess(res, 'Segment filter evaluated', customers);
  } catch (error) { next(error); }
};

const getSavedSegments = async (req, res, next) => {
  try {
    const segments = await crmService.getSavedSegments(req.user.business_id);
    return sendSuccess(res, 'Saved segments fetched', segments);
  } catch (error) { next(error); }
};

const createSavedSegment = async (req, res, next) => {
  try {
    const validated = saveSegmentSchema.parse(req.body);
    const segment = await crmService.createSavedSegment(req.user.business_id, req.user.id, validated);
    return sendSuccess(res, 'Segment saved successfully', segment, 201);
  } catch (error) { next(error); }
};

const deleteSavedSegment = async (req, res, next) => {
  try {
    const result = await crmService.deleteSavedSegment(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

const getProductInsights = async (req, res, next) => {
  try {
    const insights = await crmService.getProductInsights(req.user.business_id, req.query);
    return sendSuccess(res, 'Product insights fetched', insights);
  } catch (error) { next(error); }
};

module.exports = {
  getDashboardMetrics,
  getCrmCustomers,
  getCustomer360,
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  createCustomerNote,
  evaluateSegmentFilters,
  getSavedSegments,
  createSavedSegment,
  deleteSavedSegment,
  getProductInsights
};
