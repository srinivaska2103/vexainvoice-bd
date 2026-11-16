const supplierService = require('../services/supplier.service');
const { createSupplierSchema, updateSupplierSchema } = require('../validators/supplier.validator');
const { sendSuccess } = require('../utils/response.util');

const getSuppliers = async (req, res, next) => {
  try {
    const result = await supplierService.getSuppliers(req.user.business_id, req.query);
    return sendSuccess(res, 'Suppliers fetched', result.suppliers, 200, result.pagination);
  } catch (error) { next(error); }
};

const getSupplierById = async (req, res, next) => {
  try {
    const supplier = await supplierService.getSupplierById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Supplier details fetched', supplier);
  } catch (error) { next(error); }
};

const createSupplier = async (req, res, next) => {
  try {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await supplierService.createSupplier(req.user.business_id, data);
    return sendSuccess(res, 'Supplier created successfully', supplier, 201);
  } catch (error) { next(error); }
};

const updateSupplier = async (req, res, next) => {
  try {
    const data = updateSupplierSchema.parse(req.body);
    const supplier = await supplierService.updateSupplier(req.user.business_id, req.params.id, data);
    return sendSuccess(res, 'Supplier updated successfully', supplier);
  } catch (error) { next(error); }
};

const deleteSupplier = async (req, res, next) => {
  try {
    const result = await supplierService.deleteSupplier(req.user.business_id, req.params.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

const getLedger = async (req, res, next) => {
  try {
    const result = await supplierService.getSupplierLedger(req.user.business_id, req.params.id, req.query);
    return sendSuccess(res, 'Supplier ledger fetched', result);
  } catch (error) { next(error); }
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getLedger
};
