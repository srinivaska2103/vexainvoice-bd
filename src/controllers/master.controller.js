const masterService = require('../services/master.service');
const { categorySchema, brandSchema, colorSchema, sizeSchema } = require('../validators/master.validator');
const { sendSuccess } = require('../utils/response.util');

// Categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await masterService.getCategories(req.user.business_id);
    return sendSuccess(res, 'Categories fetched', categories);
  } catch (error) { next(error); }
};

const createCategory = async (req, res, next) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await masterService.createCategory(req.user.business_id, data);
    return sendSuccess(res, 'Category created', category, 201);
  } catch (error) { next(error); }
};

// Brands
const getBrands = async (req, res, next) => {
  try {
    const brands = await masterService.getBrands(req.user.business_id);
    return sendSuccess(res, 'Brands fetched', brands);
  } catch (error) { next(error); }
};

const createBrand = async (req, res, next) => {
  try {
    const data = brandSchema.parse(req.body);
    const brand = await masterService.createBrand(req.user.business_id, data);
    return sendSuccess(res, 'Brand created', brand, 201);
  } catch (error) { next(error); }
};

// Colors
const getColors = async (req, res, next) => {
  try {
    const colors = await masterService.getColors(req.user.business_id);
    return sendSuccess(res, 'Colors fetched', colors);
  } catch (error) { next(error); }
};

const createColor = async (req, res, next) => {
  try {
    const data = colorSchema.parse(req.body);
    const color = await masterService.createColor(req.user.business_id, data);
    return sendSuccess(res, 'Color created', color, 201);
  } catch (error) { next(error); }
};

// Sizes
const getSizes = async (req, res, next) => {
  try {
    const sizes = await masterService.getSizes(req.user.business_id);
    return sendSuccess(res, 'Sizes fetched', sizes);
  } catch (error) { next(error); }
};

const createSize = async (req, res, next) => {
  try {
    const data = sizeSchema.parse(req.body);
    const size = await masterService.createSize(req.user.business_id, data);
    return sendSuccess(res, 'Size created', size, 201);
  } catch (error) { next(error); }
};

const deleteCategory = async (req, res, next) => {
  try {
    await masterService.deleteCategory(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Category deleted');
  } catch (error) { next(error); }
};

const deleteBrand = async (req, res, next) => {
  try {
    await masterService.deleteBrand(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Brand deleted');
  } catch (error) { next(error); }
};

const deleteColor = async (req, res, next) => {
  try {
    await masterService.deleteColor(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Color deleted');
  } catch (error) { next(error); }
};

const deleteSize = async (req, res, next) => {
  try {
    await masterService.deleteSize(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Size deleted');
  } catch (error) { next(error); }
};

module.exports = {
  getCategories, createCategory, deleteCategory,
  getBrands, createBrand, deleteBrand,
  getColors, createColor, deleteColor,
  getSizes, createSize, deleteSize
};
