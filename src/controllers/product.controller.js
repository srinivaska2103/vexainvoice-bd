const productService = require('../services/product.service');
const { createProductSchema, updateProductSchema, productVariantSchema } = require('../validators/product.validator');
const { sendSuccess } = require('../utils/response.util');

const getProducts = async (req, res, next) => {
  try {
    const result = await productService.getProducts(req.user.business_id, req.query);
    return sendSuccess(res, 'Products fetched', result.products, 200, result.pagination);
  } catch (error) { next(error); }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Product fetched', product);
  } catch (error) { next(error); }
};

const getProductByBarcode = async (req, res, next) => {
  try {
    const result = await productService.getProductByBarcode(req.user.business_id, req.params.barcode);
    return sendSuccess(res, 'Product fetched by barcode', result);
  } catch (error) { next(error); }
};

const getProductBySku = async (req, res, next) => {
  try {
    const result = await productService.getProductBySku(req.user.business_id, req.params.sku);
    return sendSuccess(res, 'Product fetched by SKU', result);
  } catch (error) { next(error); }
};

const createProduct = async (req, res, next) => {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await productService.createProduct(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Product created successfully', product, 201);
  } catch (error) { next(error); }
};

const updateProduct = async (req, res, next) => {
  try {
    const data = updateProductSchema.parse(req.body);
    const product = await productService.updateProduct(req.user.business_id, req.params.id, req.user.id, data);
    return sendSuccess(res, 'Product updated successfully', product);
  } catch (error) { next(error); }
};

const deleteProduct = async (req, res, next) => {
  try {
    const result = await productService.deleteProduct(req.user.business_id, req.params.id, req.user.id);
    return sendSuccess(res, result.message);
  } catch (error) { next(error); }
};

// Variants
const getVariants = async (req, res, next) => {
  try {
    const variants = await productService.getVariantsByProductId(req.user.business_id, req.params.productId);
    return sendSuccess(res, 'Product variants fetched', variants);
  } catch (error) { next(error); }
};

const addVariant = async (req, res, next) => {
  try {
    const varData = productVariantSchema.parse(req.body);
    const variant = await productService.addVariant(req.user.business_id, req.params.productId, req.user.id, varData);
    return sendSuccess(res, 'Variant added successfully', variant, 201);
  } catch (error) { next(error); }
};

const scanProduct = async (req, res, next) => {
  try {
    const allowedRoles = ['ADMIN', 'MANAGER', 'STOCK_STAFF', 'BILLING_STAFF'];
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      const err = new Error('Access denied. Scanner module is restricted to authorized company staff.');
      err.statusCode = 403;
      throw err;
    }

    const item = await productService.resolveScannedCode(
      req.user.business_id, 
      req.params.code, 
      req.user.id, 
      req.user.role
    );
    return sendSuccess(res, 'Product resolved from scan', item);
  } catch (error) { next(error); }
};

module.exports = {
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBySku,
  scanProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getVariants,
  addVariant
};
