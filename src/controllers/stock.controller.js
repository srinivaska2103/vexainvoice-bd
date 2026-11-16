const stockService = require('../services/stock.service');
const { stockAdjustmentSchema } = require('../validators/stock.validator');
const { sendSuccess } = require('../utils/response.util');

const getCurrentStock = async (req, res, next) => {
  try {
    const result = await stockService.getCurrentStock(req.user.business_id, req.query);
    return sendSuccess(res, 'Current stock fetched', result.stock, 200, result.pagination);
  } catch (error) { next(error); }
};

const getStockByProductId = async (req, res, next) => {
  try {
    const stock = await stockService.getStockByProductId(req.user.business_id, req.params.productId);
    return sendSuccess(res, 'Product stock details fetched', stock);
  } catch (error) { next(error); }
};

const getLowStock = async (req, res, next) => {
  try {
    const items = await stockService.getLowStock(req.user.business_id);
    return sendSuccess(res, 'Low stock items fetched', items);
  } catch (error) { next(error); }
};

const getOutOfStock = async (req, res, next) => {
  try {
    const items = await stockService.getOutOfStock(req.user.business_id);
    return sendSuccess(res, 'Out of stock items fetched', items);
  } catch (error) { next(error); }
};

const getTransactions = async (req, res, next) => {
  try {
    const result = await stockService.getTransactions(req.user.business_id, req.query);
    return sendSuccess(res, 'Stock transactions fetched', result.transactions, 200, result.pagination);
  } catch (error) { next(error); }
};

const adjustStock = async (req, res, next) => {
  try {
    const rawBody = req.body || {};
    const normalizedPayload = {
      product_id: rawBody.product_id || rawBody.productId,
      productId: rawBody.productId || rawBody.product_id,
      variant_id: rawBody.variant_id || rawBody.variantId || null,
      transaction_type: rawBody.transaction_type || rawBody.type,
      type: rawBody.type || rawBody.transaction_type,
      quantity: rawBody.quantity !== undefined ? Number(rawBody.quantity) : (rawBody.quantity_change !== undefined ? Number(rawBody.quantity_change) : 0),
      notes: rawBody.notes || rawBody.reason || 'Manual Adjustment',
      reason: rawBody.reason || rawBody.notes || 'Manual Adjustment'
    };
    const data = stockAdjustmentSchema.parse(normalizedPayload);
    const result = await stockService.adjustStock(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Stock adjusted successfully', result, 201);
  } catch (error) { next(error); }
};

module.exports = {
  getCurrentStock,
  getStockByProductId,
  getLowStock,
  getOutOfStock,
  getTransactions,
  adjustStock
};
