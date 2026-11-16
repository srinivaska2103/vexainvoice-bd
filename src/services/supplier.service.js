const prisma = require('../config/db');

const getSuppliers = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 50, search = '', filter = 'ALL' } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { gst_number: { contains: search, mode: 'insensitive' } },
        { supplier_code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  if (filter === 'ACTIVE') {
    where.is_active = true;
  } else if (filter === 'INACTIVE') {
    where.is_active = false;
  } else if (filter === 'OUTSTANDING') {
    where.current_balance = { gt: 0 };
  } else if (filter === 'FULLY_PAID') {
    where.current_balance = { lte: 0 };
  }

  const total = await prisma.suppliers.count({ where });
  const suppliers = await prisma.suppliers.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { name: 'asc' },
    include: {
      purchases: {
        select: {
          id: true,
          grand_total: true,
          paid_amount: true,
          balance_amount: true
        }
      },
      supplier_payments: {
        select: {
          id: true,
          amount: true
        }
      }
    }
  });

  const formattedSuppliers = suppliers.map((s) => {
    const gstinVal = s.gst_number || s.gstin || '';
    const extractedStateCode = gstinVal.length >= 2 && !isNaN(gstinVal.slice(0, 2)) ? gstinVal.slice(0, 2) : '33';
    
    // Financial calculation
    const totalPurchases = s.purchases.reduce((acc, p) => acc + Number(p.grand_total || 0), 0);
    const totalPaidFromPayments = s.supplier_payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalPaidOnPurchases = s.purchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
    const totalPaid = Math.max(totalPaidFromPayments, totalPaidOnPurchases);
    
    // Outstanding balance from backend current_balance or calculation
    const outstanding = Number(s.current_balance || 0) || (totalPurchases - totalPaid + Number(s.opening_balance || 0));

    return {
      ...s,
      gstin: gstinVal,
      gst_number: gstinVal,
      state_code: s.state_code || extractedStateCode,
      country: s.country || 'India',
      totalPurchases,
      totalPaid,
      outstanding: Math.max(0, outstanding),
      purchaseCount: s.purchases.length,
      purchases: undefined,
      supplier_payments: undefined
    };
  });

  return {
    suppliers: formattedSuppliers,
    data: formattedSuppliers,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const getSupplierById = async (business_id, id) => {
  const s = await prisma.suppliers.findFirst({
    where: { id, business_id },
    include: {
      purchases: {
        orderBy: { purchase_date: 'desc' },
        include: {
          purchase_items: {
            include: {
              products: true,
              product_variants: {
                include: {
                  colors: true,
                  sizes: true
                }
              }
            }
          },
          purchase_payments: true
        }
      },
      supplier_payments: {
        orderBy: { payment_date: 'desc' },
        include: {
          purchases: true
        }
      }
    }
  });

  if (!s) {
    const err = new Error('Supplier not found');
    err.statusCode = 404;
    throw err;
  }

  const gstinVal = s.gst_number || s.gstin || '';
  const totalPurchases = s.purchases.reduce((acc, p) => acc + Number(p.grand_total || 0), 0);
  const totalPaidPayments = s.supplier_payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalPaidDirect = s.purchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
  const totalPaid = Math.max(totalPaidPayments, totalPaidDirect);
  const outstanding = Number(s.current_balance || 0) || Math.max(0, totalPurchases - totalPaid + Number(s.opening_balance || 0));

  // Compute Product History grouped by parent product -> variants
  const productMap = new Map();

  s.purchases.forEach((pur) => {
    pur.purchase_items.forEach((item) => {
      const prodId = item.product_id;
      const prodName = item.product_name || item.products?.name || 'Product';
      const variant = item.product_variants;

      if (!productMap.has(prodId)) {
        productMap.set(prodId, {
          productId: prodId,
          productName: prodName,
          categoryName: item.products?.category_id || '',
          totalQuantity: 0,
          variantsMap: new Map()
        });
      }

      const prodEntry = productMap.get(prodId);
      const qty = Number(item.quantity || 0);
      const unitPrice = Number(item.unit_price || 0);
      prodEntry.totalQuantity += qty;

      const varKey = item.variant_id || 'DEFAULT';
      if (!prodEntry.variantsMap.has(varKey)) {
        let varName = 'Standard';
        if (variant) {
          const colorName = variant.colors?.name || '';
          const sizeName = variant.sizes?.name || '';
          if (colorName && sizeName) varName = `${colorName} / ${sizeName}`;
          else if (colorName) varName = colorName;
          else if (sizeName) varName = sizeName;
          else if (variant.variant_name) varName = variant.variant_name;
        }

        prodEntry.variantsMap.set(varKey, {
          variantId: item.variant_id,
          variantName: varName,
          sku: variant?.sku || item.products?.sku || '-',
          totalPurchased: 0,
          lastPurchasePrice: unitPrice,
          previousPurchasePrice: null,
          lastPurchaseDate: pur.purchase_date
        });
      }

      const varEntry = prodEntry.variantsMap.get(varKey);
      if (varEntry.lastPurchasePrice !== unitPrice && !varEntry.previousPurchasePrice) {
        varEntry.previousPurchasePrice = varEntry.lastPurchasePrice;
        varEntry.lastPurchasePrice = unitPrice;
      }
      varEntry.totalPurchased += qty;
    });
  });

  const productHistory = Array.from(productMap.values()).map((p) => ({
    ...p,
    variants: Array.from(p.variantsMap.values())
  }));

  return {
    ...s,
    gstin: gstinVal,
    gst_number: gstinVal,
    summary: {
      totalPurchases,
      totalPaid,
      outstanding: Math.max(0, outstanding),
      purchaseCount: s.purchases.length
    },
    productHistory
  };
};

const createSupplier = async (business_id, data) => {
  const opening = parseFloat(data.opening_balance || 0);
  const s = await prisma.suppliers.create({
    data: {
      business_id,
      supplier_code: data.supplier_code || data.code || `SUP-${Date.now().toString().slice(-5)}`,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      gst_number: data.gst_number || data.gstin || null,
      opening_balance: opening,
      current_balance: opening,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : true
    }
  });

  return s;
};

const updateSupplier = async (business_id, id, data) => {
  const existing = await prisma.suppliers.findFirst({ where: { id, business_id } });
  if (!existing) {
    const err = new Error('Supplier not found');
    err.statusCode = 404;
    throw err;
  }

  const s = await prisma.suppliers.update({
    where: { id },
    data: {
      name: data.name || existing.name,
      supplier_code: data.supplier_code !== undefined ? data.supplier_code : existing.supplier_code,
      phone: data.phone !== undefined ? data.phone : existing.phone,
      email: data.email !== undefined ? data.email : existing.email,
      address: data.address !== undefined ? data.address : existing.address,
      city: data.city !== undefined ? data.city : existing.city,
      state: data.state !== undefined ? data.state : existing.state,
      pincode: data.pincode !== undefined ? data.pincode : existing.pincode,
      gst_number: data.gst_number !== undefined ? data.gst_number : (data.gstin !== undefined ? data.gstin : existing.gst_number),
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : existing.is_active
    }
  });

  return s;
};

const deleteSupplier = async (business_id, id) => {
  // Soft delete / deactivate to protect historical purchase integrity
  await prisma.suppliers.updateMany({
    where: { id, business_id },
    data: { is_active: false }
  });
  return { message: 'Supplier deactivated successfully' };
};

const getSupplierLedger = async (business_id, supplier_id, query = {}) => {
  const s = await prisma.suppliers.findFirst({ where: { id: supplier_id, business_id } });
  if (!s) {
    const err = new Error('Supplier not found');
    err.statusCode = 404;
    throw err;
  }

  const purchases = await prisma.purchases.findMany({
    where: { supplier_id, business_id },
    orderBy: { purchase_date: 'asc' }
  });

  const payments = await prisma.supplier_payments.findMany({
    where: { supplier_id, business_id },
    orderBy: { payment_date: 'asc' }
  });

  const timeline = [];

  if (Number(s.opening_balance || 0) > 0) {
    timeline.push({
      date: s.created_at || new Date(),
      type: 'OPENING_BALANCE',
      description: 'Opening Balance',
      reference_no: 'INIT',
      debit: 0,
      credit: Number(s.opening_balance)
    });
  }

  purchases.forEach((p) => {
    timeline.push({
      date: p.purchase_date || p.created_at,
      type: 'PURCHASE',
      description: `Purchase #${p.purchase_number}`,
      reference_no: p.purchase_number,
      debit: 0,
      credit: Number(p.grand_total || 0)
    });
  });

  payments.forEach((p) => {
    timeline.push({
      date: p.payment_date || p.created_at,
      type: 'PAYMENT',
      description: `Payment (${p.payment_method}) ${p.notes ? '- ' + p.notes : ''}`,
      reference_no: p.reference_number || `PAY-${p.id.slice(0, 8)}`,
      debit: Number(p.amount || 0),
      credit: 0
    });
  });

  // Sort chronologically
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance
  let runningBalance = 0;
  const ledger = timeline.map((entry) => {
    runningBalance += (entry.credit - entry.debit);
    return {
      ...entry,
      balance: runningBalance
    };
  });

  return { supplier: s, ledger };
};

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger
};

