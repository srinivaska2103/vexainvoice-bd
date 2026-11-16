const prisma = require('../config/db');

const getDashboardData = async (business_id) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // 1. Today's Sales & Bill Count (Excluding CANCELLED / Returned invoices)
  const todaysSalesAgg = await prisma.sales.aggregate({
    _sum: { grand_total: true },
    _count: { id: true },
    where: {
      business_id,
      status: { not: 'CANCELLED' },
      OR: [
        { invoice_date: { gte: startOfToday, lte: endOfToday } },
        { created_at: { gte: startOfToday, lte: endOfToday } }
      ]
    }
  });

  // 2. Today's Collections
  const todaysPayments = await prisma.customer_payments.aggregate({
    _sum: { amount: true },
    where: {
      business_id,
      payment_date: { gte: startOfToday, lte: endOfToday }
    }
  });

  // 3. Total Customer Outstanding
  const custOutstandingAgg = await prisma.customers.aggregate({
    _sum: { current_balance: true },
    where: {
      business_id,
      is_active: true,
      current_balance: { gt: 0 }
    }
  });

  // 4. Stock Valuation & Low Stock Count using central getCurrentStock
  const { getCurrentStock } = require('./stock.service');
  const stockRes = await getCurrentStock(business_id, { limit: 1000 });
  const stockList = stockRes.stock || [];

  let totalStockValuation = 0;
  let lowStockCount = 0;

  // Query only purchase_price and minimum_stock to calculate totals without full column scans
  const products = await prisma.products.findMany({
    where: { business_id, is_active: true },
    select: { id: true, purchase_price: true, minimum_stock: true }
  });

  const stockMap = new Map(stockList.map(s => [s.id, Number(s.stockQuantity || 0)]));

  for (const p of products) {
    const qty = stockMap.get(p.id) || 0;
    const buyPrice = Number(p.purchase_price || 0);
    totalStockValuation += qty * buyPrice;

    if (qty <= Number(p.minimum_stock || 5)) {
      lowStockCount++;
    }
  }

  return {
    todaySalesAmount: Number(todaysSalesAgg._sum.grand_total || 0),
    todaySalesCount: todaysSalesAgg._count.id || 0,
    todaysSales: Number(todaysSalesAgg._sum.grand_total || 0),
    todaysPurchases: 0,
    todaysCollections: Number(todaysPayments._sum.amount || 0),
    totalCustomerOutstanding: Number(custOutstandingAgg._sum.current_balance || 0),
    customerOutstanding: Number(custOutstandingAgg._sum.current_balance || 0),
    totalSupplierOutstanding: 0,
    totalStockValue: totalStockValuation,
    stockValue: totalStockValuation,
    totalProducts: products.length,
    todaysBillCount: todaysSalesAgg._count.id || 0,
    lowStockCount
  };
};

const getSalesReport = async (business_id, queryParams = {}) => {
  const { startDate, endDate, month, year } = queryParams;

  const where = { business_id, status: { not: 'CANCELLED' } };

  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);

    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);

    where.OR = [
      { invoice_date: { gte: s, lte: e } },
      { created_at: { gte: s, lte: e } }
    ];
  } else if ((month && month !== 'ALL') || (year && year !== 'ALL')) {
    const currentYear = year && year !== 'ALL' ? parseInt(year, 10) : new Date().getFullYear();
    if (month && month !== 'ALL') {
      const m = parseInt(month, 10) - 1;
      const s = new Date(currentYear, m, 1, 0, 0, 0, 0);
      const e = new Date(currentYear, m + 1, 0, 23, 59, 59, 999);
      where.OR = [
        { invoice_date: { gte: s, lte: e } },
        { created_at: { gte: s, lte: e } }
      ];
    } else {
      const s = new Date(currentYear, 0, 1, 0, 0, 0, 0);
      const e = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      where.OR = [
        { invoice_date: { gte: s, lte: e } },
        { created_at: { gte: s, lte: e } }
      ];
    }
  }

  const invoices = await prisma.sales.findMany({
    where,
    include: {
      customers: true,
      sale_items: {
        include: {
          products: true
        }
      }
    },
    orderBy: {
      invoice_date: 'desc'
    }
  });

  let totalSalesAmount = 0;
  let totalSubtotal = 0;
  let totalTaxAmount = 0;
  let totalPaidAmount = 0;
  let totalBalanceAmount = 0;

  const productMap = new Map();
  const customerMap = new Map();
  const monthlyMap = new Map();

  for (const inv of invoices) {
    const invTotal = Number(inv.grand_total || 0);
    const invSubtotal = Number(inv.subtotal || 0);
    const invTax = Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0);
    const invPaid = Number(inv.paid_amount || 0);
    const invBalance = Number(inv.balance_amount || 0);

    totalSalesAmount += invTotal;
    totalSubtotal += invSubtotal;
    totalTaxAmount += invTax;
    totalPaidAmount += invPaid;
    totalBalanceAmount += invBalance;

    // 1. Customer Wise Aggregation
    const customerId = inv.customer_id || 'walk-in';
    const customerName = inv.customers?.name || 'Walk-in / Retail Customer';
    const customerPhone = inv.customers?.phone || 'N/A';
    const customerBal = Number(inv.customers?.current_balance || invBalance || 0);

    if (!customerMap.has(customerId)) {
      customerMap.set(customerId, {
        customer_id: customerId,
        customer_name: customerName,
        phone: customerPhone,
        totalOrders: 0,
        totalSalesAmount: 0,
        paidAmount: 0,
        outstandingBalance: customerBal
      });
    }
    const cData = customerMap.get(customerId);
    cData.totalOrders += 1;
    cData.totalSalesAmount += invTotal;
    cData.paidAmount += invPaid;

    // 2. Product Wise Aggregation
    if (Array.isArray(inv.sale_items)) {
      for (const item of inv.sale_items) {
        const prodId = item.product_id || item.product_name;
        const prodName = item.product_name || item.products?.name || 'Unknown Item';
        const sku = item.sku || item.products?.sku || 'N/A';
        const qty = Number(item.quantity || 0);
        const itemTotal = Number(item.total_amount || (qty * Number(item.unit_price || 0)));

        if (!productMap.has(prodId)) {
          productMap.set(prodId, {
            product_id: prodId,
            product_name: prodName,
            sku,
            quantitySold: 0,
            totalRevenue: 0,
            ordersCount: 0
          });
        }
        const pData = productMap.get(prodId);
        pData.quantitySold += qty;
        pData.totalRevenue += itemTotal;
        pData.ordersCount += 1;
      }
    }

    // 3. Monthly Revenue Aggregation
    const invDate = inv.invoice_date || inv.created_at || new Date();
    const dateObj = new Date(invDate);
    const mYear = dateObj.getFullYear();
    const mMonth = dateObj.getMonth() + 1;
    const mKey = `${mYear}-${String(mMonth).padStart(2, '0')}`;
    const monthName = dateObj.toLocaleString('en-US', { month: 'short' });
    const monthLabel = `${monthName} ${mYear}`;

    if (!monthlyMap.has(mKey)) {
      monthlyMap.set(mKey, {
        key: mKey,
        year: mYear,
        month: mMonth,
        monthLabel,
        invoiceCount: 0,
        totalAmount: 0,
        totalRevenue: 0,
        revenue: 0,
        taxAmount: 0
      });
    }
    const mData = monthlyMap.get(mKey);
    mData.invoiceCount += 1;
    mData.totalAmount += invTotal;
    mData.totalRevenue += invTotal;
    mData.revenue += invTotal;
    mData.taxAmount += invTax;
  }

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

  const formattedSales = invoices.map((inv) => {
    const ordNum = extractOrderNumber(inv);
    const totalAmt = Number(inv.grand_total || 0);
    const paidAmt = Number(inv.paid_amount || 0);
    const balAmt = Number(inv.balance_amount || 0);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      invoice_number: inv.invoice_number,
      orderNumber: ordNum,
      order_number: ordNum,
      invoiceType: inv.invoice_type || 'SALE',
      invoice_type: inv.invoice_type || 'SALE',
      status: inv.status,
      created_at: inv.created_at || inv.invoice_date,
      invoice_date: inv.invoice_date || inv.created_at,
      subtotal: Number(inv.subtotal || 0),
      cgst_amount: Number(inv.cgst_amount || 0),
      sgst_amount: Number(inv.sgst_amount || 0),
      igst_amount: Number(inv.igst_amount || 0),
      taxAmount: Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0),
      discount_amount: Number(inv.discount_amount || 0),
      grand_total: totalAmt,
      totalAmount: totalAmt,
      total_amount: totalAmt,
      paid_amount: paidAmt,
      paidAmount: paidAmt,
      balance_amount: balAmt,
      balanceAmount: balAmt,
      paymentStatus: balAmt <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'DUE'),
      customer: inv.customers ? {
        id: inv.customers.id,
        name: inv.customers.name,
        phone: inv.customers.phone,
        email: inv.customers.email,
        address: inv.customers.address,
        gstin: inv.customers.gst_number
      } : null,
      customers: inv.customers,
      items: (inv.sale_items || []).map(i => ({
        id: i.id,
        product_id: i.product_id,
        productId: i.product_id,
        product_name: i.product_name || i.products?.name || 'Item',
        name: i.product_name || i.products?.name || 'Item',
        sku: i.sku || i.products?.sku || 'N/A',
        quantity: Number(i.quantity || 1),
        unit_price: Number(i.unit_price || 0),
        unitPrice: Number(i.unit_price || 0),
        gst_percentage: Number(i.gst_percentage || 5),
        total_amount: Number(i.total_amount || 0),
        totalAmount: Number(i.total_amount || 0)
      })),
      sale_items: inv.sale_items || []
    };
  });

  const productWiseSales = Array.from(productMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  const customerWiseSales = Array.from(customerMap.values()).sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);
  const monthlyRevenue = Array.from(monthlyMap.values()).sort((a, b) => a.key.localeCompare(b.key));

  return {
    summary: {
      totalInvoices: invoices.length,
      totalSalesAmount,
      totalSubtotal,
      totalTaxAmount,
      totalPaidAmount,
      totalBalanceAmount
    },
    sales: formattedSales,
    productWiseSales,
    customerWiseSales,
    monthlyRevenue,
    data: {
      totalSalesAmount,
      totalInvoices: invoices.length
    }
  };
};

const getPurchaseReport = async (business_id, queryParams = {}) => {
  const { startDate, endDate } = queryParams;
  const where = { business_id };

  if (startDate || endDate) {
    const s = startDate ? new Date(startDate) : new Date(0);
    if (startDate && !isNaN(s.getTime())) s.setHours(0, 0, 0, 0);

    const e = endDate ? new Date(endDate) : new Date();
    if (endDate && !isNaN(e.getTime())) e.setHours(23, 59, 59, 999);

    where.OR = [
      { purchase_date: { gte: s, lte: e } },
      { created_at: { gte: s, lte: e } }
    ];
  }

  const purchases = await prisma.purchases.findMany({
    where,
    include: {
      suppliers: true,
      purchase_items: {
        include: {
          products: true
        }
      }
    },
    orderBy: { purchase_date: 'desc' }
  });

  const totalPurchaseAmount = purchases.reduce((acc, p) => acc + Number(p.grand_total || 0), 0);
  const totalPaidAmount = purchases.reduce((acc, p) => acc + Number(p.paid_amount || 0), 0);
  const totalBalanceAmount = purchases.reduce((acc, p) => acc + Number(p.balance_amount || 0), 0);

  return {
    summary: {
      totalPurchasesCount: purchases.length,
      totalPurchaseAmount,
      totalPaidAmount,
      totalBalanceAmount
    },
    purchases,
    data: {
      totalPurchasesCount: purchases.length,
      totalPurchaseAmount
    }
  };
};

const getStockValuationReport = async (business_id) => {
  const products = await prisma.products.findMany({
    where: { business_id, is_active: true }
  });

  let totalStockValuation = 0;
  let lowStockCount = 0;

  for (const p of products) {
    const agg = await prisma.stock_transactions.aggregate({
      where: { business_id, product_id: p.id },
      _sum: { quantity: true }
    });
    const qty = Number(agg._sum.quantity || 0);
    const buyPrice = Number(p.purchase_price || 0);
    totalStockValuation += qty * buyPrice;

    if (qty <= Number(p.minimum_stock || 5)) {
      lowStockCount++;
    }
  }

  return {
    summary: { totalProducts: products.length, totalStockValue: totalStockValuation, lowStockCount },
    data: { stockValue: totalStockValuation, lowStockCount, totalProducts: products.length }
  };
};

const getGstReport = async (business_id) => {
  const salesAgg = await prisma.sales.aggregate({
    where: { business_id },
    _sum: { taxable_amount: true, cgst_amount: true, sgst_amount: true, igst_amount: true, grand_total: true }
  });
  const cgst = Number(salesAgg._sum.cgst_amount || 0);
  const sgst = Number(salesAgg._sum.sgst_amount || 0);
  const igst = Number(salesAgg._sum.igst_amount || 0);
  return {
    taxableValue: Number(salesAgg._sum.taxable_amount || 0),
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    totalTax: cgst + sgst + igst
  };
};

const getInventoryReport = async (business_id) => {
  return await getStockValuationReport(business_id);
};

const getProfitLossReport = async (business_id) => {
  const salesAgg = await prisma.sales.aggregate({
    where: { business_id },
    _sum: { grand_total: true, taxable_amount: true }
  });
  const purchasesAgg = await prisma.purchases.aggregate({
    where: { business_id },
    _sum: { grand_total: true, taxable_amount: true }
  });

  const totalRevenue = Number(salesAgg._sum.grand_total || 0);
  const cogs = Number(purchasesAgg._sum.grand_total || 0);
  const grossProfit = totalRevenue - cogs;

  return {
    totalRevenue,
    cogs,
    grossProfit,
    netProfit: grossProfit
  };
};

const getCustomersOutstandingReport = async (business_id) => {
  const customers = await prisma.customers.findMany({
    where: { business_id, current_balance: { gt: 0 } }
  });
  return { customers, data: customers };
};

const getSuppliersOutstandingReport = async (business_id) => {
  const suppliers = await prisma.suppliers.findMany({
    where: { business_id, current_balance: { gt: 0 } }
  });
  return { suppliers, data: suppliers };
};

module.exports = {
  getDashboardData,
  getSalesReport,
  getPurchaseReport,
  getStockValuationReport,
  getCustomersOutstandingReport,
  getSuppliersOutstandingReport,
  getGstReport,
  getInventoryReport,
  getProfitLossReport
};
