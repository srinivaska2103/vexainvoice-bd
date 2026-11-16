const reportService = require('../services/report.service');
const { sendSuccess } = require('../utils/response.util');

const getDashboard = async (req, res, next) => {
  try {
    const data = await reportService.getDashboardData(req.user.business_id);
    return sendSuccess(res, 'Dashboard metrics fetched', data);
  } catch (error) { next(error); }
};

const getSalesReport = async (req, res, next) => {
  try {
    const data = await reportService.getSalesReport(req.user.business_id, req.query);
    return sendSuccess(res, 'Sales report fetched', data);
  } catch (error) { next(error); }
};

const getPurchaseReport = async (req, res, next) => {
  try {
    const data = await reportService.getPurchaseReport(req.user.business_id, req.query);
    return sendSuccess(res, 'Purchase report fetched', data);
  } catch (error) { next(error); }
};

const getStockValuationReport = async (req, res, next) => {
  try {
    const data = await reportService.getStockValuationReport(req.user.business_id);
    return sendSuccess(res, 'Stock valuation report fetched', data);
  } catch (error) { next(error); }
};

const getCustomersOutstandingReport = async (req, res, next) => {
  try {
    const data = await reportService.getCustomersOutstandingReport(req.user.business_id);
    return sendSuccess(res, 'Customer outstanding report fetched', data);
  } catch (error) { next(error); }
};

const getSuppliersOutstandingReport = async (req, res, next) => {
  try {
    const data = await reportService.getSuppliersOutstandingReport(req.user.business_id);
    return sendSuccess(res, 'Supplier outstanding report fetched', data);
  } catch (error) { next(error); }
};

module.exports = {
  getDashboard,
  getSalesReport,
  getPurchaseReport,
  getStockValuationReport,
  getCustomersOutstandingReport,
  getSuppliersOutstandingReport
};
