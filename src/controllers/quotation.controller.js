const quotationService = require('../services/quotation.service');
const { createQuotationSchema, updateQuotationSchema, updateStatusSchema } = require('../validators/quotation.validator');
const { sendSuccess } = require('../utils/response.util');

const getQuotations = async (req, res, next) => {
  try {
    const result = await quotationService.getQuotations(req.user.business_id, req.query);
    return sendSuccess(res, 'Quotations fetched', result.quotations, 200, result.pagination);
  } catch (error) { next(error); }
};

const getQuotationMetrics = async (req, res, next) => {
  try {
    const metrics = await quotationService.getQuotationMetrics(req.user.business_id);
    return sendSuccess(res, 'Quotation metrics fetched', metrics);
  } catch (error) { next(error); }
};

const getQuotationById = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Quotation details fetched', quotation);
  } catch (error) { next(error); }
};

const createQuotation = async (req, res, next) => {
  try {
    const data = createQuotationSchema.parse(req.body);
    const quotation = await quotationService.createQuotation(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Quotation created successfully', quotation, 201);
  } catch (error) { next(error); }
};

const updateQuotation = async (req, res, next) => {
  try {
    const data = updateQuotationSchema.parse(req.body);
    const quotation = await quotationService.updateQuotation(req.user.business_id, req.params.id, req.user.id, data);
    return sendSuccess(res, 'Quotation updated successfully', quotation);
  } catch (error) { next(error); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const quotation = await quotationService.updateQuotationStatus(req.user.business_id, req.params.id, req.user.id, status);
    return sendSuccess(res, `Quotation status updated to ${status}`, quotation);
  } catch (error) { next(error); }
};

const convertToSale = async (req, res, next) => {
  try {
    const sale = await quotationService.convertToSale(req.user.business_id, req.params.id, req.user.id);
    return sendSuccess(res, 'Quotation converted to sale successfully', sale);
  } catch (error) { next(error); }
};

const deleteQuotation = async (req, res, next) => {
  try {
    const result = await quotationService.deleteQuotation(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

module.exports = {
  getQuotations,
  getQuotationMetrics,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateStatus,
  convertToSale,
  deleteQuotation
};
