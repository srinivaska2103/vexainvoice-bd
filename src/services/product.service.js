const prisma = require('../config/db');
const { logAudit } = require('./audit.service');

const getProducts = async (business_id, queryParams = {}) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    category,
    sortBy = 'name',
    sortOrder = 'asc'
  } = queryParams;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    is_active: true,
    ...(category ? { category_id: category } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const total = await prisma.products.count({ where });
  const productsList = await prisma.products.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { [sortBy === 'item_name' ? 'name' : sortBy]: sortOrder.toLowerCase() },
    include: {
      categories: true,
      brands: true,
      product_stock: true,
      product_variants: {
        include: {
          colors: true,
          sizes: true
        }
      }
    }
  });

  const { getCurrentStock } = require('./stock.service');
  const stockRes = await getCurrentStock(business_id, { limit: 1000 });
  const stockMap = new Map((stockRes.stock || []).map(s => [s.id, s]));

  const productsWithStock = productsList.map((p) => {
    const liveStockObj = stockMap.get(p.id);
    const calcStock = liveStockObj ? Number(liveStockObj.stockQuantity || 0) : Number(p.opening_stock || 0);

    const formattedVariants = (p.product_variants || []).map(v => {
      const liveV = (liveStockObj?.variants || []).find(lv => lv.id === v.id);
      const vStock = liveV ? Number(liveV.quantity || 0) : Number(v.current_stock || v.opening_stock || 0);
      return {
        ...v,
        current_stock: vStock,
        quantity: vStock
      };
    });

    return {
      ...p,
      product_variants: formattedVariants,
      variants: formattedVariants,
      stockQuantity: calcStock,
      quantity: calcStock,
      current_stock: calcStock
    };
  });

  return {
    products: productsWithStock,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

const getProductById = async (business_id, id) => {
  const product = await prisma.products.findFirst({
    where: { id, business_id },
    include: {
      categories: true,
      brands: true
    }
  });

  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }
  return product;
};

const getProductByBarcode = async (business_id, barcode) => {
  const product = await prisma.products.findFirst({
    where: { business_id, barcode }
  });
  if (!product) {
    const err = new Error(`Product with barcode '${barcode}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return product;
};

const getProductBySku = async (business_id, sku) => {
  const product = await prisma.products.findFirst({
    where: { business_id, sku }
  });
  if (!product) {
    const err = new Error(`Product with SKU '${sku}' not found`);
    err.statusCode = 404;
    throw err;
  }
  return product;
};

const {
  deriveProductCode,
  deriveSizeCode,
  getHighestSequenceFromSkus,
  formatSequence
} = require('../utils/skuGenerator.util');

const createProduct = async (business_id, user_id, data) => {
  const { variants, opening_stock, ...productData } = data;

  return await prisma.$transaction(async (tx) => {
    // Check & resolve duplicate SKU for this business
    let targetSku = data.sku && data.sku.trim();
    if (!targetSku) {
      if (data.has_variants && Array.isArray(variants) && variants.length > 0 && variants[0].sku) {
        // For variant products without custom main SKU, use the derived code or first variant's code
        targetSku = variants[0].sku;
      } else {
        const productCode = deriveProductCode(data, productData.brandName, productData.categoryName);
        targetSku = productCode || `PROD-${Date.now()}`;
      }
    }
    const skuExists = await tx.products.findFirst({
      where: { business_id, sku: targetSku }
    });
    if (skuExists) {
      targetSku = `${targetSku}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // Check barcode uniqueness if provided
    let targetBarcode = data.barcode ? data.barcode.trim() : null;
    if (targetBarcode) {
      const existingWithBarcode = await tx.products.findFirst({
        where: { business_id, barcode: targetBarcode }
      });
      if (existingWithBarcode) {
        const err = new Error(`Barcode '${targetBarcode}' is already registered with product '${existingWithBarcode.name}'.`);
        err.statusCode = 409;
        err.existingProductId = existingWithBarcode.id;
        throw err;
      }
      const existingVarWithBarcode = await tx.product_variants.findFirst({
        where: { barcode: targetBarcode, products: { business_id } },
        include: { products: true }
      });
      if (existingVarWithBarcode) {
        const err = new Error(`Barcode '${targetBarcode}' is already registered with variant of '${existingVarWithBarcode.products?.name}'.`);
        err.statusCode = 409;
        err.existingProductId = existingVarWithBarcode.product_id;
        throw err;
      }
    }

    // 1. Create main product
    const product = await tx.products.create({
      data: {
        business_id,
        name: data.name || data.item_name,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        sku: targetSku,
        barcode: data.barcode || null,
        description: data.description || null,
        unit: data.unit || 'PCS',
        hsn_code: data.hsn_code || null,
        gst_percentage: data.gst_percentage !== undefined ? data.gst_percentage : 5,
        purchase_price: data.purchase_price || 0,
        retail_price: data.retail_price || data.price || 0,
        wholesale_price: data.wholesale_price || data.retail_price || 0,
        dealer_price: data.dealer_price || 0,
        minimum_stock: data.minimum_stock || 5,
        has_variants: !!(data.has_variants && Array.isArray(variants) && variants.length > 0),
        is_active: true
      },
      include: {
        brands: true,
        categories: true
      }
    });

    if (data.has_variants && Array.isArray(variants) && variants.length > 0) {
      // Fetch size records if size_ids are provided
      const sizeIds = [...new Set(variants.map(v => v.size_id).filter(Boolean))];
      const sizeRecords = sizeIds.length > 0
        ? await tx.sizes.findMany({ where: { id: { in: sizeIds } } })
        : [];
      const sizeMap = new Map(sizeRecords.map(s => [s.id, s.name]));

      // Query any existing variants for this product to prevent sequence collision
      const existingProdVariants = await tx.product_variants.findMany({
        where: { product_id: product.id },
        select: { sku: true }
      });
      const allBusinessVariants = await tx.product_variants.findMany({
        where: { products: { business_id } },
        select: { sku: true, barcode: true }
      });
      const usedSkusInBusiness = new Set(allBusinessVariants.map(v => (v.sku || '').toUpperCase()));
      const usedBarcodesInBusiness = new Set(allBusinessVariants.map(v => (v.barcode || '').toUpperCase()));

      // In-transaction sequence counters keyed by `sizeCode`
      const sequenceCounters = new Map();

      // Product code segment: e.g. "OTTO-SHIRT"
      const productCode = deriveProductCode(product, product.brands?.name, product.categories?.name);

      for (const vData of variants) {
        const sizeName = vData.size_name || (vData.size_id ? sizeMap.get(vData.size_id) : '') || '';
        const sizeCode = deriveSizeCode(sizeName);

        // Determine next sequence for this product + size
        if (!sequenceCounters.has(sizeCode)) {
          const prefix = `${productCode}-${sizeCode}`;
          const highestSeq = getHighestSequenceFromSkus(
            existingProdVariants.map(v => v.sku),
            prefix
          );
          sequenceCounters.set(sizeCode, highestSeq);
        }

        let currentSeq = sequenceCounters.get(sizeCode);
        let finalSku = vData.sku ? vData.sku.trim().toUpperCase() : null;

        if (!finalSku) {
          // Generate PRODUCTCODE-SIZE-SEQUENCE
          do {
            currentSeq++;
            finalSku = `${productCode}-${sizeCode}-${formatSequence(currentSeq)}`;
          } while (usedSkusInBusiness.has(finalSku));
          sequenceCounters.set(sizeCode, currentSeq);
        }

        usedSkusInBusiness.add(finalSku);

        // Barcode generation: use generated SKU as barcode value if not custom provided
        let finalBarcode = vData.barcode ? vData.barcode.trim() : null;
        if (!finalBarcode) {
          finalBarcode = finalSku;
          // Ensure barcode doesn't duplicate
          let barcodeAttempt = 1;
          while (usedBarcodesInBusiness.has(finalBarcode.toUpperCase())) {
            barcodeAttempt++;
            finalBarcode = `${finalSku}-${barcodeAttempt}`;
          }
        }
        usedBarcodesInBusiness.add(finalBarcode.toUpperCase());

        const initVStock = parseFloat(vData.opening_stock || 0);
        const variant = await tx.product_variants.create({
          data: {
            product_id: product.id,
            color_id: vData.color_id || null,
            size_id: vData.size_id || null,
            variant_name: vData.variant_name || null,
            sku: finalSku,
            barcode: finalBarcode,
            purchase_price: vData.purchase_price || product.purchase_price || 0,
            retail_price: vData.retail_price || product.retail_price || 0,
            wholesale_price: vData.wholesale_price || product.wholesale_price || 0,
            dealer_price: vData.dealer_price || product.dealer_price || 0,
            opening_stock: initVStock,
            current_stock: initVStock
          }
        });

        if (initVStock > 0) {
          await tx.stock_transactions.create({
            data: {
              business_id,
              product_id: product.id,
              variant_id: variant.id,
              transaction_type: 'OPENING',
              quantity: initVStock,
              created_by: user_id || null,
              notes: 'Variant opening stock'
            }
          });
        }
      }
    } else {
      const initStock = parseFloat(opening_stock || data.openingStock || 0);
      if (initStock > 0) {
        await tx.stock_transactions.create({
          data: {
            business_id,
            product_id: product.id,
            transaction_type: 'OPENING',
            quantity: initStock,
            created_by: user_id || null,
            notes: 'Opening stock'
          }
        });
      }
    }

    await logAudit({
      business_id,
      user_id,
      action: 'PRODUCT_CREATED',
      module: 'PRODUCTS',
      reference_id: product.id,
      new_data: { name: product.name }
    }, tx);

    return await tx.products.findUnique({
      where: { id: product.id },
      include: {
        brands: true,
        categories: true,
        product_variants: {
          include: { colors: true, sizes: true }
        }
      }
    });
  });
};

const updateProduct = async (business_id, id, user_id, data) => {
  const existing = await prisma.products.findFirst({ where: { id, business_id } });
  if (!existing) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  return await prisma.products.update({
    where: { id },
    data: {
      name: data.name || existing.name,
      sku: data.sku || existing.sku,
      category_id: data.category_id !== undefined ? data.category_id : existing.category_id,
      brand_id: data.brand_id !== undefined ? data.brand_id : existing.brand_id,
      unit: data.unit || existing.unit,
      hsn_code: data.hsn_code !== undefined ? data.hsn_code : existing.hsn_code,
      purchase_price: data.purchase_price !== undefined ? data.purchase_price : existing.purchase_price,
      retail_price: data.retail_price !== undefined ? data.retail_price : existing.retail_price,
      wholesale_price: data.wholesale_price !== undefined ? data.wholesale_price : existing.wholesale_price,
      dealer_price: data.dealer_price !== undefined ? data.dealer_price : existing.dealer_price,
      minimum_stock: data.minimum_stock !== undefined ? data.minimum_stock : existing.minimum_stock
    }
  });
};

const deleteProduct = async (business_id, id, user_id) => {
  await prisma.products.updateMany({
    where: { id, business_id },
    data: { is_active: false }
  });
  return { message: 'Product deactivated successfully' };
};

const getVariantsByProductId = async (business_id, productId) => {
  const dbVariants = await prisma.product_variants.findMany({
    where: { product_id: productId },
    include: {
      colors: true,
      sizes: true
    }
  });

  return dbVariants.map(v => ({
    ...v,
    color: v.colors?.name || null,
    size: v.sizes?.name || null,
    current_stock: Number(v.current_stock || 0)
  }));
};

const resolveScannedCode = async (business_id, rawCode, userIdCtx = null, userRoleCtx = 'BILLING_STAFF') => {
  if (!rawCode || !rawCode.trim()) {
    const err = new Error('Barcode / SKU / Unique number is required');
    err.statusCode = 400;
    throw err;
  }
  const code = rawCode.trim();

  // 1. Check product_variants by barcode
  const variantByBarcode = await prisma.product_variants.findFirst({
    where: {
      barcode: code,
      products: { business_id, is_active: true }
    },
    include: {
      colors: true,
      sizes: true,
      products: {
        include: { brands: true, categories: true }
      }
    }
  });

  if (variantByBarcode) {
    const p = variantByBarcode.products;
    return {
      matchType: 'MODERN_VARIANT',
      id: variantByBarcode.id,
      productId: p.id,
      variantId: variantByBarcode.id,
      name: p.name,
      product_name: p.name,
      variant_name: variantByBarcode.variant_name,
      brand: p.brands?.name || null,
      color: variantByBarcode.colors?.name || null,
      size: variantByBarcode.sizes?.name || null,
      sku: variantByBarcode.sku || p.sku,
      barcode: variantByBarcode.barcode || p.barcode,
      unitPrice: Number(variantByBarcode.retail_price || p.retail_price || 0),
      purchasePrice: Number(variantByBarcode.purchase_price || p.purchase_price || 0),
      gstPercentage: Number(p.gst_percentage || 0),
      hsnCode: p.hsn_code || '',
      stockQuantity: Number(variantByBarcode.current_stock || 0),
      unit: p.unit || 'PCS'
    };
  }

  // 2. Check product_variants by SKU
  const variantBySku = await prisma.product_variants.findFirst({
    where: {
      sku: code,
      products: { business_id, is_active: true }
    },
    include: {
      colors: true,
      sizes: true,
      products: {
        include: { brands: true, categories: true }
      }
    }
  });

  if (variantBySku) {
    const p = variantBySku.products;
    return {
      matchType: 'MODERN_VARIANT',
      id: variantBySku.id,
      productId: p.id,
      variantId: variantBySku.id,
      name: p.name,
      product_name: p.name,
      variant_name: variantBySku.variant_name,
      brand: p.brands?.name || null,
      color: variantBySku.colors?.name || null,
      size: variantBySku.sizes?.name || null,
      sku: variantBySku.sku || p.sku,
      barcode: variantBySku.barcode || p.barcode,
      unitPrice: Number(variantBySku.retail_price || p.retail_price || 0),
      purchasePrice: Number(variantBySku.purchase_price || p.purchase_price || 0),
      gstPercentage: Number(p.gst_percentage || 0),
      hsnCode: p.hsn_code || '',
      stockQuantity: Number(variantBySku.current_stock || 0),
      unit: p.unit || 'PCS'
    };
  }

  // 3. Check products by barcode
  const productByBarcode = await prisma.products.findFirst({
    where: { business_id, barcode: code, is_active: true },
    include: { brands: true, categories: true, product_stock: true }
  });

  if (productByBarcode) {
    const stock = productByBarcode.product_stock?.[0]?.quantity || productByBarcode.minimum_stock || 0;
    return {
      matchType: 'MODERN_PRODUCT',
      id: productByBarcode.id,
      productId: productByBarcode.id,
      variantId: null,
      name: productByBarcode.name,
      product_name: productByBarcode.name,
      brand: productByBarcode.brands?.name || null,
      sku: productByBarcode.sku,
      barcode: productByBarcode.barcode,
      unitPrice: Number(productByBarcode.retail_price || 0),
      purchasePrice: Number(productByBarcode.purchase_price || 0),
      gstPercentage: Number(productByBarcode.gst_percentage || 0),
      hsnCode: productByBarcode.hsn_code || '',
      stockQuantity: Number(stock),
      unit: productByBarcode.unit || 'PCS'
    };
  }

  // 4. Check products by SKU
  const productBySku = await prisma.products.findFirst({
    where: { business_id, sku: code, is_active: true },
    include: { brands: true, categories: true, product_stock: true }
  });

  if (productBySku) {
    const stock = productBySku.product_stock?.[0]?.quantity || productBySku.minimum_stock || 0;
    return {
      matchType: 'MODERN_PRODUCT',
      id: productBySku.id,
      productId: productBySku.id,
      variantId: null,
      name: productBySku.name,
      product_name: productBySku.name,
      brand: productBySku.brands?.name || null,
      sku: productBySku.sku,
      barcode: productBySku.barcode,
      unitPrice: Number(productBySku.retail_price || 0),
      purchasePrice: Number(productBySku.purchase_price || 0),
      gstPercentage: Number(productBySku.gst_percentage || 0),
      hsnCode: productBySku.hsn_code || '',
      stockQuantity: Number(stock),
      unit: productBySku.unit || 'PCS'
    };
  }

  // 5. Legacy / Unique number lookup
  const legacyProduct = await prisma.products.findFirst({
    where: {
      business_id,
      is_active: true,
      OR: [
        { sku: { equals: code, mode: 'insensitive' } },
        { barcode: { equals: code, mode: 'insensitive' } },
        { name: { equals: code, mode: 'insensitive' } }
      ]
    },
    include: { brands: true, categories: true }
  });

  if (legacyProduct) {
    return {
      matchType: 'LEGACY',
      id: legacyProduct.id,
      productId: legacyProduct.id,
      variantId: null,
      name: legacyProduct.name,
      product_name: legacyProduct.name,
      uniqueNumber: legacyProduct.sku || legacyProduct.barcode || code,
      unitPrice: Number(legacyProduct.retail_price || 0),
      purchasePrice: Number(legacyProduct.purchase_price || 0),
      gstPercentage: Number(legacyProduct.gst_percentage || 0),
      hsnCode: legacyProduct.hsn_code || '',
      stockQuantity: 999,
      unit: legacyProduct.unit || 'PCS'
    };
  }

  // 6. Barcode not found in database: return not found structure so user can register the product
  return {
    found: false,
    matchType: 'NOT_FOUND',
    barcode: code,
    scannedCode: code,
    message: `Barcode '${code}' is not registered yet.`
  };
};

const addVariant = async (business_id, productId, user_id, varData) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify product exists and belongs to this business
    const product = await tx.products.findFirst({
      where: { id: productId, business_id },
      include: { brands: true, categories: true }
    });

    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch size record if size_id provided
    let sizeName = varData.size_name || '';
    if (!sizeName && varData.size_id) {
      const sizeRecord = await tx.sizes.findFirst({
        where: { id: varData.size_id, business_id }
      });
      if (sizeRecord) sizeName = sizeRecord.name;
    }

    const sizeCode = deriveSizeCode(sizeName);
    const productCode = deriveProductCode(product, product.brands?.name, product.categories?.name);

    // 3. Find highest existing sequence for this product and size
    const existingVariants = await tx.product_variants.findMany({
      where: { product_id: product.id },
      select: { sku: true }
    });
    const prefix = `${productCode}-${sizeCode}`;
    let highestSeq = getHighestSequenceFromSkus(existingVariants.map(v => v.sku), prefix);

    // 4. Check business uniqueness for SKU and barcode
    const allBusinessVariants = await tx.product_variants.findMany({
      where: { products: { business_id } },
      select: { sku: true, barcode: true }
    });
    const usedSkusInBusiness = new Set(allBusinessVariants.map(v => (v.sku || '').toUpperCase()));
    const usedBarcodesInBusiness = new Set(allBusinessVariants.map(v => (v.barcode || '').toUpperCase()));

    let finalSku = varData.sku ? varData.sku.trim().toUpperCase() : null;
    if (!finalSku) {
      do {
        highestSeq++;
        finalSku = `${productCode}-${sizeCode}-${formatSequence(highestSeq)}`;
      } while (usedSkusInBusiness.has(finalSku));
    }

    let finalBarcode = varData.barcode ? varData.barcode.trim() : null;
    if (!finalBarcode) {
      finalBarcode = finalSku;
      let barcodeAttempt = 1;
      while (usedBarcodesInBusiness.has(finalBarcode.toUpperCase())) {
        barcodeAttempt++;
        finalBarcode = `${finalSku}-${barcodeAttempt}`;
      }
    }

    const initStock = parseFloat(varData.opening_stock || 0);

    const variant = await tx.product_variants.create({
      data: {
        product_id: product.id,
        color_id: varData.color_id || null,
        size_id: varData.size_id || null,
        variant_name: varData.variant_name || null,
        sku: finalSku,
        barcode: finalBarcode,
        purchase_price: varData.purchase_price !== undefined ? varData.purchase_price : product.purchase_price || 0,
        retail_price: varData.retail_price !== undefined ? varData.retail_price : product.retail_price || 0,
        wholesale_price: varData.wholesale_price !== undefined ? varData.wholesale_price : product.wholesale_price || 0,
        dealer_price: varData.dealer_price !== undefined ? varData.dealer_price : product.dealer_price || 0,
        opening_stock: initStock,
        current_stock: initStock
      },
      include: {
        colors: true,
        sizes: true
      }
    });

    // Make sure product.has_variants is set to true
    if (!product.has_variants) {
      await tx.products.update({
        where: { id: product.id },
        data: { has_variants: true }
      });
    }

    if (initStock > 0) {
      await tx.stock_transactions.create({
        data: {
          business_id,
          product_id: product.id,
          variant_id: variant.id,
          transaction_type: 'OPENING',
          quantity: initStock,
          created_by: user_id || null,
          notes: 'Variant opening stock'
        }
      });
    }

    await logAudit({
      business_id,
      user_id,
      action: 'VARIANT_CREATED',
      module: 'PRODUCTS',
      reference_id: variant.id,
      new_data: { sku: variant.sku, barcode: variant.barcode }
    }, tx);

    return {
      ...variant,
      color: variant.colors?.name || null,
      size: variant.sizes?.name || null,
      current_stock: Number(variant.current_stock || 0)
    };
  });
};

module.exports = {
  getProducts,
  getProductById,
  getProductByBarcode,
  getProductBySku,
  createProduct,
  updateProduct,
  deleteProduct,
  getVariantsByProductId,
  addVariant,
  resolveScannedCode
};
