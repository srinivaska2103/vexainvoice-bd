const prisma = require('../config/db');

const getCustomers = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 20, search = '', is_active = 'true' } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(is_active !== 'all' ? { is_active: is_active === 'true' } : {}),
    ...(search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { gst_number: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const total = await prisma.customers.count({ where });
  const dbCustomers = await prisma.customers.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { name: 'asc' }
  });

  const customers = dbCustomers.map(c => ({
    id: c.id,
    name: c.name,
    customer_name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    gstin: c.gst_number,
    gst_number: c.gst_number,
    creditLimit: Number(c.credit_limit || 0),
    credit_limit: Number(c.credit_limit || 0),
    openingBalance: Number(c.opening_balance || 0),
    opening_balance: Number(c.opening_balance || 0),
    current_balance: Number(c.current_balance || c.opening_balance || 0),
    outstandingBalance: Number(c.current_balance || c.opening_balance || 0),
    outstanding_balance: Number(c.current_balance || c.opening_balance || 0),
    customerType: c.customer_type || 'RETAIL'
  }));

  return {
    customers,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const getCustomerById = async (business_id, id) => {
  const c = await prisma.customers.findFirst({ where: { id, business_id } });
  if (!c) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }
  return {
    id: c.id,
    name: c.name,
    customer_name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    gstin: c.gst_number,
    gst_number: c.gst_number,
    creditLimit: Number(c.credit_limit || 0),
    credit_limit: Number(c.credit_limit || 0),
    openingBalance: Number(c.opening_balance || 0),
    opening_balance: Number(c.opening_balance || 0),
    current_balance: Number(c.current_balance || 0),
    outstandingBalance: Number(c.current_balance || 0),
    customerType: c.customer_type || 'RETAIL'
  };
};

const createCustomer = async (business_id, data) => {
  const opening = parseFloat(data.opening_balance || data.openingBalance || 0);
  const credit = parseFloat(data.credit_limit || data.creditLimit || 0);
  const c = await prisma.customers.create({
    data: {
      business_id,
      name: data.name || data.customer_name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      gst_number: data.gst_number || data.gstin || null,
      customer_type: data.customer_type || data.customerType || 'RETAIL',
      credit_limit: credit,
      opening_balance: opening,
      current_balance: opening,
      is_active: true
    }
  });

  return {
    id: c.id,
    name: c.name,
    customer_name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    city: c.city,
    state: c.state,
    pincode: c.pincode,
    gstin: c.gst_number,
    gst_number: c.gst_number,
    creditLimit: Number(c.credit_limit || 0),
    openingBalance: Number(c.opening_balance || 0),
    current_balance: Number(c.current_balance || 0),
    outstandingBalance: Number(c.current_balance || 0),
    customerType: c.customer_type || 'RETAIL'
  };
};

const updateCustomer = async (business_id, id, data) => {
  const customer = await prisma.customers.findFirst({ where: { id, business_id } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const gstVal = data.gst_number !== undefined ? data.gst_number : (data.gstin !== undefined ? data.gstin : customer.gst_number);
  const updated = await prisma.customers.update({
    where: { id },
    data: {
      name: data.name || customer.name,
      phone: data.phone !== undefined ? data.phone : customer.phone,
      email: data.email !== undefined ? data.email : customer.email,
      address: data.address !== undefined ? data.address : customer.address,
      city: data.city !== undefined ? data.city : customer.city,
      state: data.state !== undefined ? data.state : customer.state,
      pincode: data.pincode !== undefined ? data.pincode : customer.pincode,
      gst_number: gstVal,
      customer_type: data.customer_type || data.customerType || customer.customer_type,
      credit_limit: data.credit_limit !== undefined ? parseFloat(data.credit_limit || 0) : (data.creditLimit !== undefined ? parseFloat(data.creditLimit || 0) : customer.credit_limit),
      opening_balance: data.opening_balance !== undefined ? parseFloat(data.opening_balance || 0) : (data.openingBalance !== undefined ? parseFloat(data.openingBalance || 0) : customer.opening_balance)
    }
  });

  return {
    id: updated.id,
    name: updated.name,
    customer_name: updated.name,
    phone: updated.phone,
    email: updated.email,
    address: updated.address,
    city: updated.city,
    state: updated.state,
    pincode: updated.pincode,
    gstin: updated.gst_number,
    gst_number: updated.gst_number,
    creditLimit: Number(updated.credit_limit || 0),
    openingBalance: Number(updated.opening_balance || 0),
    current_balance: Number(updated.current_balance || 0),
    outstandingBalance: Number(updated.current_balance || 0),
    outstanding_balance: Number(updated.current_balance || 0),
    customerType: updated.customer_type || 'RETAIL'
  };
};

const deleteCustomer = async (business_id, id) => {
  const customer = await prisma.customers.findFirst({ where: { id, business_id } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const salesCount = await prisma.sales.count({ where: { customer_id: id } });
  const paymentsCount = await prisma.customer_payments.count({ where: { customer_id: id } });

  if (salesCount === 0 && paymentsCount === 0) {
    await prisma.customers.deleteMany({
      where: { id, business_id }
    });
  } else {
    await prisma.customers.updateMany({
      where: { id, business_id },
      data: { is_active: false }
    });
  }
  return { message: 'Customer deleted successfully' };
};

const getCustomerLedger = async (business_id, customer_id, queryParams = {}) => {
  const customer = await prisma.customers.findFirst({ where: { id: customer_id, business_id } });
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }

  const entries = [];
  const openingBal = Number(customer.opening_balance || 0);

  if (openingBal !== 0) {
    entries.push({
      id: `opening-${customer.id}`,
      createdAt: customer.created_at || new Date(),
      date: customer.created_at || new Date(),
      invoiceNumber: 'OPENING_BAL',
      reference: 'Opening Balance',
      type: 'OPENING',
      debit: openingBal > 0 ? openingBal : 0,
      credit: openingBal < 0 ? Math.abs(openingBal) : 0,
      balance: openingBal
    });
  }

  // 1. Fetch Sales Invoices for customer
  const sales = await prisma.sales.findMany({
    where: { business_id, customer_id },
    orderBy: { created_at: 'asc' }
  });

  sales.forEach((s) => {
    const total = Number(s.total_amount || 0);
    const paid = Number(s.paid_amount || 0);

    entries.push({
      id: `sale-${s.id}`,
      createdAt: s.created_at,
      date: s.created_at,
      invoiceNumber: s.invoice_number || `INV-${s.id.slice(0, 6)}`,
      reference: s.invoice_number,
      type: 'SALE_INVOICE',
      debit: total,
      credit: 0
    });

    if (paid > 0) {
      entries.push({
        id: `sale-pay-${s.id}`,
        createdAt: s.updated_at || s.created_at,
        date: s.updated_at || s.created_at,
        invoiceNumber: s.invoice_number || `INV-${s.id.slice(0, 6)}`,
        reference: `Payment for ${s.invoice_number}`,
        type: 'CUSTOMER_PAYMENT',
        debit: 0,
        credit: paid
      });
    }
  });

  // 2. Fetch standalone customer payment logs if table exists
  try {
    const payments = await prisma.payments?.findMany({
      where: { business_id, customer_id },
      orderBy: { created_at: 'asc' }
    });

    if (payments && payments.length > 0) {
      payments.forEach((p) => {
        entries.push({
          id: `pay-${p.id}`,
          createdAt: p.created_at,
          date: p.created_at,
          invoiceNumber: p.receipt_number || p.reference_number || 'PAYMENT',
          reference: p.notes || p.payment_mode || 'Customer Payment',
          type: 'PAYMENT_RECEIVED',
          debit: 0,
          credit: Number(p.amount || 0)
        });
      });
    }
  } catch (e) {
    // optional payment table check
  }

  // Sort entries chronologically
  entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      customerType: customer.customer_type || 'RETAIL',
      current_balance: Number(customer.current_balance || 0)
    },
    ledger: entries,
    entries: entries
  };
};

const getCustomerOutstanding = async (business_id, id) => {
  const c = await prisma.customers.findFirst({ where: { id, business_id } });
  if (!c) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }
  return {
    customer_id: c.id,
    customer_name: c.name,
    current_balance: Number(c.current_balance || 0)
  };
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerLedger,
  getCustomerOutstanding
};
