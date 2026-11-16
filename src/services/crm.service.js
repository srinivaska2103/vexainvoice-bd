const prisma = require('../config/db');

/**
 * CRM Dashboard Summary Metrics
 * Calculates actual backend metrics for authentic business_id
 */
const getDashboardMetrics = async (business_id) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 1. Total active customers
  const totalCustomers = await prisma.customers.count({
    where: { business_id, is_active: true }
  });

  // 2. New customers (created in last 30 days)
  const newCustomers = await prisma.customers.count({
    where: {
      business_id,
      is_active: true,
      created_at: { gte: thirtyDaysAgo }
    }
  });

  // 3. Repeat customers (customers with >1 non-cancelled sale)
  const repeatCustomerCounts = await prisma.sales.groupBy({
    by: ['customer_id'],
    where: {
      business_id,
      status: { not: 'CANCELLED' },
      customer_id: { not: null }
    },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } }
    }
  });
  const repeatCustomers = repeatCustomerCounts.length;

  // 4. Inactive customers (last sale > 60 days ago or never purchased)
  const customersWithRecentSales = await prisma.sales.groupBy({
    by: ['customer_id'],
    where: {
      business_id,
      status: { not: 'CANCELLED' },
      customer_id: { not: null },
      invoice_date: { gte: sixtyDaysAgo }
    }
  });
  const activeCustomerIds = new Set(customersWithRecentSales.map(s => s.customer_id));
  
  // Total active customers minus those who bought in last 60 days
  const inactiveCustomers = Math.max(0, totalCustomers - activeCustomerIds.size);

  // 5. High Value Customers (Total spend > 50,000)
  const highValueCustomerGroups = await prisma.sales.groupBy({
    by: ['customer_id'],
    where: {
      business_id,
      status: { not: 'CANCELLED' },
      customer_id: { not: null }
    },
    _sum: { grand_total: true },
    having: {
      grand_total: { _sum: { gte: 50000 } }
    }
  });
  const highValueCustomers = highValueCustomerGroups.length;

  // 6. Customers with Outstanding balance > 0
  const customersWithOutstanding = await prisma.customers.count({
    where: {
      business_id,
      is_active: true,
      current_balance: { gt: 0 }
    }
  });

  // 7. Today's follow-ups
  const todayFollowups = await prisma.crm_follow_ups.count({
    where: {
      business_id,
      status: 'PENDING',
      due_date: {
        gte: startOfToday,
        lte: endOfToday
      }
    }
  });

  // 8. Overdue follow-ups
  const overdueFollowups = await prisma.crm_follow_ups.count({
    where: {
      business_id,
      status: 'PENDING',
      due_date: { lt: startOfToday }
    }
  });

  // Recent followups list for dashboard table
  const upcomingFollowupsList = await prisma.crm_follow_ups.findMany({
    where: {
      business_id,
      status: 'PENDING'
    },
    take: 5,
    orderBy: { due_date: 'asc' },
    include: {
      customers: { select: { id: true, name: true, phone: true, customer_code: true } },
      assigned_user: { select: { id: true, name: true } }
    }
  });

  // Frequently purchased products overview
  const topProductsRaw = await prisma.sale_items.groupBy({
    by: ['product_id', 'product_name'],
    where: {
      sales: { business_id, status: { not: 'CANCELLED' } }
    },
    _sum: { quantity: true, total_amount: true },
    take: 5,
    orderBy: { _sum: { quantity: 'desc' } }
  });

  return {
    totalCustomers,
    newCustomers,
    repeatCustomers,
    inactiveCustomers,
    highValueCustomers,
    customersWithOutstanding,
    todayFollowups,
    overdueFollowups,
    upcomingFollowups: upcomingFollowupsList.map(f => ({
      id: f.id,
      customerId: f.customer_id,
      customerName: f.customers?.name || 'Unknown',
      customerPhone: f.customers?.phone || '',
      type: f.type,
      reason: f.reason,
      dueDate: f.due_date,
      priority: f.priority,
      status: f.due_date < startOfToday ? 'OVERDUE' : f.status,
      assignedToName: f.assigned_user?.name || 'Unassigned'
    })),
    topProductsOverview: topProductsRaw.map(p => ({
      productId: p.product_id,
      productName: p.product_name,
      totalQuantity: Number(p._sum.quantity || 0),
      totalValue: Number(p._sum.total_amount || 0)
    }))
  };
};

/**
 * Get CRM Customer Intelligence List
 */
const getCrmCustomers = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 20, search = '', customer_type, segment } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  let where = {
    business_id,
    is_active: true,
    ...(customer_type ? { customer_type } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { customer_code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  // Predefined Segment filtering if requested
  const now = new Date();
  if (segment === 'HIGH_VALUE') {
    const highValueGroups = await prisma.sales.groupBy({
      by: ['customer_id'],
      where: { business_id, status: { not: 'CANCELLED' }, customer_id: { not: null } },
      _sum: { grand_total: true },
      having: { grand_total: { _sum: { gte: 50000 } } }
    });
    const ids = highValueGroups.map(g => g.customer_id);
    where.id = { in: ids };
  } else if (segment === 'OUTSTANDING') {
    where.current_balance = { gt: 0 };
  } else if (segment === 'NEW') {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    where.created_at = { gte: thirtyDaysAgo };
  } else if (segment === 'INACTIVE') {
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const recentSales = await prisma.sales.groupBy({
      by: ['customer_id'],
      where: { business_id, status: { not: 'CANCELLED' }, customer_id: { not: null }, invoice_date: { gte: sixtyDaysAgo } }
    });
    const recentIds = recentSales.map(s => s.customer_id);
    where.id = { notIn: recentIds };
  } else if (segment === 'REPEAT') {
    const repeatSales = await prisma.sales.groupBy({
      by: ['customer_id'],
      where: { business_id, status: { not: 'CANCELLED' }, customer_id: { not: null } },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } }
    });
    const repeatIds = repeatSales.map(s => s.customer_id);
    where.id = { in: repeatIds };
  } else if (segment === 'RETAIL') {
    where.customer_type = 'RETAIL';
  } else if (segment === 'WHOLESALE') {
    where.customer_type = 'WHOLESALE';
  } else if (segment === 'BUSINESS' || segment === 'SHOP') {
    where.customer_type = 'BUSINESS';
  } else if (segment === 'HAS_WHATSAPP') {
    where.phone = { not: null, not: '' };
  } else if (segment === 'HAS_EMAIL') {
    where.email = { not: null, not: '' };
  }

  const total = await prisma.customers.count({ where });
  const dbCustomers = await prisma.customers.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { name: 'asc' },
    include: {
      sales: {
        where: { status: { not: 'CANCELLED' } },
        select: { id: true, grand_total: true, invoice_date: true },
        orderBy: { invoice_date: 'desc' }
      },
      crm_follow_ups: {
        where: { status: 'PENDING' },
        select: { id: true, due_date: true, type: true, reason: true },
        take: 1,
        orderBy: { due_date: 'asc' }
      }
    }
  });

  const customers = dbCustomers.map(c => {
    const validSales = c.sales || [];
    const totalOrders = validSales.length;
    const totalSpent = validSales.reduce((acc, s) => acc + Number(s.grand_total || 0), 0);
    const lastPurchaseDate = validSales.length > 0 ? validSales[0].invoice_date : null;
    const avgOrderValue = totalOrders > 0 ? (totalSpent / totalOrders) : 0;
    const pendingFollowup = c.crm_follow_ups.length > 0 ? c.crm_follow_ups[0] : null;

    return {
      id: c.id,
      customer_code: c.customer_code,
      name: c.name,
      phone: c.phone,
      email: c.email,
      city: c.city,
      state: c.state,
      gst_number: c.gst_number,
      gstin: c.gst_number || c.gstin || '',
      customer_type: c.customer_type || 'RETAIL',
      outstanding: Number(c.current_balance || 0),
      totalOrders,
      totalSpent,
      avgOrderValue,
      lastPurchaseDate,
      nextFollowup: pendingFollowup ? {
        id: pendingFollowup.id,
        dueDate: pendingFollowup.due_date,
        type: pendingFollowup.type,
        reason: pendingFollowup.reason
      } : null
    };
  });

  return {
    customers,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

/**
 * Customer 360 Full Detailed View
 */
const getCustomer360 = async (business_id, customer_id) => {
  const customer = await prisma.customers.findFirst({
    where: { id: customer_id, business_id }
  });

  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  // Sales History
  const sales = await prisma.sales.findMany({
    where: { business_id, customer_id },
    orderBy: { invoice_date: 'desc' },
    include: {
      sale_items: {
        select: {
          id: true,
          product_name: true,
          quantity: true,
          unit_price: true,
          total_amount: true
        }
      }
    }
  });

  const validSales = sales.filter(s => s.status !== 'CANCELLED');
  const totalPurchases = validSales.reduce((acc, s) => acc + Number(s.grand_total || 0), 0);
  const totalOrders = validSales.length;
  const avgOrderValue = totalOrders > 0 ? totalPurchases / totalOrders : 0;
  
  let firstPurchaseDate = null;
  let lastPurchaseDate = null;

  if (validSales.length > 0) {
    const sortedDates = [...validSales].map(s => new Date(s.invoice_date)).sort((a, b) => a - b);
    firstPurchaseDate = sortedDates[0];
    lastPurchaseDate = sortedDates[sortedDates.length - 1];
  }

  // Payment History
  const customerPayments = await prisma.customer_payments.findMany({
    where: { business_id, customer_id },
    orderBy: { payment_date: 'desc' },
    include: {
      sales: { select: { invoice_number: true } }
    }
  });

  const totalPaid = customerPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const outstanding = Number(customer.current_balance || 0);

  // Product Analysis (Aggregated from sale_items with garment/textile variant detail)
  const saleItems = await prisma.sale_items.findMany({
    where: {
      sales: { business_id, customer_id, status: { not: 'CANCELLED' } }
    },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          brands: { select: { id: true, name: true } },
          categories: { select: { id: true, name: true } }
        }
      },
      product_variants: {
        select: {
          id: true,
          variant_name: true,
          colors: { select: { id: true, name: true, hex_code: true } },
          sizes: { select: { id: true, name: true } }
        }
      },
      sales: { select: { invoice_date: true } }
    }
  });

  // Group by Product
  const productMap = {};
  const categoryMap = {};
  const brandMap = {};

  saleItems.forEach(item => {
    const prodId = item.product_id;
    const prodName = item.product_name || item.products?.name || 'Unknown Product';
    const brandName = item.products?.brands?.name || 'Unbranded';
    const catName = item.products?.categories?.name || 'Uncategorized';
    const qty = Number(item.quantity || 0);
    const amount = Number(item.total_amount || 0);
    const itemDate = item.sales?.invoice_date ? new Date(item.sales.invoice_date) : null;

    // Aggregate Product Level
    if (!productMap[prodId]) {
      productMap[prodId] = {
        productId: prodId,
        productName: prodName,
        category: catName,
        brand: brandName,
        totalQuantity: 0,
        totalSpent: 0,
        orderCount: 0,
        lastPurchased: null,
        variants: {}
      };
    }
    productMap[prodId].totalQuantity += qty;
    productMap[prodId].totalSpent += amount;
    productMap[prodId].orderCount += 1;
    if (itemDate && (!productMap[prodId].lastPurchased || itemDate > productMap[prodId].lastPurchased)) {
      productMap[prodId].lastPurchased = itemDate;
    }

    // Variant Level (for Textile/Garment)
    if (item.variant_id || item.product_variants) {
      const varId = item.variant_id || 'default';
      const varName = item.product_variants?.variant_name || 'Standard Variant';
      const colorName = item.product_variants?.colors?.name || null;
      const sizeName = item.product_variants?.sizes?.name || null;

      if (!productMap[prodId].variants[varId]) {
        productMap[prodId].variants[varId] = {
          variantId: varId,
          variantName: varName,
          color: colorName,
          size: sizeName,
          quantity: 0,
          spent: 0
        };
      }
      productMap[prodId].variants[varId].quantity += qty;
      productMap[prodId].variants[varId].spent += amount;
    }

    // Category aggregation
    if (!categoryMap[catName]) categoryMap[catName] = { name: catName, totalSpent: 0, totalQuantity: 0 };
    categoryMap[catName].totalSpent += amount;
    categoryMap[catName].totalQuantity += qty;

    // Brand aggregation
    if (!brandMap[brandName]) brandMap[brandName] = { name: brandName, totalSpent: 0, totalQuantity: 0 };
    brandMap[brandName].totalSpent += amount;
    brandMap[brandName].totalQuantity += qty;
  });

  const purchasedProducts = Object.values(productMap).map(p => ({
    ...p,
    variants: Object.values(p.variants)
  })).sort((a, b) => b.totalSpent - a.totalSpent);

  const topCategories = Object.values(categoryMap).sort((a, b) => b.totalSpent - a.totalSpent);
  const topBrands = Object.values(brandMap).sort((a, b) => b.totalSpent - a.totalSpent);

  // Purchase Pattern Algorithm
  const purchasePattern = calculatePurchasePattern(validSales);

  // Follow-ups
  const followups = await prisma.crm_follow_ups.findMany({
    where: { business_id, customer_id },
    orderBy: { due_date: 'desc' },
    include: {
      assigned_user: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } }
    }
  });

  // Customer Notes
  const notes = await prisma.crm_customer_notes.findMany({
    where: { business_id, customer_id },
    orderBy: { created_at: 'desc' },
    include: {
      creator: { select: { id: true, name: true } }
    }
  });

  // Customer Timeline Events
  const timeline = await buildCustomerTimeline(customer, sales, customerPayments, followups, notes);

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      customer_code: customer.customer_code,
      phone: customer.phone,
      email: customer.email,
      customer_type: customer.customer_type || 'RETAIL',
      gst_number: customer.gst_number,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      credit_limit: Number(customer.credit_limit || 0),
      opening_balance: Number(customer.opening_balance || 0),
      current_balance: Number(customer.current_balance || 0),
      is_active: customer.is_active,
      created_at: customer.created_at
    },
    summary: {
      totalPurchases,
      totalPaid,
      outstanding,
      totalOrders,
      avgOrderValue,
      firstPurchaseDate,
      lastPurchaseDate
    },
    sales: sales.map(s => ({
      id: s.id,
      invoice_number: s.invoice_number,
      invoice_type: s.invoice_type,
      invoice_date: s.invoice_date,
      status: s.status,
      grand_total: Number(s.grand_total || 0),
      paid_amount: Number(s.paid_amount || 0),
      balance_amount: Number(s.balance_amount || 0),
      itemCount: s.sale_items?.length || 0,
      items: s.sale_items.map(i => ({
        id: i.id,
        productName: i.product_name,
        quantity: Number(i.quantity || 0),
        unitPrice: Number(i.unit_price || 0),
        totalAmount: Number(i.total_amount || 0)
      }))
    })),
    payments: customerPayments.map(p => ({
      id: p.id,
      payment_date: p.payment_date,
      reference_number: p.reference_number || 'Direct Receipt',
      invoice_number: p.sales?.invoice_number || 'On Account',
      payment_method: p.payment_method,
      amount: Number(p.amount || 0),
      notes: p.notes
    })),
    products: purchasedProducts,
    topCategories,
    topBrands,
    purchasePattern,
    followups: followups.map(f => ({
      id: f.id,
      type: f.type,
      reason: f.reason,
      dueDate: f.due_date,
      priority: f.priority,
      status: f.status,
      notes: f.notes,
      assignedTo: f.assigned_user ? f.assigned_user.name : 'Unassigned',
      createdBy: f.creator ? f.creator.name : 'System',
      completedAt: f.completed_at,
      completionNotes: f.completion_notes
    })),
    notes: notes.map(n => ({
      id: n.id,
      note: n.note,
      createdBy: n.creator ? n.creator.name : 'Staff',
      createdAt: n.created_at
    })),
    timeline
  };
};

/**
 * Purchase Pattern Algorithm based on historical completed sales
 */
function calculatePurchasePattern(sales) {
  if (!sales || sales.length < 2) {
    return {
      hasEnoughData: false,
      reason: 'Not enough purchase history to calculate a reliable pattern.',
      totalOrders: sales ? sales.length : 0
    };
  }

  // Sort sales ascending by date
  const sortedSales = [...sales]
    .filter(s => s.invoice_date)
    .sort((a, b) => new Date(a.invoice_date) - new Date(b.invoice_date));

  if (sortedSales.length < 2) {
    return {
      hasEnoughData: false,
      reason: 'Not enough valid invoice dates to calculate a purchase pattern.',
      totalOrders: sales.length
    };
  }

  // Calculate day gaps between consecutive orders
  const intervals = [];
  for (let i = 1; i < sortedSales.length; i++) {
    const prevDate = new Date(sortedSales[i - 1].invoice_date);
    const currDate = new Date(sortedSales[i].invoice_date);
    const diffDays = Math.max(1, Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24)));
    intervals.push(diffDays);
  }

  const avgIntervalDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  const lastPurchaseDate = new Date(sortedSales[sortedSales.length - 1].invoice_date);
  const firstPurchaseDate = new Date(sortedSales[0].invoice_date);

  // Estimate potential follow up opportunity window
  const expectedNextPurchaseDate = new Date(lastPurchaseDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000);
  const daysSinceLastPurchase = Math.round((new Date() - lastPurchaseDate) / (1000 * 60 * 60 * 24));

  let followUpOpportunity = 'Normal Interval';
  if (daysSinceLastPurchase >= avgIntervalDays - 5 && daysSinceLastPurchase <= avgIntervalDays + 15) {
    followUpOpportunity = 'Potential Follow-up Opportunity (Due for Repeat)';
  } else if (daysSinceLastPurchase > avgIntervalDays + 15) {
    followUpOpportunity = 'Potential Overdue Repeat Purchase Opportunity';
  }

  return {
    hasEnoughData: true,
    totalOrders: sortedSales.length,
    firstPurchaseDate,
    lastPurchaseDate,
    avgIntervalDays,
    daysSinceLastPurchase,
    expectedNextPurchaseDate,
    followUpOpportunity,
    historicalIntervals: intervals,
    notice: 'Based on previous purchase pattern (Historical Insight)'
  };
}

/**
 * Build Unified Chronological Customer Timeline
 */
async function buildCustomerTimeline(customer, sales, payments, followups, notes) {
  const events = [];

  // Customer created event
  if (customer.created_at) {
    events.push({
      id: `created-${customer.id}`,
      type: 'CUSTOMER_CREATED',
      title: 'Customer Account Created',
      description: `Customer account registered (${customer.customer_type || 'RETAIL'})`,
      timestamp: customer.created_at
    });
  }

  // Sales events
  sales.forEach(s => {
    events.push({
      id: `sale-${s.id}`,
      type: 'SALE',
      title: `Invoice #${s.invoice_number}`,
      description: `Sale completed for ₹${Number(s.grand_total || 0).toLocaleString()} (${s.status})`,
      timestamp: s.invoice_date || s.created_at,
      referenceId: s.id
    });
  });

  // Payment events
  payments.forEach(p => {
    events.push({
      id: `pay-${p.id}`,
      type: 'PAYMENT',
      title: `Payment Received`,
      description: `Received ₹${Number(p.amount || 0).toLocaleString()} via ${p.payment_method}`,
      timestamp: p.payment_date || p.created_at,
      referenceId: p.id
    });
  });

  // Followup events
  followups.forEach(f => {
    events.push({
      id: `followup-${f.id}`,
      type: 'FOLLOWUP',
      title: `Follow-up (${f.type})`,
      description: `Reason: ${f.reason} — Status: ${f.status}`,
      timestamp: f.created_at || f.due_date,
      referenceId: f.id
    });
  });

  // Notes events
  notes.forEach(n => {
    events.push({
      id: `note-${n.id}`,
      type: 'NOTE',
      title: `Internal Note Added`,
      description: n.note,
      timestamp: n.created_at,
      referenceId: n.id
    });
  });

  // Sort timeline descending by timestamp
  return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Follow-up Management
 */
const getFollowups = async (business_id, queryParams = {}) => {
  const { status, priority, type, customer_id, search, assigned_to } = queryParams;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const where = {
    business_id,
    ...(priority ? { priority } : {}),
    ...(type ? { type } : {}),
    ...(customer_id ? { customer_id } : {}),
    ...(assigned_to ? { assigned_to } : {}),
    ...(search ? {
      OR: [
        { reason: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customers: { name: { contains: search, mode: 'insensitive' } } }
      ]
    } : {})
  };

  if (status === 'OVERDUE') {
    where.status = 'PENDING';
    where.due_date = { lt: startOfToday };
  } else if (status === 'TODAY') {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    where.status = 'PENDING';
    where.due_date = { gte: startOfToday, lte: endOfToday };
  } else if (status === 'UPCOMING') {
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    where.status = 'PENDING';
    where.due_date = { gt: endOfToday };
  } else if (status) {
    where.status = status;
  }

  const list = await prisma.crm_follow_ups.findMany({
    where,
    orderBy: { due_date: 'asc' },
    include: {
      customers: {
        select: { id: true, name: true, phone: true, customer_code: true, current_balance: true }
      },
      assigned_user: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } }
    }
  });

  return list.map(f => {
    const isOverdue = f.status === 'PENDING' && f.due_date < startOfToday;
    return {
      id: f.id,
      customer_id: f.customer_id,
      customerName: f.customers?.name || 'Unknown Customer',
      customerPhone: f.customers?.phone || '',
      customerCode: f.customers?.customer_code || '',
      outstanding: Number(f.customers?.current_balance || 0),
      type: f.type,
      reason: f.reason,
      notes: f.notes,
      dueDate: f.due_date,
      priority: f.priority,
      status: isOverdue ? 'OVERDUE' : f.status,
      assignedTo: f.assigned_user ? f.assigned_user.name : 'Unassigned',
      assignedToId: f.assigned_to,
      createdBy: f.creator ? f.creator.name : 'System',
      completedAt: f.completed_at,
      completionNotes: f.completion_notes,
      createdAt: f.created_at
    };
  });
};

const createFollowup = async (business_id, user_id, data) => {
  const followup = await prisma.crm_follow_ups.create({
    data: {
      business_id,
      customer_id: data.customer_id,
      assigned_to: data.assigned_to || user_id,
      type: data.type || 'Call',
      reason: data.reason,
      notes: data.notes || null,
      due_date: new Date(data.due_date),
      priority: data.priority || 'MEDIUM',
      status: data.status || 'PENDING',
      created_by: user_id
    },
    include: {
      customers: { select: { name: true } }
    }
  });
  return followup;
};

const updateFollowup = async (business_id, followup_id, user_id, data) => {
  const existing = await prisma.crm_follow_ups.findFirst({
    where: { id: followup_id, business_id }
  });

  if (!existing) {
    const err = new Error('Follow-up record not found');
    err.statusCode = 404;
    throw err;
  }

  const updateData = {};
  if (data.type) updateData.type = data.type;
  if (data.reason) updateData.reason = data.reason;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.due_date) updateData.due_date = new Date(data.due_date);
  if (data.priority) updateData.priority = data.priority;
  if (data.assigned_to) updateData.assigned_to = data.assigned_to;

  if (data.status) {
    updateData.status = data.status;
    if (data.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      updateData.completed_at = new Date();
      updateData.completed_by = user_id;
      updateData.completion_notes = data.completion_notes || data.completed_notes || 'Completed';
    }
  }

  const updated = await prisma.crm_follow_ups.update({
    where: { id: followup_id },
    data: updateData
  });

  return updated;
};

const deleteFollowup = async (business_id, followup_id) => {
  const existing = await prisma.crm_follow_ups.findFirst({
    where: { id: followup_id, business_id }
  });

  if (!existing) {
    const err = new Error('Follow-up record not found');
    err.statusCode = 404;
    throw err;
  }

  await prisma.crm_follow_ups.delete({ where: { id: followup_id } });
  return { success: true, message: 'Follow-up deleted successfully' };
};

/**
 * Customer Notes
 */
const createCustomerNote = async (business_id, user_id, data) => {
  const note = await prisma.crm_customer_notes.create({
    data: {
      business_id,
      customer_id: data.customer_id,
      note: data.note,
      created_by: user_id
    },
    include: {
      creator: { select: { name: true } }
    }
  });

  return {
    id: note.id,
    note: note.note,
    createdBy: note.creator ? note.creator.name : 'Staff',
    createdAt: note.created_at
  };
};

/**
 * Customer Dynamic Segmentation Engine
 */
const evaluateSegmentFilters = async (business_id, filters = {}) => {
  const {
    customerType,
    minPurchaseValue,
    maxPurchaseValue,
    lastPurchaseDays,
    minOutstanding,
    productId,
    categoryId,
    brandId,
    variantId
  } = filters;

  let where = {
    business_id,
    is_active: true,
    ...(customerType ? { customer_type: customerType } : {}),
    ...(minOutstanding ? { current_balance: { gte: parseFloat(minOutstanding) } } : {})
  };

  // If purchase criteria requested, collect eligible customer IDs
  let eligibleCustomerIds = null;

  if (productId || categoryId || brandId || variantId) {
    const itemWhere = {
      sales: { business_id, status: { not: 'CANCELLED' } }
    };
    if (productId) itemWhere.product_id = productId;
    if (variantId) itemWhere.variant_id = variantId;
    if (categoryId) itemWhere.products = { category_id: categoryId };
    if (brandId) itemWhere.products = { brand_id: brandId };

    const matchingItems = await prisma.sale_items.findMany({
      where: itemWhere,
      select: { sales: { select: { customer_id: true } } }
    });

    const ids = new Set(matchingItems.map(i => i.sales?.customer_id).filter(Boolean));
    eligibleCustomerIds = Array.from(ids);
  }

  if (minPurchaseValue || maxPurchaseValue || lastPurchaseDays) {
    const now = new Date();
    const salesWhere = {
      business_id,
      status: { not: 'CANCELLED' },
      customer_id: { not: null }
    };

    if (lastPurchaseDays) {
      const daysAgoDate = new Date(now.getTime() - parseInt(lastPurchaseDays, 10) * 24 * 60 * 60 * 1000);
      salesWhere.invoice_date = { gte: daysAgoDate };
    }

    const salesGroup = await prisma.sales.groupBy({
      by: ['customer_id'],
      where: salesWhere,
      _sum: { grand_total: true }
    });

    const filtered = salesGroup.filter(g => {
      const sum = Number(g._sum.grand_total || 0);
      if (minPurchaseValue && sum < parseFloat(minPurchaseValue)) return false;
      if (maxPurchaseValue && sum > parseFloat(maxPurchaseValue)) return false;
      return true;
    }).map(g => g.customer_id);

    if (eligibleCustomerIds !== null) {
      eligibleCustomerIds = eligibleCustomerIds.filter(id => filtered.includes(id));
    } else {
      eligibleCustomerIds = filtered;
    }
  }

  if (eligibleCustomerIds !== null) {
    where.id = { in: eligibleCustomerIds };
  }

  const customers = await prisma.customers.findMany({
    where,
    take: 100,
    orderBy: { name: 'asc' },
    include: {
      sales: {
        where: { status: { not: 'CANCELLED' } },
        select: { grand_total: true, invoice_date: true },
        orderBy: { invoice_date: 'desc' }
      }
    }
  });

  return customers.map(c => {
    const validSales = c.sales || [];
    const totalSpent = validSales.reduce((acc, s) => acc + Number(s.grand_total || 0), 0);
    const lastPurchaseDate = validSales.length > 0 ? validSales[0].invoice_date : null;

    return {
      id: c.id,
      customerCode: c.customer_code,
      name: c.name,
      phone: c.phone,
      email: c.email,
      customerType: c.customer_type || 'RETAIL',
      outstanding: Number(c.current_balance || 0),
      ordersCount: validSales.length,
      totalSpent,
      lastPurchaseDate
    };
  });
};

const getSavedSegments = async (business_id) => {
  const segments = await prisma.crm_saved_segments.findMany({
    where: { business_id },
    orderBy: { created_at: 'desc' }
  });
  return segments;
};

const createSavedSegment = async (business_id, user_id, data) => {
  const segment = await prisma.crm_saved_segments.create({
    data: {
      business_id,
      name: data.name,
      description: data.description || null,
      filter_definition: data.filter_definition,
      created_by: user_id
    }
  });
  return segment;
};

const deleteSavedSegment = async (business_id, segment_id) => {
  const existing = await prisma.crm_saved_segments.findFirst({
    where: { id: segment_id, business_id }
  });
  if (!existing) {
    const err = new Error('Saved segment not found');
    err.statusCode = 404;
    throw err;
  }
  await prisma.crm_saved_segments.delete({ where: { id: segment_id } });
  return { success: true, message: 'Segment deleted successfully' };
};

/**
 * Product Insights & Cross-sell Engine
 */
const getProductInsights = async (business_id, queryParams = {}) => {
  const { category_id, brand_id } = queryParams;

  const whereItems = {
    sales: { business_id, status: { not: 'CANCELLED' } }
  };
  if (category_id) whereItems.products = { category_id };
  if (brand_id) whereItems.products = { brand_id };

  // Top Products
  const topProductsRaw = await prisma.sale_items.groupBy({
    by: ['product_id', 'product_name'],
    where: whereItems,
    _sum: { quantity: true, total_amount: true },
    take: 10,
    orderBy: { _sum: { total_amount: 'desc' } }
  });

  // Top Categories
  const salesItemsForCats = await prisma.sale_items.findMany({
    where: whereItems,
    select: {
      quantity: true,
      total_amount: true,
      products: { select: { categories: { select: { id: true, name: true } } } }
    }
  });

  const catAgg = {};
  salesItemsForCats.forEach(item => {
    const catName = item.products?.categories?.name || 'Uncategorized';
    if (!catAgg[catName]) catAgg[catName] = { name: catName, totalQuantity: 0, totalAmount: 0 };
    catAgg[catName].totalQuantity += Number(item.quantity || 0);
    catAgg[catName].totalAmount += Number(item.total_amount || 0);
  });
  const topCategories = Object.values(catAgg).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10);

  // Top Brands
  const salesItemsForBrands = await prisma.sale_items.findMany({
    where: whereItems,
    select: {
      quantity: true,
      total_amount: true,
      products: { select: { brands: { select: { id: true, name: true } } } }
    }
  });

  const brandAgg = {};
  salesItemsForBrands.forEach(item => {
    const brandName = item.products?.brands?.name || 'Unbranded';
    if (!brandAgg[brandName]) brandAgg[brandName] = { name: brandName, totalQuantity: 0, totalAmount: 0 };
    brandAgg[brandName].totalQuantity += Number(item.quantity || 0);
    brandAgg[brandName].totalAmount += Number(item.total_amount || 0);
  });
  const topBrands = Object.values(brandAgg).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 10);

  // Frequently Bought Together algorithm (Analyze multi-item sales)
  const multiItemSales = await prisma.sales.findMany({
    where: { business_id, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      sale_items: { select: { product_id: true, product_name: true } }
    },
    take: 500
  });

  const pairCounts = {};
  multiItemSales.forEach(s => {
    const items = s.sale_items || [];
    if (items.length < 2) return;
    const uniqueProds = Array.from(new Set(items.map(i => JSON.stringify({ id: i.product_id, name: i.product_name }))));
    for (let i = 0; i < uniqueProds.length; i++) {
      for (let j = i + 1; j < uniqueProds.length; j++) {
        const p1 = JSON.parse(uniqueProds[i]);
        const p2 = JSON.parse(uniqueProds[j]);
        const key = p1.id < p2.id ? `${p1.id}___${p2.id}` : `${p2.id}___${p1.id}`;
        if (!pairCounts[key]) {
          pairCounts[key] = {
            productA: p1.name,
            productB: p2.name,
            count: 0
          };
        }
        pairCounts[key].count += 1;
      }
    }
  });

  const frequentlyBoughtTogether = Object.values(pairCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    topProducts: topProductsRaw.map(p => ({
      id: p.product_id,
      name: p.product_name,
      totalQuantity: Number(p._sum.quantity || 0),
      totalAmount: Number(p._sum.total_amount || 0)
    })),
    topCategories,
    topBrands,
    frequentlyBoughtTogether
  };
};

module.exports = {
  getDashboardMetrics,
  getCrmCustomers,
  getCustomer360,
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  createCustomerNote,
  evaluateSegmentFilters,
  getSavedSegments,
  createSavedSegment,
  deleteSavedSegment,
  getProductInsights
};
