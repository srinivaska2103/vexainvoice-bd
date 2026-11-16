const paymentService = require('../services/payment.service');
const { customerPaymentSchema, supplierPaymentSchema } = require('../validators/payment.validator');
const { sendSuccess } = require('../utils/response.util');

const createCustomerPayment = async (req, res, next) => {
  try {
    const data = customerPaymentSchema.parse(req.body);
    const result = await paymentService.createCustomerPayment(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Customer payment recorded successfully', result, 201);
  } catch (error) { next(error); }
};

const getCustomerPayments = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || null;
    const result = await paymentService.getCustomerPayments(req.user.business_id, customerId, req.query);
    return sendSuccess(res, 'Customer payments fetched', result.payments, 200, result.pagination);
  } catch (error) { next(error); }
};

const createSupplierPayment = async (req, res, next) => {
  try {
    const data = supplierPaymentSchema.parse(req.body);
    const result = await paymentService.createSupplierPayment(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Supplier payment recorded successfully', result, 201);
  } catch (error) { next(error); }
};

const getSupplierPayments = async (req, res, next) => {
  try {
    const supplierId = req.params.supplierId || null;
    const result = await paymentService.getSupplierPayments(req.user.business_id, supplierId, req.query);
    return sendSuccess(res, 'Supplier payments fetched', result.payments, 200, result.pagination);
  } catch (error) { next(error); }
};

module.exports = {
  createCustomerPayment,
  getCustomerPayments,
  createSupplierPayment,
  getSupplierPayments
};
