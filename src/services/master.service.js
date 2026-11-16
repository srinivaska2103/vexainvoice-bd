const prisma = require('../config/db');
const { memoryCache } = require('../utils/memoryCache.util');

// --- CATEGORIES ---
const getCategories = async (business_id) => {
  const cached = memoryCache.get(business_id, 'categories');
  if (cached) return cached;

  const categories = await prisma.categories.findMany({
    where: { business_id, is_active: true },
    orderBy: { name: 'asc' }
  });

  memoryCache.set(business_id, 'categories', categories, 10 * 60 * 1000); // 10 min TTL
  return categories;
};

const createCategory = async (business_id, data) => {
  const existing = await prisma.categories.findFirst({
    where: { business_id, name: data.name }
  });
  if (existing) {
    return existing;
  }
  const result = await prisma.categories.create({
    data: {
      business_id,
      name: data.name,
      description: data.description || null
    }
  });
  memoryCache.invalidate(business_id, 'categories');
  return result;
};

// --- BRANDS ---
const getBrands = async (business_id) => {
  const cached = memoryCache.get(business_id, 'brands');
  if (cached) return cached;

  const brands = await prisma.brands.findMany({
    where: { business_id, is_active: true },
    orderBy: { name: 'asc' }
  });

  memoryCache.set(business_id, 'brands', brands, 10 * 60 * 1000);
  return brands;
};

const createBrand = async (business_id, data) => {
  const existing = await prisma.brands.findFirst({
    where: { business_id, name: data.name }
  });
  if (existing) {
    return existing;
  }
  const result = await prisma.brands.create({
    data: {
      business_id,
      name: data.name
    }
  });
  memoryCache.invalidate(business_id, 'brands');
  return result;
};

// --- COLORS ---
const getColors = async (business_id) => {
  const cached = memoryCache.get(business_id, 'colors');
  if (cached) return cached;

  const colors = await prisma.colors.findMany({
    where: { business_id },
    orderBy: { name: 'asc' }
  });

  memoryCache.set(business_id, 'colors', colors, 10 * 60 * 1000);
  return colors;
};

const createColor = async (business_id, data) => {
  const name = data.name || data.color_name;
  const existing = await prisma.colors.findFirst({
    where: { business_id, name }
  });
  if (existing) {
    return existing;
  }
  const result = await prisma.colors.create({
    data: {
      business_id,
      name,
      hex_code: data.hex_code || data.color_code || null
    }
  });
  memoryCache.invalidate(business_id, 'colors');
  return result;
};

// --- SIZES ---
const getSizes = async (business_id) => {
  const cached = memoryCache.get(business_id, 'sizes');
  if (cached) return cached;

  const sizes = await prisma.sizes.findMany({
    where: { business_id },
    orderBy: { sort_order: 'asc' }
  });

  memoryCache.set(business_id, 'sizes', sizes, 10 * 60 * 1000);
  return sizes;
};

const createSize = async (business_id, data) => {
  const name = data.name || data.size_name;
  const existing = await prisma.sizes.findFirst({
    where: { business_id, name }
  });
  if (existing) {
    return existing;
  }
  const result = await prisma.sizes.create({
    data: {
      business_id,
      name,
      sort_order: parseInt(data.sort_order || 0, 10)
    }
  });
  memoryCache.invalidate(business_id, 'sizes');
  return result;
};

const deleteCategory = async (business_id, id) => {
  const res = await prisma.categories.deleteMany({
    where: { id, business_id }
  });
  memoryCache.invalidate(business_id, 'categories');
  return res;
};

const deleteBrand = async (business_id, id) => {
  const res = await prisma.brands.deleteMany({
    where: { id, business_id }
  });
  memoryCache.invalidate(business_id, 'brands');
  return res;
};

const deleteColor = async (business_id, id) => {
  const res = await prisma.colors.deleteMany({
    where: { id, business_id }
  });
  memoryCache.invalidate(business_id, 'colors');
  return res;
};

const deleteSize = async (business_id, id) => {
  const res = await prisma.sizes.deleteMany({
    where: { id, business_id }
  });
  memoryCache.invalidate(business_id, 'sizes');
  return res;
};

const getTaxRates = async () => {
  return [
    { id: '1', name: 'GST 0%', rate: 0 },
    { id: '2', name: 'GST 5%', rate: 5 },
    { id: '3', name: 'GST 12%', rate: 12 },
    { id: '4', name: 'GST 18%', rate: 18 },
    { id: '5', name: 'GST 28%', rate: 28 }
  ];
};

module.exports = {
  getCategories, createCategory, deleteCategory,
  getBrands, createBrand, deleteBrand,
  getColors, createColor, deleteColor,
  getSizes, createSize, deleteSize,
  getTaxRates
};
