const customerService = require('../services/customer.service');
const { createCustomerSchema, updateCustomerSchema } = require('../validators/customer.validator');
const { sendSuccess } = require('../utils/response.util');

const getCustomers = async (req, res, next) => {
  try {
    const result = await customerService.getCustomers(req.user.business_id, req.query);
    return sendSuccess(res, 'Customers fetched', result.customers, 200, result.pagination);
  } catch (error) { next(error); }
};

const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerService.getCustomerById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Customer details fetched', customer);
  } catch (error) { next(error); }
};

const createCustomer = async (req, res, next) => {
  try {
    const data = createCustomerSchema.parse(req.body);
    const customer = await customerService.createCustomer(req.user.business_id, data);
    return sendSuccess(res, 'Customer created successfully', customer, 201);
  } catch (error) { next(error); }
};

const updateCustomer = async (req, res, next) => {
  try {
    const data = updateCustomerSchema.parse(req.body);
    const customer = await customerService.updateCustomer(req.user.business_id, req.params.id, data);
    return sendSuccess(res, 'Customer updated successfully', customer);
  } catch (error) { next(error); }
};

const deleteCustomer = async (req, res, next) => {
  try {
    const result = await customerService.deleteCustomer(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

const getLedger = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerLedger(req.user.business_id, req.params.id, req.query);
    return sendSuccess(res, 'Customer ledger fetched', result);
  } catch (error) { next(error); }
};

const getOutstanding = async (req, res, next) => {
  try {
    const result = await customerService.getCustomerOutstanding(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Customer outstanding fetched', result);
  } catch (error) { next(error); }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getLedger,
  getOutstanding
};
