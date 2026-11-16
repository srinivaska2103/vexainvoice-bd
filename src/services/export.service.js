const ExcelJS = require('exceljs');
const prisma = require('../config/db');
const { logAudit } = require('./audit.service');

/**
 * Format date to YYYY-MM-DD string
 */
const formatDateStr = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Helper to apply common professional Excel styling
 */
const applyStandardSheetStyling = (worksheet, headers, rowsData, companyInfo, reportTitle) => {
  let currentRow = 1;

  // Header Block: Company Info & Report Title
  if (companyInfo) {
    const compNameCell = worksheet.getCell(`A${currentRow}`);
    compNameCell.value = companyInfo.business_name || 'VEXA Invoice';
    compNameCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    currentRow++;

    const compTypeCell = worksheet.getCell(`A${currentRow}`);
    compTypeCell.value = `Company ID: ${companyInfo.business_id} | Type: ${companyInfo.business_type || 'GARMENT_TEXTILE'}`;
    compTypeCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    currentRow++;
  }

  const titleCell = worksheet.getCell(`A${currentRow}`);
  titleCell.value = `${reportTitle} - Generated on ${new Date().toLocaleString()}`;
  titleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF2563EB' } };
  currentRow += 2;

  // Header Row
  const headerRowIndex = currentRow;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E40AF' } // Deep Blue
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  });

  // Freeze Header Row
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: headerRowIndex }
  ];

  // Data Rows
  rowsData.forEach((rowValues, idx) => {
    const rIndex = headerRowIndex + 1 + idx;
    const row = worksheet.getRow(rIndex);
    row.values = rowValues;
    row.height = 20;

    const isEven = idx % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }
        };
      }

      // Check number format
      if (typeof cell.value === 'number') {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (Number.isInteger(cell.value)) {
          cell.numFmt = '#,##0';
        } else {
          cell.numFmt = '#,##0.00';
        }
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });
  });

  // Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellVal = cell.value !== undefined && cell.value !== null ? cell.value.toString() : '';
      if (cellVal.length > maxLength) {
        maxLength = Math.min(cellVal.length + 3, 45);
      }
    });
    column.width = maxLength;
  });

  // Enable Auto Filter
  const lastRow = headerRowIndex + rowsData.length;
  const lastCol = String.fromCharCode(64 + headers.length);
  worksheet.autoFilter = `A${headerRowIndex}:${lastCol}${Math.max(lastRow, headerRowIndex)}`;
};

/**
 * Fetch and prepare Sales Transactions data
 */
const fetchSalesTransactions = async (business_id, queryParams = {}) => {
  const { search, customer_id, startDate, endDate, status } = queryParams;

  const where = {
    business_id,
    ...(customer_id ? { customer_id } : {}),
    ...(status ? { status } : {}),
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

  const sales = await prisma.sales.findMany({
    where,
    orderBy: { invoice_date: 'desc' },
    include: {
      customers: true,
      sale_payments: true,
      sale_items: true
    }
  });

  const headers = [
    'Order Reference',
    'Invoice Number',
    'Invoice Date',
    'Customer Name',
    'Customer Phone',
    'Customer Type',
    'GST Type',
    'Subtotal',
    'Trade Discount',
    'Scheme Discount',
    'Cash Discount',
    'Less',
    'Taxable Amount',
    'CGST',
    'SGST',
    'IGST',
    'GST Amount',
    'Round Off',
    'Grand Total',
    'Paid Amount',
    'Outstanding Amount',
    'Payment Status',
    'Payment Method',
    'Sales Status'
  ];

  const rows = sales.map((inv) => {
    let orderNum = '';
    let tradeDisc = 0, schemeDisc = 0, cashDisc = 0, lessAmt = 0;
    if (inv.notes) {
      const match = inv.notes.match(/ORDER_REF:([^\s|]+)/);
      if (match && match[1]) orderNum = match[1];

      const discMatch = inv.notes.match(/DISCOUNTS:(\{.*\})/);
      if (discMatch && discMatch[1]) {
        try {
          const dObj = JSON.parse(discMatch[1]);
          tradeDisc = Number(dObj.tradeDiscount || 0);
          schemeDisc = Number(dObj.schemeDiscount || 0);
          cashDisc = Number(dObj.cashDiscount || 0);
          lessAmt = Number(dObj.lessAmount || 0);
        } catch (e) {}
      }
    }
    if (!orderNum) {
      orderNum = inv.invoice_number ? inv.invoice_number.replace('INV-', 'ORD-') : 'ORD-2026-001';
    }

    const subtotal = Number(inv.subtotal || 0);
    const cgst = Number(inv.cgst_amount || 0);
    const sgst = Number(inv.sgst_amount || 0);
    const igst = Number(inv.igst_amount || 0);
    const gstTotal = cgst + sgst + igst;
    const taxable = Number(inv.taxable_amount || (subtotal - (tradeDisc + schemeDisc + cashDisc)));
    const roundOff = Number(inv.round_off || 0);
    const grandTotal = Number(inv.grand_total || 0);
    const paidAmt = Number(inv.paid_amount || 0);
    const outstanding = Number(inv.balance_amount || (grandTotal - paidAmt));
    const payStatus = outstanding <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'DUE');
    const isIgst = igst > 0;

    return [
      orderNum,
      inv.invoice_number,
      formatDateStr(inv.invoice_date || inv.created_at),
      inv.customers?.name || 'Walk-in Customer',
      inv.customers?.phone || 'N/A',
      inv.customers?.customer_type || 'RETAIL',
      isIgst ? 'IGST (Interstate)' : 'CGST/SGST (Intrastate)',
      subtotal,
      tradeDisc,
      schemeDisc,
      cashDisc,
      lessAmt,
      taxable,
      cgst,
      sgst,
      igst,
      gstTotal,
      roundOff,
      grandTotal,
      paidAmt,
      outstanding,
      payStatus,
      inv.sale_payments[0]?.payment_method || 'CASH',
      inv.status || 'CONFIRMED'
    ];
  });

  return { headers, rows };
};

/**
 * Fetch and prepare Sales Returns data
 */
const fetchSalesReturns = async (business_id, queryParams = {}) => {
  const { search, startDate, endDate } = queryParams;

  const where = {
    business_id,
    OR: [
      { status: 'CANCELLED' },
      { notes: { contains: '[RETURNED]', mode: 'insensitive' } }
    ],
    ...(search ? {
      OR: [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } }
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

  const returnedSales = await prisma.sales.findMany({
    where,
    orderBy: { updated_at: 'desc' },
    include: {
      customers: true,
      sale_items: {
        include: {
          products: true,
          product_variants: {
            include: { colors: true, sizes: true }
          }
        }
      }
    }
  });

  const headers = [
    'Return Number',
    'Original Order Reference',
    'Original Invoice Number',
    'Return Date',
    'Customer Name',
    'Customer Phone',
    'Product Name',
    'Variant',
    'SKU',
    'Color',
    'Size',
    'Returned Quantity',
    'Return Amount',
    'Reason',
    'Status'
  ];

  const rows = [];
  returnedSales.forEach((s, idx) => {
    let orderNum = '';
    let reason = 'Customer Return';
    if (s.notes) {
      const match = s.notes.match(/ORDER_REF:([^\s|]+)/);
      if (match && match[1]) orderNum = match[1];

      const rMatch = s.notes.match(/\[RETURNED\]:\s*([^|]+)/);
      if (rMatch && rMatch[1]) reason = rMatch[1].trim();
    }
    if (!orderNum) orderNum = s.invoice_number ? s.invoice_number.replace('INV-', 'ORD-') : 'ORD-2026-001';

    const retNo = `RET-${formatDateStr(s.updated_at || s.created_at).replace(/-/g, '')}-${String(idx + 1).padStart(3, '0')}`;

    if (s.sale_items && s.sale_items.length > 0) {
      s.sale_items.forEach((item) => {
        const pName = item.product_name || item.products?.name || 'Item';
        const variantObj = item.product_variants;
        const color = variantObj?.colors?.name || variantObj?.color || item.color || 'N/A';
        const size = variantObj?.sizes?.name || variantObj?.size || item.size || 'N/A';
        const vLabel = variantObj?.variant_name || (color !== 'N/A' || size !== 'N/A' ? `${color} / ${size}` : 'Standard');
        const sku = item.sku || variantObj?.sku || item.products?.sku || 'N/A';
        const qty = Number(item.quantity || 0);
        const amount = Number(item.total_amount || (qty * Number(item.unit_price || 0)));

        rows.push([
          retNo,
          orderNum,
          s.invoice_number,
          formatDateStr(s.updated_at || s.created_at),
          s.customers?.name || 'Walk-in Customer',
          s.customers?.phone || 'N/A',
          pName,
          vLabel,
          sku,
          color,
          size,
          qty,
          amount,
          reason,
          'COMPLETED'
        ]);
      });
    } else {
      rows.push([
        retNo,
        orderNum,
        s.invoice_number,
        formatDateStr(s.updated_at || s.created_at),
        s.customers?.name || 'Walk-in Customer',
        s.customers?.phone || 'N/A',
        'Invoice Return',
        'N/A',
        'N/A',
        'N/A',
        'N/A',
        1,
        Number(s.grand_total || 0),
        reason,
        'COMPLETED'
      ]);
    }
  });

  return { headers, rows };
};

/**
 * Fetch and prepare Product-Wise Sales data
 */
const fetchProductWiseSales = async (business_id, queryParams = {}) => {
  const { startDate, endDate } = queryParams;

  const where = { business_id, status: { not: 'CANCELLED' } };
  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);
    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);
    where.invoice_date = { gte: s, lte: e };
  }

  const invoices = await prisma.sales.findMany({
    where,
    include: {
      sale_items: {
        include: {
          products: {
            include: { categories: true, brands: true }
          },
          product_variants: {
            include: { colors: true, sizes: true }
          }
        }
      }
    }
  });

  const productMap = new Map();

  for (const inv of invoices) {
    if (!inv.sale_items) continue;
    for (const item of inv.sale_items) {
      const prod = item.products;
      const variantObj = item.product_variants;
      const key = variantObj ? `${item.product_id}_${variantObj.id}` : `${item.product_id}_base`;

      const prodName = item.product_name || prod?.name || 'Unknown Product';
      const brand = prod?.brands?.name || prod?.brand || 'N/A';
      const category = prod?.categories?.name || prod?.category || 'N/A';
      const color = variantObj?.colors?.name || variantObj?.color || 'N/A';
      const size = variantObj?.sizes?.name || variantObj?.size || 'N/A';
      const variantName = variantObj?.variant_name || (color !== 'N/A' || size !== 'N/A' ? `${color} / ${size}` : 'Standard');
      const sku = item.sku || variantObj?.sku || prod?.sku || 'N/A';

      const qty = Number(item.quantity || 0);
      const gross = qty * Number(item.unit_price || 0);
      const discount = Number(item.discount_amount || 0);
      const taxable = Number(item.taxable_amount || Math.max(0, gross - discount));
      const gst = Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
      const net = Number(item.total_amount || (taxable + gst));

      if (!productMap.has(key)) {
        productMap.set(key, {
          prodName,
          brand,
          category,
          variantName,
          color,
          size,
          sku,
          totalQty: 0,
          grossSales: 0,
          discounts: 0,
          taxableSales: 0,
          gstAmount: 0,
          netSales: 0
        });
      }

      const pData = productMap.get(key);
      pData.totalQty += qty;
      pData.grossSales += gross;
      pData.discounts += discount;
      pData.taxableSales += taxable;
      pData.gstAmount += gst;
      pData.netSales += net;
    }
  }

  const headers = [
    'Product Name',
    'Brand',
    'Category',
    'Variant',
    'Color',
    'Size',
    'SKU',
    'Total Quantity Sold',
    'Gross Sales',
    'Discounts',
    'Taxable Sales',
    'GST',
    'Net Sales'
  ];

  const rows = Array.from(productMap.values()).map(p => [
    p.prodName,
    p.brand,
    p.category,
    p.variantName,
    p.color,
    p.size,
    p.sku,
    p.totalQty,
    p.grossSales,
    p.discounts,
    p.taxableSales,
    p.gstAmount,
    p.netSales
  ]);

  return { headers, rows };
};

/**
 * Fetch and prepare Customer-Wise Sales data
 */
const fetchCustomerWiseSales = async (business_id, queryParams = {}) => {
  const { startDate, endDate } = queryParams;

  const where = { business_id, status: { not: 'CANCELLED' } };
  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);
    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);
    where.invoice_date = { gte: s, lte: e };
  }

  const invoices = await prisma.sales.findMany({
    where,
    include: {
      customers: true,
      sale_items: true
    },
    orderBy: { invoice_date: 'desc' }
  });

  const customerMap = new Map();

  for (const inv of invoices) {
    const cId = inv.customer_id || 'WALK_IN';
    const cName = inv.customers?.name || 'Walk-in / Retail Customer';
    const cCode = inv.customers?.id ? `CUST-${inv.customers.id.slice(0, 8).toUpperCase()}` : 'WALK-IN';
    const cType = inv.customers?.customer_type || 'RETAIL';
    const mobile = inv.customers?.phone || 'N/A';
    const email = inv.customers?.email || 'N/A';
    const gstin = inv.customers?.gst_number || 'N/A';

    const grandTotal = Number(inv.grand_total || 0);
    const paid = Number(inv.paid_amount || 0);
    const outstanding = Number(inv.balance_amount || (grandTotal - paid));
    const invQty = inv.sale_items ? inv.sale_items.reduce((sum, i) => sum + Number(i.quantity || 0), 0) : 0;
    const invDateStr = formatDateStr(inv.invoice_date || inv.created_at);

    if (!customerMap.has(cId)) {
      customerMap.set(cId, {
        cName,
        cCode,
        cType,
        mobile,
        email,
        gstin,
        totalOrders: 0,
        totalQty: 0,
        totalSales: 0,
        totalPaid: 0,
        totalOutstanding: Number(inv.customers?.current_balance || 0),
        lastSaleDate: invDateStr
      });
    }

    const cData = customerMap.get(cId);
    cData.totalOrders += 1;
    cData.totalQty += invQty;
    cData.totalSales += grandTotal;
    cData.totalPaid += paid;
    if (!cData.lastSaleDate) cData.lastSaleDate = invDateStr;
  }

  const headers = [
    'Customer Name',
    'Customer Code',
    'Customer Type',
    'Mobile',
    'Email',
    'GSTIN',
    'Total Orders',
    'Total Quantity',
    'Total Sales',
    'Total Paid',
    'Total Outstanding',
    'Last Sale Date'
  ];

  const rows = Array.from(customerMap.values()).map(c => [
    c.cName,
    c.cCode,
    c.cType,
    c.mobile,
    c.email,
    c.gstin,
    c.totalOrders,
    c.totalQty,
    c.totalSales,
    c.totalPaid,
    c.totalOutstanding,
    c.lastSaleDate
  ]);

  return { headers, rows };
};

/**
 * Fetch and prepare Current Sales View data (Itemized line items with returned & remaining quantities)
 */
const fetchCurrentViewSales = async (business_id, queryParams = {}) => {
  const { search, customerType, status, paymentStatus, paymentMethod, startDate, endDate } = queryParams;

  const where = {
    business_id,
    ...(customerType && customerType !== 'ALL' ? { customers: { customer_type: customerType } } : {}),
    ...(status ? { status } : {}),
    ...(search ? {
      OR: [
        { invoice_number: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } },
        { customers: { phone: { contains: search, mode: 'insensitive' } } },
        { sale_items: { some: { product_name: { contains: search, mode: 'insensitive' } } } }
      ]
    } : {})
  };

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

  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);
    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);
    where.invoice_date = { gte: s, lte: e };
  }

  const invoices = await prisma.sales.findMany({
    where,
    orderBy: { invoice_date: 'desc' },
    include: {
      customers: true,
      sale_payments: true,
      sale_items: {
        include: {
          products: true,
          product_variants: { include: { colors: true, sizes: true } }
        }
      }
    }
  });

  const saleIds = invoices.map(i => i.id);
  const invNumbers = invoices.map(i => i.invoice_number).filter(Boolean);

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
  } catch (err) {}

  const returnsMap = new Map();
  returnTxs.forEach((tx) => {
    const key = tx.reference_id || tx.reference_number;
    if (!returnsMap.has(key)) returnsMap.set(key, []);
    returnsMap.get(key).push(tx);
  });

  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Customer Name',
    'Customer Phone',
    'Customer Type',
    'Product Name',
    'Variant / Specs',
    'Original Qty',
    'Returned Qty',
    'Remaining Qty',
    'Unit Price',
    'GST %',
    'Total Item Amount',
    'Invoice Total',
    'Paid Amount',
    'Outstanding Balance',
    'Invoice Status'
  ];

  const rows = [];
  invoices.forEach((inv) => {
    const custName = inv.customers?.name || 'Walk-in Customer';
    const custPhone = inv.customers?.phone || 'N/A';
    const custType = inv.customers?.customer_type || 'RETAIL';
    const invDateStr = formatDateStr(inv.invoice_date || inv.created_at);
    const grandTotal = Number(inv.grand_total || 0);
    const paidAmt = Number(inv.paid_amount || 0);
    const outstanding = Number(inv.balance_amount || (grandTotal - paidAmt));
    const status = inv.status || 'CONFIRMED';
    const saleReturnTxs = (returnsMap.get(inv.id) || []).concat(returnsMap.get(inv.invoice_number) || []);

    if (inv.sale_items && inv.sale_items.length > 0) {
      inv.sale_items.forEach((item) => {
        const itemReturns = saleReturnTxs.filter(tx => 
          (item.product_id && tx.product_id === item.product_id) ||
          (item.variant_id && tx.variant_id === item.variant_id)
        );
        const retQty = itemReturns.reduce((sum, tx) => sum + Number(tx.quantity || 0), 0);
        const origQty = Number(item.quantity || 1);
        const remQty = Math.max(0, origQty - retQty);

        const pName = item.product_name || item.products?.name || 'Product Item';
        const vObj = item.product_variants;
        const color = vObj?.colors?.name || vObj?.color || item.color;
        const size = vObj?.sizes?.name || vObj?.size || item.size;
        const variantText = [color, size].filter(Boolean).join(' / ') || vObj?.variant_name || 'Standard';

        rows.push([
          inv.invoice_number,
          invDateStr,
          custName,
          custPhone,
          custType,
          pName,
          variantText,
          origQty,
          retQty,
          remQty,
          Number(item.unit_price || 0),
          Number(item.gst_percentage || 5),
          Number(item.total_amount || (origQty * Number(item.unit_price || 0))),
          grandTotal,
          paidAmt,
          outstanding,
          status
        ]);
      });
    } else {
      rows.push([
        inv.invoice_number,
        invDateStr,
        custName,
        custPhone,
        custType,
        'N/A',
        'Standard',
        1,
        0,
        1,
        grandTotal,
        0,
        grandTotal,
        grandTotal,
        paidAmt,
        outstanding,
        status
      ]);
    }
  });

  return { headers, rows };
};

/**
 * Fetch and prepare Customers Master List data
 */
const fetchCustomersMaster = async (business_id, queryParams = {}) => {
  const { search, customerType } = queryParams;

  const where = {
    business_id,
    is_active: true,
    ...(customerType && customerType !== 'ALL' ? { customer_type: customerType } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { gst_number: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const dbCustomers = await prisma.customers.findMany({
    where,
    orderBy: { name: 'asc' }
  });

  const headers = [
    'Customer Name',
    'Customer Code',
    'Customer Type',
    'Mobile',
    'Email',
    'GSTIN',
    'Billing Address',
    'City',
    'State',
    'Pincode',
    'Opening Balance',
    'Outstanding Balance',
    'Status'
  ];

  const rows = dbCustomers.map(c => [
    c.name,
    `CUST-${c.id.slice(0, 8).toUpperCase()}`,
    c.customer_type || 'RETAIL',
    c.phone || 'N/A',
    c.email || 'N/A',
    c.gst_number || 'N/A',
    c.address || 'N/A',
    c.city || 'N/A',
    c.state || 'N/A',
    c.pincode || 'N/A',
    Number(c.opening_balance || 0),
    Number(c.current_balance || c.opening_balance || 0),
    c.is_active ? 'ACTIVE' : 'INACTIVE'
  ]);

  return { headers, rows };
};

/**
 * Generate Excel Workbook for Sales Report (Multi-sheet or single sheet)
 */
const generateSalesExcelExport = async (business_id, user_id, queryParams = {}) => {
  const { exportType = 'full' } = queryParams;

  const business = await prisma.businesses.findUnique({ where: { id: business_id } });
  const companyInfo = {
    business_id,
    business_name: business?.business_name || 'VEXA Invoice',
    business_type: business?.business_type || 'GARMENT_TEXTILE'
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEXA Invoice Engine';
  workbook.lastModifiedBy = 'VEXA Engine';
  workbook.created = new Date();

  const todayStr = formatDateStr(new Date());

  if (exportType === 'current_view' || exportType === 'transactions' || exportType === 'full') {
    const sheetName = exportType === 'current_view' ? 'Current Sales View' : 'Sales Transactions';
    const sheet = workbook.addWorksheet(sheetName);
    const { headers, rows } = exportType === 'current_view' 
      ? await fetchCurrentViewSales(business_id, queryParams)
      : await fetchSalesTransactions(business_id, queryParams);
    applyStandardSheetStyling(sheet, headers, rows, companyInfo, exportType === 'current_view' ? 'Current Sales & Item Breakdown' : 'Sales Transactions Report');
  }

  if (exportType === 'returns' || exportType === 'full') {
    const sheet = workbook.addWorksheet('Sales Returns');
    const { headers, rows } = await fetchSalesReturns(business_id, queryParams);
    applyStandardSheetStyling(sheet, headers, rows, companyInfo, 'Sales Returns Report');
  }

  if (exportType === 'product_wise' || exportType === 'full') {
    const sheet = workbook.addWorksheet('Product-Wise Sales');
    const { headers, rows } = await fetchProductWiseSales(business_id, queryParams);
    applyStandardSheetStyling(sheet, headers, rows, companyInfo, 'Product-Wise Sales Report');
  }

  if (exportType === 'customer_wise' || exportType === 'full') {
    const sheet = workbook.addWorksheet('Customer-Wise Sales');
    const { headers, rows } = await fetchCustomerWiseSales(business_id, queryParams);
    applyStandardSheetStyling(sheet, headers, rows, companyInfo, 'Customer-Wise Sales Report');
  }

  // Audit Logging
  await logAudit({
    business_id,
    user_id,
    action: 'EXPORT_SALES_EXCEL',
    module: 'REPORTS',
    new_data: { exportType, queryParams }
  });

  const filename = exportType === 'full' 
    ? `Sales_Report_${todayStr}.xlsx`
    : `Sales_${exportType.toUpperCase()}_${todayStr}.xlsx`;

  // Store a copy of the exported Excel file in local system storage (backend/exports)
  try {
    const fs = require('fs');
    const path = require('path');
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const saveFilePath = path.join(exportsDir, filename);
    await workbook.xlsx.writeFile(saveFilePath);
    console.log(`💾 Excel export saved to system storage: ${saveFilePath}`);
  } catch (err) {
    console.error('Failed to save export copy to system storage:', err.message);
  }

  return { workbook, filename };
};

/**
 * Generate Excel Workbook for Customers
 */
const generateCustomersExcelExport = async (business_id, user_id, queryParams = {}) => {
  const business = await prisma.businesses.findUnique({ where: { id: business_id } });
  const companyInfo = {
    business_id,
    business_name: business?.business_name || 'VEXA Invoice',
    business_type: business?.business_type || 'GARMENT_TEXTILE'
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEXA Invoice Engine';
  workbook.created = new Date();

  const todayStr = formatDateStr(new Date());
  const sheet = workbook.addWorksheet('Customers');

  const { headers, rows } = await fetchCustomersMaster(business_id, queryParams);
  applyStandardSheetStyling(sheet, headers, rows, companyInfo, 'Customers & Accounts Directory');

  await logAudit({
    business_id,
    user_id,
    action: 'EXPORT_CUSTOMERS_EXCEL',
    module: 'CUSTOMERS',
    new_data: { queryParams }
  });

  const filename = `Customers_${todayStr}.xlsx`;

  // Store a copy of the exported Excel file in local system storage (backend/exports)
  try {
    const fs = require('fs');
    const path = require('path');
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const saveFilePath = path.join(exportsDir, filename);
    await workbook.xlsx.writeFile(saveFilePath);
    console.log(`💾 Excel export saved to system storage: ${saveFilePath}`);
  } catch (err) {
    console.error('Failed to save export copy to system storage:', err.message);
  }

  return { workbook, filename };
};

module.exports = {
  generateSalesExcelExport,
  generateCustomersExcelExport
};
