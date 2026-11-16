const prisma = require('../config/db');
const saleService = require('./sale.service');
const { logAudit } = require('./audit.service');

/**
 * Helper to parse quotation metadata stored in notes
 */
const parseQuotationMeta = (notes) => {
  if (!notes) return { status: 'DRAFT', discounts: {}, terms: {}, customerSnapshot: null, rawNotes: '' };
  let status = 'DRAFT';
  let discounts = {};
  let terms = {};
  let customerSnapshot = null;
  let rawNotes = notes;

  if (notes.includes('[QTN_META]:')) {
    try {
      const parts = notes.split('[QTN_META]:');
      rawNotes = parts[0].trim();
      const meta = JSON.parse(parts[1].trim());
      status = meta.status || 'DRAFT';
      discounts = meta.discounts || {};
      terms = meta.terms || {};
      customerSnapshot = meta.customerSnapshot || null;
    } catch (e) {
      console.warn('Failed to parse quotation metadata:', e.message);
    }
  }

  return { status, discounts, terms, customerSnapshot, rawNotes };
};

/**
 * Format quotation object for consistent client response
 */
const formatQuotation = (qtn) => {
  if (!qtn) return null;
  const meta = parseQuotationMeta(qtn.notes);

  // Check if expired
  let computedStatus = meta.status;
  if (computedStatus !== 'CONVERTED' && computedStatus !== 'REJECTED' && qtn.valid_until) {
    const validUntilDate = new Date(qtn.valid_until);
    validUntilDate.setHours(23, 59, 59, 999);
    if (new Date() > validUntilDate) {
      computedStatus = 'EXPIRED';
    }
  }

  const items = (qtn.quotation_items || []).map(item => ({
    id: item.id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    product_name: item.product_name,
    sku: item.products?.sku || item.product_variants?.sku || '',
    brand: item.products?.brands?.name || '',
    color: item.product_variants?.colors?.name || '',
    size: item.product_variants?.sizes?.name || '',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    discount_amount: Number(item.discount_amount || 0),
    gst_percentage: Number(item.gst_percentage || 0),
    total_amount: Number(item.total_amount || 0),
    product: item.products,
    variant: item.product_variants
  }));

  return {
    id: qtn.id,
    quotation_number: qtn.quotation_number,
    quotation_date: qtn.quotation_date || qtn.created_at,
    valid_until: qtn.valid_until,
    subtotal: Number(qtn.subtotal || 0),
    discount_amount: Number(qtn.discount_amount || 0),
    tax_amount: Number(qtn.tax_amount || 0),
    grand_total: Number(qtn.grand_total || 0),
    total_amount: Number(qtn.grand_total || 0),
    status: computedStatus,
    customer_id: qtn.customer_id,
    customer: qtn.customers || meta.customerSnapshot || { name: 'Walk-in Client' },
    customers: qtn.customers || meta.customerSnapshot || { name: 'Walk-in Client' },
    items,
    quotation_items: items,
    items_count: items.length,
    total_quantity: items.reduce((sum, it) => sum + it.quantity, 0),
    discounts: meta.discounts,
    terms: meta.terms,
    notes: meta.rawNotes,
    raw_notes: qtn.notes,
    created_at: qtn.created_at,
    created_by: qtn.created_by,
    creator: qtn.users ? { name: qtn.users.name, email: qtn.users.email } : null
  };
};

const getQuotations = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 50, search = '', status = '', startDate = '', endDate = '' } = queryParams;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(search ? {
      OR: [
        { quotation_number: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } },
        { customers: { phone: { contains: search, mode: 'insensitive' } } },
        { quotation_items: { some: { product_name: { contains: search, mode: 'insensitive' } } } }
      ]
    } : {}),
    ...(startDate || endDate ? {
      quotation_date: {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) } : {})
      }
    } : {})
  };

  const total = await prisma.quotations.count({ where });
  const rawQuotations = await prisma.quotations.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { quotation_date: 'desc' },
    include: {
      customers: true,
      users: { select: { id: true, name: true, email: true } },
      quotation_items: {
        include: {
          products: { include: { brands: true } },
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  const formattedQuotations = rawQuotations.map(formatQuotation);

  // Status filtering in memory if specified
  const filteredQuotations = status && status !== 'ALL'
    ? formattedQuotations.filter(q => q.status === status)
    : formattedQuotations;

  return {
    quotations: filteredQuotations,
    data: filteredQuotations,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: status && status !== 'ALL' ? filteredQuotations.length : total,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

const getQuotationById = async (business_id, id) => {
  const qtn = await prisma.quotations.findFirst({
    where: { id, business_id },
    include: {
      customers: true,
      users: { select: { id: true, name: true, email: true } },
      businesses: true,
      quotation_items: {
        include: {
          products: { include: { brands: true } },
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  if (!qtn) {
    const err = new Error('Quotation not found or does not belong to your company');
    err.statusCode = 404;
    throw err;
  }

  return formatQuotation(qtn);
};

const createQuotation = async (business_id, user_id, data) => {
  const count = await prisma.quotations.count({ where: { business_id } });
  const quotationNumber = data.quotation_number?.trim() || `QTN-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

  // Multi-tier Financial Calculations
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length === 0) {
    const err = new Error('At least one item is required to create a quotation');
    err.statusCode = 400;
    throw err;
  }

  const itemsSubtotal = rawItems.reduce((acc, it) => {
    const p = Number(it.unit_price || it.unitPrice || 0);
    const q = Number(it.quantity || 1);
    return acc + (p * q);
  }, 0);

  // 1. Trade Discount
  const tradeVal = Number(data.trade_discount_value || 0);
  const tradeType = data.trade_discount_type || 'PERCENT';
  const tradeAmt = tradeType === 'PERCENT' ? itemsSubtotal * (tradeVal / 100) : tradeVal;
  const remAfterTrade = Math.max(0, itemsSubtotal - tradeAmt);

  // 2. Scheme Discount
  const schemeVal = Number(data.scheme_discount_value || 0);
  const schemeType = data.scheme_discount_type || 'PERCENT';
  const schemeAmt = schemeType === 'PERCENT' ? remAfterTrade * (schemeVal / 100) : schemeVal;
  const remAfterScheme = Math.max(0, remAfterTrade - schemeAmt);

  // 3. Cash Discount
  const cashVal = Number(data.cash_discount_value || 0);
  const cashType = data.cash_discount_type || 'PERCENT';
  const cashAmt = cashType === 'PERCENT' ? remAfterScheme * (cashVal / 100) : cashVal;

  const totalPreGstDiscount = tradeAmt + schemeAmt + cashAmt;
  const taxableAmount = Math.max(0, itemsSubtotal - totalPreGstDiscount);

  // GST Calculation
  const applyGst = data.apply_gst !== false;
  let taxAmount = 0;
  const itemsToCreate = rawItems.map(item => {
    const price = Number(item.unit_price || item.unitPrice || 0);
    const qty = Number(item.quantity || 1);
    const itemSub = price * qty;
    const gstRate = applyGst ? Number(item.gst_percentage ?? item.gstPercentage ?? 0) : 0;
    const itemTaxable = itemsSubtotal > 0 ? (itemSub / itemsSubtotal) * taxableAmount : 0;
    const itemTax = itemTaxable * (gstRate / 100);
    taxAmount += itemTax;

    return {
      product_id: item.product_id || item.productId || null,
      variant_id: item.variant_id || item.variantId || null,
      product_name: item.product_name || item.name || 'Quoted Product',
      quantity: qty,
      unit_price: price,
      discount_amount: itemsSubtotal > 0 ? (itemSub / itemsSubtotal) * totalPreGstDiscount : 0,
      gst_percentage: gstRate,
      total_amount: itemTaxable + itemTax
    };
  });

  const lessAmt = Number(data.less_amount || 0);
  const rawGrandTotal = Math.max(0, taxableAmount + taxAmount - lessAmt);
  const roundOff = data.round_off !== undefined ? Number(data.round_off) : Number((Math.round(rawGrandTotal) - rawGrandTotal).toFixed(2));
  const finalGrandTotal = Math.round(rawGrandTotal);

  // Store metadata inside notes string
  const metaObject = {
    status: data.status || 'DRAFT',
    discounts: {
      tradeType,
      tradeVal,
      tradeAmt,
      schemeType,
      schemeVal,
      schemeAmt,
      cashType,
      cashVal,
      cashAmt,
      lessAmt,
      roundOff,
      totalPreGstDiscount,
      applyGst
    },
    terms: {
      paymentTerms: data.payment_terms || 'Payment within 15 days of invoice date',
      deliveryTerms: data.delivery_terms || 'Ex-mill / Immediate counter dispatch'
    },
    customerSnapshot: data.customer_snapshot || null
  };

  const rawNotesText = (data.notes || '').replace(/\[QTN_META\]:[\s\S]*$/, '').trim();
  const packedNotes = rawNotesText
    ? `${rawNotesText} | [QTN_META]:${JSON.stringify(metaObject)}`
    : `[QTN_META]:${JSON.stringify(metaObject)}`;

  const created = await prisma.quotations.create({
    data: {
      business_id,
      customer_id: data.customer_id || null,
      quotation_number: quotationNumber,
      quotation_date: data.quotation_date ? new Date(data.quotation_date) : new Date(),
      valid_until: data.valid_until ? new Date(data.valid_until) : null,
      subtotal: itemsSubtotal,
      discount_amount: totalPreGstDiscount,
      tax_amount: taxAmount,
      grand_total: finalGrandTotal,
      notes: packedNotes,
      created_by: user_id || null,
      quotation_items: {
        create: itemsToCreate
      }
    },
    include: {
      customers: true,
      quotation_items: {
        include: {
          products: { include: { brands: true } },
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  await logAudit({
    business_id,
    user_id,
    action: 'QUOTATION_CREATED',
    module: 'QUOTATIONS',
    reference_id: created.id,
    new_data: { quotation_number: quotationNumber, grand_total: finalGrandTotal }
  });

  return formatQuotation(created);
};

const updateQuotation = async (business_id, id, user_id, data) => {
  const existing = await prisma.quotations.findFirst({
    where: { id, business_id },
    include: { quotation_items: true }
  });

  if (!existing) {
    const err = new Error('Quotation not found');
    err.statusCode = 404;
    throw err;
  }

  const meta = parseQuotationMeta(existing.notes);
  if (meta.status === 'CONVERTED') {
    const err = new Error('Cannot edit a quotation that has already been converted to a sale invoice');
    err.statusCode = 400;
    throw err;
  }

  // Recalculate if items provided
  let itemsSubtotal = Number(existing.subtotal || 0);
  let taxAmount = Number(existing.tax_amount || 0);
  let totalPreGstDiscount = Number(existing.discount_amount || 0);
  let finalGrandTotal = Number(existing.grand_total || 0);

  if (Array.isArray(data.items) && data.items.length > 0) {
    itemsSubtotal = data.items.reduce((acc, it) => {
      const p = Number(it.unit_price || it.unitPrice || 0);
      const q = Number(it.quantity || 1);
      return acc + (p * q);
    }, 0);

    const tradeVal = Number(data.trade_discount_value !== undefined ? data.trade_discount_value : (meta.discounts.tradeVal || 0));
    const tradeType = data.trade_discount_type || meta.discounts.tradeType || 'PERCENT';
    const tradeAmt = tradeType === 'PERCENT' ? itemsSubtotal * (tradeVal / 100) : tradeVal;
    const remAfterTrade = Math.max(0, itemsSubtotal - tradeAmt);

    const schemeVal = Number(data.scheme_discount_value !== undefined ? data.scheme_discount_value : (meta.discounts.schemeVal || 0));
    const schemeType = data.scheme_discount_type || meta.discounts.schemeType || 'PERCENT';
    const schemeAmt = schemeType === 'PERCENT' ? remAfterTrade * (schemeVal / 100) : schemeVal;
    const remAfterScheme = Math.max(0, remAfterTrade - schemeAmt);

    const cashVal = Number(data.cash_discount_value !== undefined ? data.cash_discount_value : (meta.discounts.cashVal || 0));
    const cashType = data.cash_discount_type || meta.discounts.cashType || 'PERCENT';
    const cashAmt = cashType === 'PERCENT' ? remAfterScheme * (cashVal / 100) : cashVal;

    totalPreGstDiscount = tradeAmt + schemeAmt + cashAmt;
    const taxableAmount = Math.max(0, itemsSubtotal - totalPreGstDiscount);

    const applyGst = data.apply_gst !== undefined ? data.apply_gst : (meta.discounts.applyGst !== false);
    taxAmount = 0;

    const itemsToCreate = data.items.map(item => {
      const price = Number(item.unit_price || item.unitPrice || 0);
      const qty = Number(item.quantity || 1);
      const itemSub = price * qty;
      const gstRate = applyGst ? Number(item.gst_percentage ?? item.gstPercentage ?? 0) : 0;
      const itemTaxable = itemsSubtotal > 0 ? (itemSub / itemsSubtotal) * taxableAmount : 0;
      const itemTax = itemTaxable * (gstRate / 100);
      taxAmount += itemTax;

      return {
        product_id: item.product_id || item.productId || null,
        variant_id: item.variant_id || item.variantId || null,
        product_name: item.product_name || item.name || 'Quoted Product',
        quantity: qty,
        unit_price: price,
        discount_amount: itemsSubtotal > 0 ? (itemSub / itemsSubtotal) * totalPreGstDiscount : 0,
        gst_percentage: gstRate,
        total_amount: itemTaxable + itemTax
      };
    });

    const lessAmt = Number(data.less_amount !== undefined ? data.less_amount : (meta.discounts.lessAmt || 0));
    const rawGrandTotal = Math.max(0, taxableAmount + taxAmount - lessAmt);
    finalGrandTotal = Math.round(rawGrandTotal);

    // Replace items
    await prisma.quotation_items.deleteMany({ where: { quotation_id: id } });
    await prisma.quotation_items.createMany({
      data: itemsToCreate.map(it => ({ ...it, quotation_id: id }))
    });

    meta.discounts = {
      tradeType,
      tradeVal,
      tradeAmt,
      schemeType,
      schemeVal,
      schemeAmt,
      cashType,
      cashVal,
      cashAmt,
      lessAmt,
      totalPreGstDiscount,
      applyGst
    };
  }

  if (data.status) meta.status = data.status;
  if (data.payment_terms !== undefined) meta.terms.paymentTerms = data.payment_terms;
  if (data.delivery_terms !== undefined) meta.terms.deliveryTerms = data.delivery_terms;
  if (data.customer_snapshot) meta.customerSnapshot = data.customer_snapshot;

  const rawNotesText = (data.notes !== undefined ? data.notes : meta.rawNotes).replace(/\[QTN_META\]:[\s\S]*$/, '').trim();
  const packedNotes = rawNotesText
    ? `${rawNotesText} | [QTN_META]:${JSON.stringify(meta)}`
    : `[QTN_META]:${JSON.stringify(meta)}`;

  const updated = await prisma.quotations.update({
    where: { id },
    data: {
      customer_id: data.customer_id !== undefined ? (data.customer_id || null) : existing.customer_id,
      quotation_date: data.quotation_date ? new Date(data.quotation_date) : existing.quotation_date,
      valid_until: data.valid_until !== undefined ? (data.valid_until ? new Date(data.valid_until) : null) : existing.valid_until,
      subtotal: itemsSubtotal,
      discount_amount: totalPreGstDiscount,
      tax_amount: taxAmount,
      grand_total: finalGrandTotal,
      notes: packedNotes
    },
    include: {
      customers: true,
      quotation_items: {
        include: {
          products: { include: { brands: true } },
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  return formatQuotation(updated);
};

const updateQuotationStatus = async (business_id, id, user_id, newStatus) => {
  const existing = await prisma.quotations.findFirst({
    where: { id, business_id }
  });

  if (!existing) {
    const err = new Error('Quotation not found');
    err.statusCode = 404;
    throw err;
  }

  const meta = parseQuotationMeta(existing.notes);
  meta.status = newStatus;

  const rawNotesText = meta.rawNotes.trim();
  const packedNotes = rawNotesText
    ? `${rawNotesText} | [QTN_META]:${JSON.stringify(meta)}`
    : `[QTN_META]:${JSON.stringify(meta)}`;

  const updated = await prisma.quotations.update({
    where: { id },
    data: { notes: packedNotes },
    include: {
      customers: true,
      quotation_items: {
        include: {
          products: { include: { brands: true } },
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  await logAudit({
    business_id,
    user_id,
    action: `QUOTATION_STATUS_${newStatus}`,
    module: 'QUOTATIONS',
    reference_id: id,
    new_data: { status: newStatus }
  });

  return formatQuotation(updated);
};

const getQuotationMetrics = async (business_id) => {
  const allQuotations = await prisma.quotations.findMany({
    where: { business_id },
    select: {
      id: true,
      valid_until: true,
      grand_total: true,
      notes: true
    }
  });

  const now = new Date();
  let total = allQuotations.length;
  let draft = 0;
  let sent = 0;
  let accepted = 0;
  let rejected = 0;
  let expired = 0;
  let converted = 0;
  let totalValue = 0;

  for (const q of allQuotations) {
    totalValue += Number(q.grand_total || 0);
    const meta = parseQuotationMeta(q.notes);
    let s = meta.status;

    if (s !== 'CONVERTED' && s !== 'REJECTED' && q.valid_until) {
      const validUntilDate = new Date(q.valid_until);
      validUntilDate.setHours(23, 59, 59, 999);
      if (now > validUntilDate) {
        s = 'EXPIRED';
      }
    }

    if (s === 'CONVERTED') converted++;
    else if (s === 'ACCEPTED') accepted++;
    else if (s === 'SENT') sent++;
    else if (s === 'REJECTED') rejected++;
    else if (s === 'EXPIRED') expired++;
    else draft++;
  }

  return {
    total,
    draft,
    sent,
    accepted,
    rejected,
    expired,
    converted,
    totalValue: Number(totalValue.toFixed(2))
  };
};

const convertToSale = async (business_id, quotationId, user_id) => {
  const qtn = await getQuotationById(business_id, quotationId);

  if (qtn.status === 'CONVERTED') {
    const err = new Error(`Quotation #${qtn.quotation_number} has already been converted to a sale invoice.`);
    err.statusCode = 400;
    throw err;
  }

  // Enforce validity date: cannot convert expired quote without override
  if (qtn.status === 'EXPIRED') {
    const err = new Error(`Quotation #${qtn.quotation_number} has expired. Please extend the validity date before converting.`);
    err.statusCode = 400;
    throw err;
  }

  const items = qtn.items || [];
  if (items.length === 0) {
    const err = new Error('Quotation contains no valid product line items to convert.');
    err.statusCode = 400;
    throw err;
  }

  const saleData = {
    customer_id: qtn.customer_id,
    invoice_type: 'RETAIL',
    items: items.map(item => ({
      product_id: item.product_id,
      variant_id: item.variant_id || undefined,
      quantity: item.quantity,
      unit_price: item.unit_price,
      gst_percentage: item.gst_percentage
    })),
    trade_discount_type: qtn.discounts?.tradeType || 'PERCENT',
    trade_discount_value: qtn.discounts?.tradeVal || 0,
    scheme_discount_type: qtn.discounts?.schemeType || 'PERCENT',
    scheme_discount_value: qtn.discounts?.schemeVal || 0,
    cash_discount_type: qtn.discounts?.cashType || 'PERCENT',
    cash_discount_value: qtn.discounts?.cashVal || 0,
    less_amount: qtn.discounts?.lessAmt || 0,
    discount_amount: qtn.discount_amount,
    round_off: qtn.discounts?.roundOff || 0,
    notes: `Converted from Quotation #${qtn.quotation_number}${qtn.notes ? ` | Notes: ${qtn.notes}` : ''}`
  };

  const sale = await saleService.createSale(business_id, user_id, saleData);

  // Mark quotation as CONVERTED in metadata
  await updateQuotationStatus(business_id, quotationId, user_id, 'CONVERTED');

  await logAudit({
    business_id,
    user_id,
    action: 'QUOTATION_CONVERTED_TO_SALE',
    module: 'QUOTATIONS',
    reference_id: quotationId,
    new_data: { sale_id: sale.id, invoice_number: sale.invoice_number || sale.invoiceNumber }
  });

  return sale;
};

const deleteQuotation = async (business_id, id) => {
  const qtn = await prisma.quotations.findFirst({
    where: { id, business_id }
  });

  if (!qtn) {
    const err = new Error('Quotation not found');
    err.statusCode = 404;
    throw err;
  }

  const meta = parseQuotationMeta(qtn.notes);
  if (meta.status === 'CONVERTED') {
    const err = new Error('Cannot delete a quotation that has been converted to an active sale invoice.');
    err.statusCode = 400;
    throw err;
  }

  await prisma.quotations.deleteMany({
    where: { id, business_id }
  });

  return { message: 'Quotation deleted successfully' };
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  getQuotationMetrics,
  convertToSale,
  deleteQuotation
};
