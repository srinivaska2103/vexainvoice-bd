const prisma = require('../config/db');

const getCurrentStock = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 100, search = '' } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    is_active: true,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const total = await prisma.products.count({ where });
  const products = await prisma.products.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { updated_at: 'desc' },
    include: {
      categories: true,
      brands: true,
      product_variants: {
        include: {
          colors: true,
          sizes: true
        }
      },
      product_stock: true
    }
  });

  // Batch query all relevant stock_transactions for this page's products in one single query (eliminating N+1)
  const productIds = products.map(p => p.id);
  const allPageTransactions = productIds.length > 0 ? await prisma.stock_transactions.findMany({
    where: {
      business_id,
      product_id: { in: productIds }
    },
    select: {
      product_id: true,
      variant_id: true,
      transaction_type: true,
      quantity: true
    }
  }) : [];

  // Group transactions in memory for O(1) lookup
  const txByProduct = new Map();
  const txByVariant = new Map();
  const hasOpeningByProd = new Set();
  const hasOpeningByVar = new Set();
  const unassignedTxByProd = new Map();

  for (const tx of allPageTransactions) {
    const qty = Number(tx.quantity || 0);

    // Track total product-level sum
    txByProduct.set(tx.product_id, (txByProduct.get(tx.product_id) || 0) + qty);

    if (tx.transaction_type === 'OPENING') {
      hasOpeningByProd.add(tx.product_id);
      if (tx.variant_id) hasOpeningByVar.add(tx.variant_id);
    }

    if (tx.variant_id) {
      txByVariant.set(tx.variant_id, (txByVariant.get(tx.variant_id) || 0) + qty);
    } else {
      unassignedTxByProd.set(tx.product_id, (unassignedTxByProd.get(tx.product_id) || 0) + qty);
    }
  }

  // Calculate real stock per product in memory
  const stockList = products.map((p) => {
    const hasOpeningTx = hasOpeningByProd.has(p.id);
    const hasVariants = Array.isArray(p.product_variants) && p.product_variants.length > 0;

    // Calculate individual variant stock levels
    const formattedVariants = (p.product_variants || []).map((v, idx) => {
      const vTxQty = txByVariant.get(v.id) || 0;
      const nullTxQty = idx === 0 ? (unassignedTxByProd.get(p.id) || 0) : 0;
      const initVStock = Number(v.opening_stock || 0);
      const hasVOpeningTx = hasOpeningByVar.has(v.id);

      const varStock = (hasVOpeningTx || hasOpeningTx)
        ? (vTxQty + nullTxQty)
        : (initVStock + vTxQty + nullTxQty);

      return {
        id: v.id,
        productId: p.id,
        sku: v.sku || p.sku || 'N/A',
        barcode: v.barcode || p.barcode || '',
        color: v.colors?.name || v.color || '',
        size: v.sizes?.name || v.size || '',
        quantity: varStock,
        stockQuantity: varStock,
        current_stock: varStock,
        retail_price: Number(v.retail_price || p.retail_price || 0),
        wholesale_price: Number(v.wholesale_price || p.wholesale_price || 0)
      };
    });

    let realStock = 0;
    if (hasVariants) {
      realStock = formattedVariants.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
    } else {
      const txQty = txByProduct.get(p.id) || 0;
      const initPStock = Number(p.opening_stock || 0);
      realStock = hasOpeningTx ? txQty : (initPStock + txQty);
    }

    return {
      id: p.id,
      name: p.name,
      brand: p.brands?.name || p.brand || '',
      brand_name: p.brands?.name || p.brand || '',
      sku: p.sku || 'N/A',
      barcode: p.barcode || '',
      unit: p.unit || 'PCS',
      stockQuantity: realStock,
      quantity: realStock,
      lowStockWarning: Number(p.minimum_stock || 5),
      category: p.categories ? { id: p.categories.id, name: p.categories.name } : null,
      variants: formattedVariants,
      product_variants: formattedVariants
    };
  });

  return {
    stock: stockList,
    data: stockList,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const getStockByProductId = async (business_id, productId) => {
  const variants = await prisma.product_variants.findMany({
    where: { product_id: productId }
  });

  if (variants.length > 0) {
    return variants.map(v => ({
      id: v.id,
      product_id: v.product_id,
      quantity: Number(v.current_stock || 0)
    }));
  }

  // Calculate from stock_transactions aggregate
  const agg = await prisma.stock_transactions.aggregate({
    where: { business_id, product_id: productId },
    _sum: { quantity: true }
  });
  const qty = Number(agg._sum?.quantity || 0);

  return [{
    id: productId,
    product_id: productId,
    quantity: qty
  }];
};

const getLowStock = async (business_id) => {
  const stockRes = await getCurrentStock(business_id, { limit: 500 });
  return stockRes.stock.filter(s => s.quantity <= s.lowStockWarning);
};

const getOutOfStock = async (business_id) => {
  const stockRes = await getCurrentStock(business_id, { limit: 500 });
  return stockRes.stock.filter(s => s.quantity === 0);
};

const getTransactions = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 50, product_id, transaction_type, search = '' } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(product_id ? { product_id } : {}),
    ...(transaction_type ? { transaction_type } : {}),
    ...(search ? {
      OR: [
        { reference_number: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { products: { name: { contains: search, mode: 'insensitive' } } },
        { products: { sku: { contains: search, mode: 'insensitive' } } }
      ]
    } : {})
  };

  const total = await prisma.stock_transactions.count({ where });
  const transactions = await prisma.stock_transactions.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { transaction_date: 'desc' },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unit: true
        }
      },
      product_variants: {
        include: {
          colors: true,
          sizes: true
        }
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  return {
    transactions,
    data: transactions,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const createAdjustment = async (business_id, user_id, data) => {
  const prodId = data.product_id || data.productId;
  let varId = data.variant_id || data.variantId || null;
  const rawQty = parseFloat(data.quantity || data.quantity_change || 0);
  const rawType = data.transaction_type || data.type || 'ADJUSTMENT_IN';

  const isDecrease = ['ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER_OUT', 'SUBTRACT', 'STOCK_OUT', 'PURCHASE_RETURN', 'SALE', 'REMOVE'].includes(rawType);
  const deltaQty = isDecrease ? -Math.abs(rawQty) : Math.abs(rawQty);
  const targetTxType = ['SUBTRACT', 'STOCK_OUT', 'REMOVE'].includes(rawType) ? 'ADJUSTMENT_OUT' : (['ADD', 'STOCK_IN'].includes(rawType) ? 'ADJUSTMENT_IN' : rawType);
  const notes = data.notes || data.reason || 'Manual stock adjustment';

  // If no variantId provided, but product has variants, auto-link to first variant
  if (!varId && prodId) {
    const pVariants = await prisma.product_variants.findMany({
      where: { product_id: prodId }
    });
    if (pVariants && pVariants.length > 0) {
      varId = pVariants[0].id;
    }
  }

  const txRecord = await prisma.stock_transactions.create({
    data: {
      business_id,
      product_id: prodId,
      variant_id: varId,
      transaction_type: targetTxType,
      quantity: deltaQty,
      notes,
      created_by: user_id || null
    }
  });

  const existingStock = await prisma.product_stock.findFirst({
    where: { business_id, product_id: prodId, variant_id: varId }
  });

  if (existingStock) {
    await prisma.product_stock.update({
      where: { id: existingStock.id },
      data: { quantity: { increment: deltaQty } }
    });
  } else {
    await prisma.product_stock.create({
      data: {
        business_id,
        product_id: prodId,
        variant_id: varId,
        quantity: deltaQty
      }
    });
  }

  if (varId) {
    await prisma.product_variants.update({
      where: { id: varId },
      data: { current_stock: { increment: deltaQty } }
    });
  }

  // Update product updated_at timestamp
  await prisma.products.update({
    where: { id: prodId },
    data: { updated_at: new Date() }
  }).catch(() => {});

  // Check if updated product stock triggers low stock alert email and WhatsApp to admin
  try {
    const { sendLowStockAlert } = require('./notification.service');
    const WhatsAppTemplateService = require('./whatsappTemplateService');

    const prod = await prisma.products.findUnique({ where: { id: prodId } });
    if (prod) {
      const stockRes = await getCurrentStock(business_id, { limit: 1000 });
      const currentProdStock = stockRes.stock.find(s => s.id === prodId)?.stockQuantity ?? 0;
      const minStock = Number(prod.minimum_stock || 5);

      if (currentProdStock <= minStock) {
        // Trigger Email Alert
        sendLowStockAlert(business_id).catch(err =>
          console.error('Error sending low stock email alert on adjustment:', err)
        );

        // Trigger WhatsApp Alert (vexa_low_stock_alert)
        WhatsAppTemplateService.sendLowStockAlert({
          businessId: business_id,
          productId: prodId,
          currentStockOverride: currentProdStock
        }).catch(err =>
          console.error('Error sending low stock WhatsApp alert on adjustment:', err)
        );
      }
    }
  } catch (err) {
    console.error('Failed to process low stock check on adjustment:', err.message);
  }

  return txRecord;
};

const adjustStock = createAdjustment;

module.exports = {
  getCurrentStock,
  getStockByProductId,
  getLowStock,
  getOutOfStock,
  getTransactions,
  createAdjustment,
  adjustStock
};
