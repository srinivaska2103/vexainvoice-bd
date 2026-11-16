const customerOrderService = require('../services/customerOrder.service');
const { sendSuccess, sendError } = require('../utils/response.util');

// GET /api/customer-orders (ADMIN only)
const getCustomerOrders = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const result = await customerOrderService.getCustomerOrders(businessId, req.query);
    return sendSuccess(res, 'Customer orders fetched successfully', result.orders, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

// GET /api/customer-orders/:id (ADMIN only)
const getCustomerOrderById = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const order = await customerOrderService.getCustomerOrderById(businessId, req.params.id);
    return sendSuccess(res, 'Customer order details fetched', order);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/customer-orders/:id/status (ADMIN only)
const updateCustomerOrderStatus = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const updated = await customerOrderService.updateCustomerOrderStatus(businessId, req.params.id, userId, req.body);
    return sendSuccess(res, 'Customer order status updated successfully', updated);
  } catch (error) {
    next(error);
  }
};

// POST /api/customer-orders/:id/link-sale (ADMIN only)
const linkSaleToOrder = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { saleId } = req.body;

    if (!saleId) {
      return sendError(res, 'Sale ID is required to mark order as billed.', 400);
    }

    const updated = await customerOrderService.markCustomerOrderAsBilled(businessId, req.params.id, saleId, userId);
    return sendSuccess(res, 'Customer order marked as billed and linked to invoice', updated);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerOrders,
  getCustomerOrderById,
  updateCustomerOrderStatus,
  linkSaleToOrder
};
