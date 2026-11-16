const prisma = require('../config/db');
const { logAudit } = require('./audit.service');
const { sendSaleInvoiceEmail, sendLowStockAlert } = require('./notification.service');

/**
 * Helper to extract Order Reference from sale object or notes
 */
const extractOrderNumber = (inv) => {
  if (inv && inv.notes && inv.notes.includes('ORDER_REF:')) {
    const match = inv.notes.match(/ORDER_REF:([^\s|]+)/);
    if (match && match[1]) return match[1];
  }
  if (inv && inv.invoice_number && inv.invoice_number.startsWith('INV-')) {
    return inv.invoice_number.replace('INV-', 'ORD-');
  }
  const yearStr = new Date(inv?.created_at || inv?.invoice_date || Date.now()).getFullYear();
  return `ORD-${yearStr}-001`;
};

/**
 * Get next sequential Order Reference & Invoice Number for a business
 */
const getNextNumber = async (business_id) => {
  if (!business_id) {
    const err = new Error('Business ID is required');
    err.statusCode = 400;
    throw err;
  }

  const currentYear = new Date().getFullYear();
  const yearStr = String(currentYear);
  const invPrefix = `INV-${yearStr}-`;
  const ordPrefix = `ORD-${yearStr}-`;

  // Find max invoice sequence for this business and current year
  const sales = await prisma.sales.findMany({
    where: {
      business_id,
      invoice_number: { startsWith: invPrefix }
    },
    select: { invoice_number: true }
  });

  let maxInvSeq = 0;
  for (const s of sales) {
    if (s.invoice_number && s.invoice_number.startsWith(invPrefix)) {
      const num = parseInt(s.invoice_number.replace(invPrefix, ''), 10);
      if (!isNaN(num) && num > maxInvSeq) {
        maxInvSeq = num;
      }
    }
  }

  // Find max order sequence for this business and current year
  const salesWithNotes = await prisma.sales.findMany({
    where: { business_id },
    select: { notes: true }
  });

  let maxOrdSeq = 0;
  for (const s of salesWithNotes) {
    if (s.notes && s.notes.includes(ordPrefix)) {
      const match = s.notes.match(new RegExp(`ORD-${yearStr}-(\\d+)`));
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxOrdSeq) {
          maxOrdSeq = num;
        }
      }
    }
  }

  const invoiceNumber = `${invPrefix}${String(maxInvSeq + 1).padStart(3, '0')}`;
  const orderNumber = `${ordPrefix}${String(maxOrdSeq + 1).padStart(3, '0')}`;

  return {
    orderNumber,
    order_number: orderNumber,
    invoiceNumber,
    invoice_number: invoiceNumber
  };
};

const getSales = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 100, search = '', customer_id, paymentStatus, paymentMethod, startDate, endDate, customerType } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(customer_id ? { customer_id } : {}),
    ...(customerType && customerType !== 'ALL' ? { customers: { customer_type: customerType } } : {}),
    ...(search ? {
      OR: [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } },
        { customers: { phone: { contains: search, mode: 'insensitive' } } }
      ]
    } : {})
  };

  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);
    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);
    where.invoice_date = { gte: s, lte: e };
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    where.sale_payments = {
      some: { payment_method: paymentMethod }
    };
  }

  if (paymentStatus && paymentStatus !== 'ALL') {
    if (paymentStatus === 'PAID') {
      where.balance_amount = { lte: 0 };
    } else if (paymentStatus === 'UNPAID' || paymentStatus === 'DUE') {
      where.paid_amount = { lte: 0 };
    } else if (paymentStatus === 'PARTIAL') {
      where.AND = [
        { paid_amount: { gt: 0 } },
        { balance_amount: { gt: 0 } }
      ];
    }
  }

  const total = await prisma.sales.count({ where });
  const invoices = await prisma.sales.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { invoice_date: 'desc' },
    include: {
      customers: true,
      sale_items: {
        include: {
          products: true
        }
      },
      sale_payments: true
    }
  });

  // Fetch stock transactions for SALE_RETURN for these invoices
  const saleIds = invoices.map((inv) => inv.id);
  const invNumbers = invoices.map((inv) => inv.invoice_number).filter(Boolean);

  let returnTxs = [];
  try {
    returnTxs = await prisma.stock_transactions.findMany({
      where: {
        business_id,
        transaction_type: 'SALE_RETURN',
        OR: [
          { reference_id: { in: saleIds } },
          { reference_number: { in: invNumbers } }
        ]
      }
    });
  } catch (err) {
    console.warn('Could not fetch return transactions:', err.message);
  }

  const returnsMap = new Map();
  returnTxs.forEach((tx) => {
    const key = tx.reference_id || tx.reference_number;
    if (!returnsMap.has(key)) returnsMap.set(key, []);
    returnsMap.get(key).push(tx);
  });

  const formattedSales = invoices.map(inv => {
    const ordNum = extractOrderNumber(inv);
    const saleReturnTxs = (returnsMap.get(inv.id) || []).concat(returnsMap.get(inv.invoice_number) || []);

    const formattedItems = inv.sale_items ? inv.sale_items.map(i => {
      const itemReturns = saleReturnTxs.filter(tx => 
        (i.product_id && tx.product_id === i.product_id) ||
        (i.variant_id && tx.variant_id === i.variant_id)
      );
      const returnedQty = itemReturns.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
      const originalQty = Number(i.quantity || 1);
      const remainingQty = Math.max(0, originalQty - returnedQty);

      return {
        id: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id,
        name: i.product_name || i.products?.name,
        product_name: i.product_name || i.products?.name,
        original_quantity: originalQty,
        originalQuantity: originalQty,
        returned_quantity: returnedQty,
        returnedQuantity: returnedQty,
        remaining_quantity: remainingQty,
        remainingQuantity: remainingQty,
        quantity: originalQty,
        unitPrice: Number(i.unit_price || 0),
        unit_price: Number(i.unit_price || 0),
        discount_percentage: Number(i.discount_percentage || 0),
        gst_percentage: Number(i.gst_percentage || i.tax_rate || 5),
        taxRate: Number(i.gst_percentage || i.tax_rate || 5),
        totalAmount: Number(i.total_amount || 0),
        total_amount: Number(i.total_amount || 0),
        hsn_code: i.products?.hsn_code || '6109',
        color: i.color || i.products?.color || '',
        size: i.size || i.products?.size || ''
      };
    }) : [];

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoice_number: inv.invoice_number,
      orderNumber: ordNum,
      order_number: ordNum,
      invoiceType: inv.invoice_type,
      invoice_type: inv.invoice_type,
      status: inv.status,
      is_return: inv.status === 'RETURNED' || inv.status === 'PARTIAL_RETURN' || (Boolean(inv.notes && (inv.notes.includes('[RETURNED]') || inv.notes.includes('[RETURN_LOG]:')))),
      return_status: (inv.notes && inv.notes.includes('[RETURN_LOG]:')) ? 'RETURNED' : null,
      createdAt: inv.created_at || inv.invoice_date,
      totalAmount: Number(inv.grand_total || 0),
      total_amount: Number(inv.grand_total || 0),
      paidAmount: Number(inv.paid_amount || 0),
      paid_amount: Number(inv.paid_amount || 0),
      balanceAmount: Number(inv.balance_amount || 0),
      balance_amount: Number(inv.balance_amount || 0),
      paymentStatus: inv.balance_amount <= 0 ? 'PAID' : (inv.paid_amount > 0 ? 'PARTIAL' : 'DUE'),
      paymentMethod: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      payment_method: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      paymentMode: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      payment_mode: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      paymentTerms: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      payment_terms: inv.sale_payments && inv.sale_payments.length > 0 ? inv.sale_payments[0].payment_method : null,
      sale_payments: inv.sale_payments || [],
      payments: inv.sale_payments || [],
      notes: inv.notes,
      returnHistory: (() => {
        if (!inv.notes || !inv.notes.includes('[RETURN_LOG]:')) return [];
        const logs = [];
        const parts = inv.notes.split('[RETURN_LOG]:');
        for (let i = 1; i < parts.length; i++) {
          try {
            const raw = parts[i].split(' | ')[0].trim();
            logs.push(JSON.parse(raw));
          } catch (e) {}
        }
        return logs;
      })(),
      returnedAmount: (() => {
        let sum = 0;
        if (inv.notes && inv.notes.includes('[RETURN_LOG]:')) {
          const parts = inv.notes.split('[RETURN_LOG]:');
          for (let i = 1; i < parts.length; i++) {
            try {
              const raw = parts[i].split(' | ')[0].trim();
              const parsed = JSON.parse(raw);
              sum += Number(parsed.refundAmount || 0);
            } catch (e) {}
          }
        }
        // If not in RETURN_LOG, check returned item line values
        if (sum === 0 && formattedItems && formattedItems.length > 0) {
          sum = formattedItems.reduce((acc, it) => {
            const retQty = Number(it.returned_quantity || 0);
            const unitPrice = Number(it.unit_price || 0);
            const gst = Number(it.gst_percentage || 0);
            return acc + (retQty * unitPrice * (1 + gst / 100));
          }, 0);
        }
        // Fallback: If marked RETURNED and total sum is 0, entire invoice was returned
        if (sum === 0 && (inv.status === 'RETURNED' || (inv.notes && inv.notes.includes('[RETURNED]')))) {
          sum = Number(inv.grand_total || 0);
        }
        return Number(sum.toFixed(2));
      })(),
      customer: inv.customers ? {
        id: inv.customers.id,
        name: inv.customers.name,
        phone: inv.customers.phone,
        email: inv.customers.email,
        address: inv.customers.address,
        gstin: inv.customers.gst_number,
        customer_type: inv.customers.customer_type || 'RETAIL',
        customerType: inv.customers.customer_type || 'RETAIL',
        current_balance: Number(inv.customers.current_balance || 0),
        outstanding_balance: Number(inv.customers.current_balance || 0),
        outstandingBalance: Number(inv.customers.current_balance || 0)
      } : null,
      items: formattedItems,
      sale_items: formattedItems
    };
  });

  return {
    sales: formattedSales,
    data: formattedSales,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const getSaleById = async (business_id, id) => {
  // Validate UUID format to prevent Prisma P2023 errors on non-UUID routes
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!id || !uuidRegex.test(id)) {
    const err = new Error('Sale invoice not found');
    err.statusCode = 404;
    throw err;
  }

  const invoice = await prisma.sales.findFirst({
    where: { id, business_id },
    include: {
      customers: true,
      sale_items: {
        include: {
          products: true
        }
      },
      sale_payments: true
    }
  });

  if (!invoice) {
    const err = new Error('Sale invoice not found');
    err.statusCode = 404;
    throw err;
  }

  let returnTxs = [];
  try {
    returnTxs = await prisma.stock_transactions.findMany({
      where: {
        business_id,
        transaction_type: 'SALE_RETURN',
        OR: [
          { reference_id: invoice.id },
          { reference_number: invoice.invoice_number }
        ]
      }
    });
  } catch (err) {
    console.warn('Could not fetch return transactions in getSaleById:', err.message);
  }

  const formattedItems = (invoice.sale_items || []).map(i => {
    const itemReturns = returnTxs.filter(tx => 
      (i.product_id && tx.product_id === i.product_id) ||
      (i.variant_id && tx.variant_id === i.variant_id)
    );
    const returnedQty = itemReturns.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
    const originalQty = Number(i.quantity || 1);
    const remainingQty = Math.max(0, originalQty - returnedQty);

    return {
      id: i.id,
      product_id: i.product_id,
      variant_id: i.variant_id,
      name: i.product_name || i.products?.name,
      product_name: i.product_name || i.products?.name,
      original_quantity: originalQty,
      originalQuantity: originalQty,
      returned_quantity: returnedQty,
      returnedQuantity: returnedQty,
      remaining_quantity: remainingQty,
      remainingQuantity: remainingQty,
      quantity: originalQty,
      unitPrice: Number(i.unit_price || 0),
      unit_price: Number(i.unit_price || 0),
      discount_percentage: Number(i.discount_percentage || 0),
      gst_percentage: Number(i.gst_percentage || i.tax_rate || 5),
      taxRate: Number(i.gst_percentage || i.tax_rate || 5),
      totalAmount: Number(i.total_amount || 0),
      total_amount: Number(i.total_amount || 0),
      hsn_code: i.products?.hsn_code || '6109',
      color: i.color || i.products?.color || '',
      size: i.size || i.products?.size || ''
    };
  });

  const ordNum = extractOrderNumber(invoice);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    invoice_number: invoice.invoice_number,
    orderNumber: ordNum,
    order_number: ordNum,
    invoiceType: invoice.invoice_type,
    createdAt: invoice.created_at || invoice.invoice_date,
    totalAmount: Number(invoice.grand_total || 0),
    total_amount: Number(invoice.grand_total || 0),
    subtotalAmount: Number(invoice.subtotal || 0),
    taxAmount: Number(invoice.cgst_amount || 0) + Number(invoice.sgst_amount || 0) + Number(invoice.igst_amount || 0),
    discountAmount: Number(invoice.discount_amount || 0),
    paidAmount: Number(invoice.paid_amount || 0),
    paymentMethod: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    payment_method: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    paymentMode: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    payment_mode: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    paymentTerms: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    payment_terms: invoice.sale_payments && invoice.sale_payments.length > 0 ? invoice.sale_payments[0].payment_method : null,
    sale_payments: invoice.sale_payments || [],
    payments: invoice.sale_payments || [],
    notes: invoice.notes,
    returnHistory: (() => {
      if (!invoice.notes || !invoice.notes.includes('[RETURN_LOG]:')) return [];
      const logs = [];
      const parts = invoice.notes.split('[RETURN_LOG]:');
      for (let i = 1; i < parts.length; i++) {
        try {
          const raw = parts[i].split(' | ')[0].trim();
          logs.push(JSON.parse(raw));
        } catch (e) {}
      }
      return logs;
    })(),
    returnedAmount: (() => {
      let sum = 0;
      if (invoice.notes && invoice.notes.includes('[RETURN_LOG]:')) {
        const parts = invoice.notes.split('[RETURN_LOG]:');
        for (let i = 1; i < parts.length; i++) {
          try {
            const raw = parts[i].split(' | ')[0].trim();
            const parsed = JSON.parse(raw);
            sum += Number(parsed.refundAmount || 0);
          } catch (e) {}
        }
      }
      if (sum === 0 && (invoice.status === 'RETURNED' || (invoice.notes && invoice.notes.includes('[RETURNED]')))) {
        sum = Number(invoice.grand_total || 0);
      }
      return Number(sum.toFixed(2));
    })(),
    customer: invoice.customers ? {
      name: invoice.customers.name,
      phone: invoice.customers.phone,
      email: invoice.customers.email,
      address: invoice.customers.address,
      gstin: invoice.customers.gst_number
    } : null,
    items: formattedItems,
    sale_items: formattedItems
  };
};

const createSale = async (business_id, user_id, data) => {
  const saleResult = await prisma.$transaction(async (tx) => {
    let customer = null;
    if (data.customer_id) {
      customer = await tx.customers.findFirst({ where: { id: data.customer_id, business_id } });
      if (!customer) {
        const err = new Error('Customer not found');
        err.statusCode = 404;
        throw err;
      }
    }

    let subtotal = 0;
    const preparedItems = [];

    for (const item of data.items) {
      const product = await tx.products.findFirst({ where: { id: item.productId || item.product_id, business_id } });
      if (!product || product.is_active === false) {
        const err = new Error(`Product not found or inactive`);
        err.statusCode = 400;
        throw err;
      }

      let unitPrice = item.unitPrice !== undefined ? item.unitPrice : item.unit_price;
      if (unitPrice === undefined || unitPrice === null) {
        const isWholesale = customer?.customer_type === 'WHOLESALE' || data.invoiceType === 'WHOLESALE' || data.invoice_type === 'WHOLESALE';
        unitPrice = parseFloat(isWholesale ? (product.wholesale_price || product.retail_price || 0) : (product.retail_price || 0));
      } else {
        unitPrice = parseFloat(unitPrice);
      }
      const variantId = item.variant_id || item.variantId || null;
      const qty = parseFloat(item.quantity || 1);

      // Fetch all variants for product
      const productVariants = await tx.product_variants.findMany({ where: { product_id: product.id } });
      const hasVariants = product.has_variants || productVariants.length > 0;

      if (hasVariants && !variantId) {
        const err = new Error(`Variant selection is required for product "${product.name}"`);
        err.statusCode = 400;
        throw err;
      }

      // Verify stock for variant or parent product
      if (variantId) {
        const variantObj = productVariants.find(v => v.id === variantId) || await tx.product_variants.findFirst({ where: { id: variantId, product_id: product.id } });
        if (!variantObj) {
          const err = new Error(`Selected variant not found for product "${product.name}"`);
          err.statusCode = 400;
          throw err;
        }

        const vTxAgg = await tx.stock_transactions.aggregate({
          where: { business_id, product_id: product.id, variant_id: variantId },
          _sum: { quantity: true }
        });
        const hasOpeningTx = await tx.stock_transactions.findFirst({
          where: { business_id, product_id: product.id, variant_id: variantId, transaction_type: 'OPENING' }
        });
        const initVStock = Number(variantObj.opening_stock || 0);
        const txQty = (vTxAgg._sum && vTxAgg._sum.quantity !== null && vTxAgg._sum.quantity !== undefined)
          ? Number(vTxAgg._sum.quantity || 0)
          : 0;
        const availableStock = hasOpeningTx ? txQty : (initVStock + txQty);

        // Negative/Backorder stock is allowed - log warning if stock drops below 0
        if (availableStock < qty) {
          console.warn(`[STOCK WARNING] Product "${product.name}" (${variantObj.variant_name || 'Variant'}) stock going negative. Available: ${availableStock}, Sold: ${qty}`);
        }
      } else {
        const pTxAgg = await tx.stock_transactions.aggregate({
          where: { business_id, product_id: product.id, variant_id: null },
          _sum: { quantity: true }
        });
        const hasOpeningTx = await tx.stock_transactions.findFirst({
          where: { business_id, product_id: product.id, variant_id: null, transaction_type: 'OPENING' }
        });
        const initPStock = Number(product.opening_stock || 0);
        const txQty = (pTxAgg._sum && pTxAgg._sum.quantity !== null && pTxAgg._sum.quantity !== undefined)
          ? Number(pTxAgg._sum.quantity || 0)
          : 0;
        const availableStock = hasOpeningTx ? txQty : (initPStock + txQty);

        // Negative/Backorder stock is allowed - log warning if stock drops below 0
        if (availableStock < qty) {
          console.warn(`[STOCK WARNING] Product "${product.name}" stock going negative. Available: ${availableStock}, Sold: ${qty}`);
        }
      }

      const rawItemTotal = unitPrice * qty;
      const gstPct = parseFloat(item.taxRate !== undefined ? item.taxRate : (item.gst_percentage || product.gst_percentage || 5));
      const isIgst = Boolean(item.is_igst);

      subtotal += rawItemTotal;

      preparedItems.push({
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        sku: product.sku,
        quantity: qty,
        unit_price: unitPrice,
        raw_total: rawItemTotal,
        gst_percentage: gstPct,
        is_igst: isIgst
      });
    }

    // 1. Trade Discount
    const tradeType = data.trade_discount_type || 'PERCENT';
    const tradeVal = parseFloat(data.trade_discount_value || 0);
    const tradeDiscount = tradeType === 'PERCENT' ? subtotal * (tradeVal / 100) : tradeVal;
    const remAfterTrade = Math.max(0, subtotal - tradeDiscount);

    // 2. Scheme Discount
    const schemeType = data.scheme_discount_type || 'PERCENT';
    const schemeVal = parseFloat(data.scheme_discount_value || 0);
    const schemeDiscount = schemeType === 'PERCENT' ? remAfterTrade * (schemeVal / 100) : schemeVal;
    const remAfterScheme = Math.max(0, remAfterTrade - schemeDiscount);

    // 3. Cash Discount (only applicable if payment method is NOT CREDIT)
    const isCredit = (Array.isArray(data.payments) && data.payments.some(p => p.payment_method === 'CREDIT')) || data.paymentMethod === 'CREDIT';
    const cashType = data.cash_discount_type || 'PERCENT';
    const cashVal = parseFloat(data.cash_discount_value || 0);
    const cashDiscount = isCredit ? 0 : (cashType === 'PERCENT' ? remAfterScheme * (cashVal / 100) : cashVal);

    // Total Pre-GST Discount & Taxable Amount
    const totalPreGstDiscount = tradeDiscount + schemeDiscount + cashDiscount;
    const overallDiscount = data.discount_amount || data.discountAmount ? parseFloat(data.discount_amount || data.discountAmount) : totalPreGstDiscount;
    const totalTaxable = Math.max(0, subtotal - overallDiscount);

    // Proportional GST Calculation on Taxable Amount
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const finalPreparedItems = preparedItems.map((item) => {
      const itemTaxable = subtotal > 0 ? (item.raw_total / subtotal) * totalTaxable : 0;
      const gstAmt = itemTaxable * (item.gst_percentage / 100);
      const cgst = item.is_igst ? 0 : gstAmt / 2;
      const sgst = item.is_igst ? 0 : gstAmt / 2;
      const igst = item.is_igst ? gstAmt : 0;

      if (item.is_igst) {
        totalIgst += igst;
      } else {
        totalCgst += cgst;
        totalSgst += sgst;
      }

      return {
        product_id: item.product_id,
        variant_id: item.variant_id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        taxable_amount: itemTaxable,
        gst_percentage: item.gst_percentage,
        cgst_amount: cgst,
        sgst_amount: sgst,
        igst_amount: igst,
        total_amount: itemTaxable + gstAmt
      };
    });

    // 4. Total After GST & Less (Post-GST Deduction)
    const totalAfterGst = totalTaxable + totalCgst + totalSgst + totalIgst;
    const lessAmount = parseFloat(data.less_amount || 0);
    const rawGrandTotal = Math.max(0, totalAfterGst - lessAmount);
    
    // 5. Round Off & Final Grand Total
    let roundOff = data.round_off !== undefined && data.round_off !== null ? parseFloat(data.round_off) : 0;
    if (roundOff === 0) {
      roundOff = Math.round(rawGrandTotal) - rawGrandTotal;
    }
    const grandTotal = Math.round(rawGrandTotal + roundOff);

    let totalPaid = 0;
    if (Array.isArray(data.payments) && data.payments.length > 0) {
      totalPaid = data.payments.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    } else if (isCredit) {
      totalPaid = 0;
    } else {
      totalPaid = grandTotal;
    }
    const balanceAmount = grandTotal - totalPaid;

    if (data.customer_id && balanceAmount !== 0) {
      await tx.customers.update({
        where: { id: data.customer_id },
        data: {
          current_balance: { increment: balanceAmount }
        }
      });
    }

    const yearStr = String(new Date().getFullYear());
    const invPrefix = `INV-${yearStr}-`;
    const ordPrefix = `ORD-${yearStr}-`;

    // 1. Determine max issued sequence for Invoice Number for yearStr in this business
    const existingInvSales = await tx.sales.findMany({
      where: {
        business_id,
        invoice_number: { startsWith: invPrefix }
      },
      select: { invoice_number: true }
    });

    let maxInvSeq = 0;
    for (const s of existingInvSales) {
      if (s.invoice_number && s.invoice_number.startsWith(invPrefix)) {
        const num = parseInt(s.invoice_number.replace(invPrefix, ''), 10);
        if (!isNaN(num) && num > maxInvSeq) maxInvSeq = num;
      }
    }

    let nextInvSeq = maxInvSeq + 1;
    let invoiceNumber = `${invPrefix}${String(nextInvSeq).padStart(3, '0')}`;

    // Ensure invoiceNumber is strictly unique within the business
    let isUnique = false;
    while (!isUnique) {
      const existingInvoice = await tx.sales.findFirst({
        where: { business_id, invoice_number: invoiceNumber }
      });
      if (existingInvoice) {
        nextInvSeq++;
        invoiceNumber = `${invPrefix}${String(nextInvSeq).padStart(3, '0')}`;
      } else {
        isUnique = true;
      }
    }

    // 2. Determine max issued sequence for Order Reference for yearStr in this business
    const existingOrdSales = await tx.sales.findMany({
      where: { business_id },
      select: { notes: true }
    });

    let maxOrdSeq = 0;
    for (const s of existingOrdSales) {
      if (s.notes && s.notes.includes(ordPrefix)) {
        const match = s.notes.match(new RegExp(`ORD-${yearStr}-(\\d+)`));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxOrdSeq) maxOrdSeq = num;
        }
      }
    }

    let nextOrdSeq = maxOrdSeq + 1;
    let orderNumber = `${ordPrefix}${String(nextOrdSeq).padStart(3, '0')}`;

    let isOrdUnique = false;
    while (!isOrdUnique) {
      const existingOrd = await tx.sales.findFirst({
        where: { business_id, notes: { contains: `ORDER_REF:${orderNumber}` } }
      });
      if (existingOrd) {
        nextOrdSeq++;
        orderNumber = `${ordPrefix}${String(nextOrdSeq).padStart(3, '0')}`;
      } else {
        isOrdUnique = true;
      }
    }

    // Build structured discount notes breakdown with ORDER_REF
    const discountBreakdownObj = {
      tradeDiscount: Number(tradeDiscount.toFixed(2)),
      schemeDiscount: Number(schemeDiscount.toFixed(2)),
      cashDiscount: Number(cashDiscount.toFixed(2)),
      lessAmount: Number(lessAmount.toFixed(2)),
      tradeType,
      tradeVal,
      schemeType,
      schemeVal,
      cashType,
      cashVal
    };
    const userNotes = data.notes ? data.notes.trim() : '';
    const updatedNotes = userNotes
      ? `ORDER_REF:${orderNumber} | ${userNotes} | DISCOUNTS:${JSON.stringify(discountBreakdownObj)}`
      : `ORDER_REF:${orderNumber} | DISCOUNTS:${JSON.stringify(discountBreakdownObj)}`;

    // Create Invoice Header
    const invoice = await tx.sales.create({
      data: {
        business_id,
        customer_id: data.customer_id || null,
        invoice_number: invoiceNumber,
        invoice_type: 'SALE',
        status: 'CONFIRMED',
        subtotal,
        discount_amount: overallDiscount,
        taxable_amount: totalTaxable,
        cgst_amount: totalCgst,
        sgst_amount: totalSgst,
        igst_amount: totalIgst,
        round_off: roundOff,
        grand_total: grandTotal,
        paid_amount: totalPaid,
        balance_amount: balanceAmount,
        notes: updatedNotes,
        created_by: user_id || null
      }
    });

    // Create Sale Items
    for (const itemData of finalPreparedItems) {
      await tx.sale_items.create({
        data: {
          sale_id: invoice.id,
          product_id: itemData.product_id,
          variant_id: itemData.variant_id,
          product_name: itemData.product_name,
          sku: itemData.sku,
          quantity: itemData.quantity,
          unit_price: itemData.unit_price,
          taxable_amount: itemData.taxable_amount,
          gst_percentage: itemData.gst_percentage,
          cgst_amount: itemData.cgst_amount,
          sgst_amount: itemData.sgst_amount,
          igst_amount: itemData.igst_amount,
          total_amount: itemData.total_amount
        }
      });

      // Deduct product stock in product_stock table
      const existingStock = await tx.product_stock.findFirst({
        where: { business_id, product_id: itemData.product_id, variant_id: itemData.variant_id || null }
      });

      if (existingStock) {
        await tx.product_stock.update({
          where: { id: existingStock.id },
          data: {
            quantity: { decrement: itemData.quantity }
          }
        });
      } else {
        await tx.product_stock.create({
          data: {
            business_id,
            product_id: itemData.product_id,
            variant_id: itemData.variant_id || null,
            quantity: -itemData.quantity
          }
        });
      }

      if (itemData.variant_id) {
        await tx.product_variants.update({
          where: { id: itemData.variant_id },
          data: {
            current_stock: { decrement: itemData.quantity }
          }
        });
      }

      await tx.stock_transactions.create({
        data: {
          business_id,
          product_id: itemData.product_id,
          variant_id: itemData.variant_id,
          transaction_type: 'SALE',
          quantity: -Math.abs(itemData.quantity),
          reference_id: invoice.id,
          reference_number: invoice.invoice_number,
          notes: 'Sale Outward',
          created_by: user_id || null
        }
      });
    }

    // Create Payment record
    let selectedPaymentMethod = data.paymentMethod || data.payment_method || data.paymentMode || data.payment_mode;
    if (!selectedPaymentMethod && Array.isArray(data.payments) && data.payments.length > 0) {
      selectedPaymentMethod = data.payments[0].payment_method || data.payments[0].paymentMethod || data.payments[0].method || data.payments[0].mode;
    }

    if (Array.isArray(data.payments) && data.payments.length > 0) {
      for (const p of data.payments) {
        const pmRaw = p.payment_method || p.paymentMethod || p.method || p.mode || selectedPaymentMethod || 'CASH';
        const validPm = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'].includes(pmRaw) ? pmRaw : 'CASH';
        await tx.sale_payments.create({
          data: {
            sale_id: invoice.id,
            payment_method: validPm,
            amount: p.amount !== undefined ? parseFloat(p.amount) : totalPaid,
            created_by: user_id || null
          }
        });
      }
    } else {
      const pmRaw = selectedPaymentMethod || (isCredit ? 'CREDIT' : 'CASH');
      const validPm = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'].includes(pmRaw) ? pmRaw : 'CASH';
      await tx.sale_payments.create({
        data: {
          sale_id: invoice.id,
          payment_method: validPm,
          amount: totalPaid,
          created_by: user_id || null
        }
      });
    }

    await logAudit({
      business_id,
      user_id,
      action: 'SALE_CREATED',
      module: 'SALES',
      reference_id: invoice.id,
      new_data: { invoice_number: invoice.invoice_number, grand_total: invoice.grand_total }
    }, tx);

    const createdOrdNum = extractOrderNumber(invoice);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoice_number: invoice.invoice_number,
      orderNumber: createdOrdNum,
      order_number: createdOrdNum,
      invoiceType: data.invoiceType || 'RETAIL',
      createdAt: invoice.created_at,
      subtotalAmount: Number(invoice.subtotal),
      taxAmount: Number(totalCgst + totalSgst),
      discountAmount: Number(overallDiscount),
      paidAmount: Number(invoice.paid_amount),
      paymentMethod: selectedPaymentMethod || (isCredit ? 'CREDIT' : 'CASH'),
      payment_method: selectedPaymentMethod || (isCredit ? 'CREDIT' : 'CASH'),
      paymentMode: selectedPaymentMethod || (isCredit ? 'CREDIT' : 'CASH'),
      payment_mode: selectedPaymentMethod || (isCredit ? 'CREDIT' : 'CASH'),
      customer: customer ? { name: customer.name, phone: customer.phone } : null,
      items: preparedItems.map(i => ({
        product_id: i.product_id,
        productId: i.product_id,
        variant_id: i.variant_id,
        variantId: i.variant_id,
        name: i.product_name,
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        unit_price: Number(i.unit_price),
        taxRate: Number(i.gst_percentage),
        totalAmount: Number(i.total_amount)
      })),
      sale_items: preparedItems.map(i => ({
        product_id: i.product_id,
        productId: i.product_id,
        variant_id: i.variant_id,
        variantId: i.variant_id,
        name: i.product_name,
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        unit_price: Number(i.unit_price),
        taxRate: Number(i.gst_percentage),
        totalAmount: Number(i.total_amount)
      }))
    };
  });

  // Post-transaction notifications (Async - never blocks API response or rolls back sale)
  setTimeout(async () => {
    try {
      // 1. Send Sale Invoice Email to Customer
      const emailResult = await sendSaleInvoiceEmail(business_id, saleResult.id);
      if (emailResult && emailResult.success) {
        console.log(`✉️ Sale Invoice email queued/sent for ${saleResult.invoiceNumber}`);
      }

      // 2. Trigger WhatsApp Order Receipt with Invoice PDF (Official Meta Template: vexa_order_receipt)
      const WhatsAppTemplateService = require('./whatsappTemplateService');
      WhatsAppTemplateService.sendOrderReceipt({ saleId: saleResult.id })
        .then(res => console.log(`📱 WhatsApp Order Receipt triggered for ${saleResult.invoiceNumber}:`, res))
        .catch(err => console.error('WhatsApp Order Receipt trigger error:', err.message));

      // 3. Trigger WhatsApp Thank You for Purchasing (Utility Template: vexa_thank_you_purchase)
      WhatsAppTemplateService.sendThankYouForPurchase({ saleId: saleResult.id })
        .catch(err => console.error('WhatsApp Thank You trigger error:', err.message));

      // 4. Check Low Stock on sold products & trigger WhatsApp Low Stock Alert (Template: vexa_low_stock_alert)
      const { getCurrentStock } = require('./stock.service');
      let hasLowStock = false;
      const checkedProdIds = new Set();

      for (const item of (saleResult.items || saleResult.sale_items || [])) {
        const prodId = item.product_id || item.productId;
        if (!prodId || checkedProdIds.has(prodId)) continue;
        checkedProdIds.add(prodId);

        try {
          const prod = await prisma.products.findUnique({
            where: { id: prodId }
          });
          if (prod) {
            const stockRes = await getCurrentStock(business_id, { limit: 1000 });
            const stockObj = (stockRes.stock || []).find(s => s.id === prodId);
            const currentStock = stockObj ? Number(stockObj.stockQuantity || 0) : 0;
            const minStock = Number(prod.minimum_stock ?? prod.min_stock_level ?? 0);

            if (minStock > 0 && currentStock <= minStock) {
              console.log(`⚠️ Low Stock reached for ${prod.name} (Current: ${currentStock} <= Min: ${minStock}). Triggering WhatsApp Alert.`);
              WhatsAppTemplateService.sendLowStockAlert({
                businessId: business_id,
                productId: prodId,
                currentStockOverride: currentStock
              })
                .then(r => console.log('📱 WhatsApp Low Stock Alert dispatch:', r))
                .catch(err => console.error('WhatsApp Low Stock trigger error:', err.message));
              hasLowStock = true;
            }
          }
        } catch (itemStockErr) {
          console.error('Error checking item stock for WhatsApp alert:', itemStockErr.message);
        }
      }

      if (hasLowStock) {
        await sendLowStockAlert(business_id);
      }
    } catch (notifErr) {
      console.error('Async sale notification background task error:', notifErr.message);
    }
  }, 10);

  return saleResult;
};

const returnSale = async (business_id, saleId, user_id, returnData = {}) => {
  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sales.findFirst({
      where: { id: saleId, business_id },
      include: {
        sale_items: {
          include: { products: true, product_variants: true }
        },
        customers: true,
        sale_payments: true
      }
    });

    if (!sale) {
      const err = new Error('Sale invoice not found');
      err.statusCode = 404;
      throw err;
    }

    // 1. Fetch previous return stock transactions for this sale to compute existing returned quantities
    const prevReturnTxs = await tx.stock_transactions.findMany({
      where: {
        business_id,
        transaction_type: 'SALE_RETURN',
        OR: [
          { reference_id: sale.id },
          { reference_number: sale.invoice_number }
        ]
      }
    });

    const items = returnData.returned_items || returnData.items || [];
    if (!items.length) {
      const err = new Error('Please select at least one item and quantity to return');
      err.statusCode = 400;
      throw err;
    }

    const returnRefNumber = `RET-${Date.now().toString().slice(-6)}`;
    const refundMethod = returnData.refund_method || 'CASH';
    const refundStatus = returnData.refund_status || 'COMPLETED';
    const reasonText = returnData.reason || 'Customer Return';

    let totalEligibleRefund = 0;
    const processedReturnedItems = [];

    // 2. Validate return quantities and calculate item-level refund amount
    for (const item of items) {
      const requestedQty = parseFloat(item.quantity || 0);
      if (requestedQty <= 0) continue;

      const rawProdId = item.product_id || item.productId;
      const rawVarId = item.variant_id || item.variantId || null;

      // Find original sale_item
      const matchedSaleItem = (sale.sale_items || []).find(si =>
        si.id === rawProdId ||
        si.product_id === rawProdId ||
        (si.variant_id && si.variant_id === rawProdId) ||
        (si.product_id === rawProdId && (!rawVarId || si.variant_id === rawVarId))
      );

      if (!matchedSaleItem) {
        const err = new Error(`Item ${rawProdId} is not part of original invoice ${sale.invoice_number}`);
        err.statusCode = 400;
        throw err;
      }

      const origQty = Number(matchedSaleItem.quantity || 1);
      
      // Calculate how much was already returned for this item
      const prevReturnedQty = prevReturnTxs
        .filter(tx => 
          (matchedSaleItem.product_id && tx.product_id === matchedSaleItem.product_id) &&
          (!matchedSaleItem.variant_id || tx.variant_id === matchedSaleItem.variant_id)
        )
        .reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);

      const maxReturnableQty = Math.max(0, origQty - prevReturnedQty);
      if (requestedQty > maxReturnableQty) {
        const err = new Error(`Return quantity for "${matchedSaleItem.product_name}" exceeds returnable limit. Remaining returnable: ${maxReturnableQty} PCS, Requested: ${requestedQty} PCS`);
        err.statusCode = 400;
        throw err;
      }

      // Proportional net item refund per unit (includes discounts & GST as originally billed)
      const lineTotalAmount = Number(matchedSaleItem.total_amount || 0);
      const unitRefundRate = origQty > 0 ? (lineTotalAmount / origQty) : Number(matchedSaleItem.unit_price || 0);
      const lineRefundAmount = Number((unitRefundRate * requestedQty).toFixed(2));
      totalEligibleRefund += lineRefundAmount;

      const targetProductId = matchedSaleItem.product_id;
      const targetVariantId = matchedSaleItem.variant_id || null;

      // 3. Create Stock Transaction for SALE_RETURN (+ Positive quantity restores inventory)
      await tx.stock_transactions.create({
        data: {
          business_id,
          product_id: targetProductId,
          variant_id: targetVariantId,
          transaction_type: 'SALE_RETURN',
          quantity: requestedQty,
          reference_id: sale.id,
          reference_number: sale.invoice_number,
          notes: `Return [${returnRefNumber}] (${reasonText}): Restocked ${requestedQty} PCS. Refund: ₹${lineRefundAmount.toFixed(2)} via ${refundMethod} (${refundStatus})`,
          created_by: user_id || null
        }
      });

      // 4. Increment Product Variant Stock if variant exists
      if (targetVariantId) {
        try {
          await tx.product_variants.update({
            where: { id: targetVariantId },
            data: { current_stock: { increment: requestedQty } }
          });
        } catch (varErr) {
          console.warn('Could not increment variant stock:', varErr.message);
        }
      }

      // 5. Increment product_stock record for product/variant
      try {
        const existingStock = await tx.product_stock.findFirst({
          where: { business_id, product_id: targetProductId, variant_id: targetVariantId }
        });
        if (existingStock) {
          await tx.product_stock.update({
            where: { id: existingStock.id },
            data: { quantity: { increment: requestedQty } }
          });
        } else {
          await tx.product_stock.create({
            data: {
              business_id,
              product_id: targetProductId,
              variant_id: targetVariantId,
              quantity: requestedQty
            }
          });
        }
      } catch (stErr) {
        console.warn('Could not update product_stock on return:', stErr.message);
      }

      processedReturnedItems.push({
        product_id: targetProductId,
        variant_id: targetVariantId,
        product_name: matchedSaleItem.product_name,
        quantity: requestedQty,
        unit_refund_price: unitRefundRate,
        line_refund_amount: lineRefundAmount
      });
    }

    totalEligibleRefund = Number(totalEligibleRefund.toFixed(2));

    // 6. Update Customer ledger / balance if sale has customer
    if (sale.customer_id) {
      if (refundMethod === 'CREDIT' || refundMethod === 'STORE_CREDIT') {
        // Return credited to customer ledger (reduces their outstanding debt)
        await tx.customers.update({
          where: { id: sale.customer_id },
          data: { current_balance: { decrement: totalEligibleRefund } }
        });
      }

      // Record customer payment entry for refund if completed
      if (refundStatus === 'COMPLETED') {
        const validPaymentMethod = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'].includes(refundMethod) ? refundMethod : 'CASH';
        try {
          await tx.customer_payments.create({
            data: {
              business_id,
              customer_id: sale.customer_id,
              sale_id: sale.id,
              amount: -totalEligibleRefund, // Negative payment indicates payout/refund to customer
              payment_method: validPaymentMethod,
              reference_number: returnRefNumber,
              notes: `Customer Refund [${returnRefNumber}] for ${sale.invoice_number}: ${reasonText} via ${refundMethod}`,
              created_by: user_id || null
            }
          });
        } catch (cpErr) {
          console.warn('Could not create customer_payments refund record:', cpErr.message);
        }
      }
    }

    // 7. Calculate overall return status of the original invoice
    let allReturned = true;
    for (const si of sale.sale_items || []) {
      const prevQty = prevReturnTxs
        .filter(tx => 
          (si.product_id && tx.product_id === si.product_id) &&
          (!si.variant_id || tx.variant_id === si.variant_id)
        )
        .reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);

      const thisReturnItem = processedReturnedItems.find(it =>
        it.product_id === si.product_id && (!si.variant_id || it.variant_id === si.variant_id)
      );
      const currQty = thisReturnItem ? thisReturnItem.quantity : 0;
      const totalReturnedSoFar = prevQty + currQty;

      if (totalReturnedSoFar < Number(si.quantity || 1)) {
        allReturned = false;
      }
    }

    const returnStatus = allReturned ? 'RETURNED' : 'PARTIAL_RETURN';

    // 8. Build structured return record log in sale.notes
    const returnRecord = {
      returnRef: returnRefNumber,
      returnStatus, // 'RETURNED' or 'PARTIAL_RETURN'
      refundMethod,
      refundStatus,
      refundAmount: totalEligibleRefund,
      reason: reasonText,
      returnedAt: new Date().toISOString(),
      items: processedReturnedItems
    };

    const existingNotes = sale.notes || '';
    const updatedNotes = existingNotes
      ? `${existingNotes} | [RETURN_LOG]:${JSON.stringify(returnRecord)}`
      : `[RETURN_LOG]:${JSON.stringify(returnRecord)}`;

    // sales.status is an enum: DRAFT | CONFIRMED | CANCELLED
    // Maintain invoice CONFIRMED status and track return state via [RETURN_LOG] notes
    await tx.sales.update({
      where: { id: saleId },
      data: {
        status: sale.status || 'CONFIRMED',
        notes: updatedNotes
      }
    });

    // 9. Record audit trail
    await logAudit({
      business_id,
      user_id,
      action: 'SALE_RETURN_PROCESSED',
      module: 'SALES',
      reference_id: sale.id,
      new_data: {
        returnRef: returnRefNumber,
        invoice_number: sale.invoice_number,
        refundAmount: totalEligibleRefund,
        refundMethod,
        refundStatus,
        returnedItems: processedReturnedItems
      }
    }, tx);

    return {
      success: true,
      message: `Return and refund of ₹${totalEligibleRefund.toFixed(2)} processed successfully via ${refundMethod}`,
      returnReference: returnRefNumber,
      invoiceNumber: sale.invoice_number,
      refundAmount: totalEligibleRefund,
      refundMethod,
      refundStatus,
      returnedItems: processedReturnedItems,
      customer: sale.customers ? {
        name: sale.customers.name,
        phone: sale.customers.phone
      } : { name: 'Walk-in Customer' }
    };
  });
};

const deleteSale = async (business_id, saleId, user_id) => {
  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sales.findFirst({
      where: { id: saleId, business_id },
      include: {
        sale_items: true,
        customers: true
      }
    });

    if (!sale) {
      const err = new Error('Sale invoice not found');
      err.statusCode = 404;
      throw err;
    }

    // 1. Revert inventory quantities for items in the sale if not already returned
    if (sale.status !== 'CANCELLED') {
      for (const item of sale.sale_items) {
        if (item.quantity > 0) {
          const qty = Number(item.quantity);
          if (item.variant_id) {
            try {
              await tx.product_variants.update({
                where: { id: item.variant_id },
                data: { current_stock: { increment: qty } }
              });
            } catch (e) {}
          }
          if (item.product_id) {
            try {
              const existingStock = await tx.product_stock.findFirst({
                where: { business_id, product_id: item.product_id, variant_id: item.variant_id || null }
              });
              if (existingStock) {
                await tx.product_stock.update({
                  where: { id: existingStock.id },
                  data: { quantity: { increment: qty } }
                });
              } else {
                await tx.product_stock.create({
                  data: {
                    business_id,
                    product_id: item.product_id,
                    variant_id: item.variant_id || null,
                    quantity: qty
                  }
                });
              }
            } catch (e) {}

            try {
              await tx.stock_transactions.create({
                data: {
                  business_id,
                  product_id: item.product_id,
                  variant_id: item.variant_id || null,
                  transaction_type: 'ADJUSTMENT_IN',
                  quantity: qty,
                  reference_id: sale.id,
                  reference_number: sale.invoice_number,
                  notes: `Invoice Deleted (${sale.invoice_number}): Restocked inventory`,
                  created_by: user_id || null
                }
              });
            } catch (e) {}
          }
        }
      }
    }

    // 2. Adjust customer balance if balance was due
    const balanceAmt = Number(sale.balance_amount || 0);
    if (sale.customer_id && balanceAmt !== 0) {
      try {
        await tx.customers.update({
          where: { id: sale.customer_id },
          data: { current_balance: { decrement: balanceAmt } }
        });
      } catch (e) {}
    }

    // 3. Delete dependent sale payments, items, and sales record
    await tx.sale_payments.deleteMany({ where: { sale_id: saleId } });
    await tx.sale_items.deleteMany({ where: { sale_id: saleId } });
    await tx.sales.delete({ where: { id: saleId } });

    await logAudit(business_id, user_id, 'DELETE', 'sales', saleId, { invoice_number: sale.invoice_number });

    return { message: `Invoice ${sale.invoice_number} deleted successfully`, saleId };
  });
};

module.exports = {
  getSales,
  getSaleById,
  getNextNumber,
  createSale,
  returnSale,
  deleteSale
};
