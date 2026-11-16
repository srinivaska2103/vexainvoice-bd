const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const env = require('../config/env');
const { sendSuccess, sendError } = require('../utils/response.util');
const { evaluateSelfShoppingEntitlement } = require('../utils/selfShoppingPolicy');
const customerService = require('../services/customer.service');
const customerOrderService = require('../services/customerOrder.service');

/**
 * Resolve target business from shopSlug (company_id, UUID, or business_name)
 */
const resolveBusiness = async (shopSlug) => {
  if (!shopSlug || !shopSlug.trim()) return null;
  const cleanSlug = shopSlug.trim();

  let business = await prisma.businesses.findFirst({
    where: {
      OR: [
        { company_id: { equals: cleanSlug, mode: 'insensitive' } },
        { id: cleanSlug.match(/^[0-9a-fA-F-]{36}$/) ? cleanSlug : undefined },
        { business_name: { equals: cleanSlug, mode: 'insensitive' } }
      ].filter(Boolean)
    },
    select: {
      id: true,
      business_name: true,
      company_id: true,
      business_type: true,
      logo_url: true,
      city: true,
      state: true,
      phone: true,
      email: true,
      address: true,
      is_active: true,
      self_shopping_status: true,
      license_status: true
    }
  });

  if (!business && cleanSlug.includes('-')) {
    const spacedName = cleanSlug.replace(/-/g, ' ');
    business = await prisma.businesses.findFirst({
      where: { business_name: { equals: spacedName, mode: 'insensitive' } },
      select: {
        id: true,
        business_name: true,
        company_id: true,
        business_type: true,
        logo_url: true,
        city: true,
        state: true,
        phone: true,
        email: true,
        address: true,
        is_active: true,
        self_shopping_status: true,
        license_status: true
      }
    });
  }

  return business;
};

/**
 * Middleware: Verify that company has an active GROWTH, LIFETIME, or valid TRIAL entitlement
 */
const requireGrowthOrLifetimePortal = async (req, res, next) => {
  try {
    const { shopSlug } = req.params;
    const business = await resolveBusiness(shopSlug);

    if (!business || !business.is_active) {
      return sendError(res, `Company portal '${shopSlug}' not found or inactive.`, 404);
    }

    const entitlement = await evaluateSelfShoppingEntitlement(business);
    if (!entitlement.allowed) {
      return sendError(
        res,
        'This company has not activated the Customer Self-Service Portal (requires Growth ₹999/mo or Lifetime Plan).',
        403
      );
    }

    req.portalBusiness = business;
    req.portalEntitlement = entitlement;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: Authenticate Customer JWT (strict customer & company scoped)
 */
const authenticateCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Customer authentication token required. Please sign in.', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      return sendError(res, 'Session token expired or invalid. Please sign in again.', 401);
    }

    if (!decoded || decoded.type !== 'CUSTOMER_PORTAL' || !decoded.customerId || !decoded.businessId) {
      return sendError(res, 'Invalid customer session credential.', 403);
    }

    // Ensure customer belongs strictly to the requested business
    if (req.portalBusiness && decoded.businessId !== req.portalBusiness.id) {
      return sendError(res, 'Access denied: Customer does not belong to this company.', 403);
    }

    const customer = await prisma.customers.findFirst({
      where: {
        id: decoded.customerId,
        business_id: decoded.businessId,
        is_active: true
      }
    });

    if (!customer) {
      return sendError(res, 'Customer account not found or deactivated.', 404);
    }

    req.currentCustomer = customer;
    next();
  } catch (err) {
    next(err);
  }
};

// ============================================================================
// PUBLIC PORTAL ROUTES (Scoped to /api/portal/:shopSlug)
// ============================================================================

/**
 * GET /api/portal/:shopSlug/info
 * Returns company portal branding & entitlement status
 */
router.get('/:shopSlug/info', requireGrowthOrLifetimePortal, async (req, res) => {
  const b = req.portalBusiness;
  return sendSuccess(res, 'Company portal information', {
    company: {
      id: b.id,
      name: b.business_name,
      companyId: b.company_id,
      phone: b.phone,
      email: b.email,
      city: b.city,
      state: b.state,
      address: b.address,
      logoUrl: b.logo_url
    },
    entitlement: req.portalEntitlement
  });
});

/**
 * POST /api/portal/:shopSlug/auth/login
 * Customer secure sign in via registered Phone or Email
 * If customer does not yet exist, provides an automatic seamless registration option.
 */
router.post('/:shopSlug/auth/login', requireGrowthOrLifetimePortal, async (req, res, next) => {
  try {
    const business = req.portalBusiness;
    const { identifier, name } = req.body || {};

    if (!identifier || !String(identifier).trim()) {
      return sendError(res, 'Please enter your registered phone number or email address.', 400);
    }

    const cleanIdentifier = String(identifier).trim();
    const isEmail = cleanIdentifier.includes('@');
    const isPhone = /^[0-9+ -]{7,15}$/.test(cleanIdentifier);

    let customer = await prisma.customers.findFirst({
      where: {
        business_id: business.id,
        OR: [
          isEmail ? { email: { equals: cleanIdentifier, mode: 'insensitive' } } : undefined,
          isPhone ? { phone: cleanIdentifier.replace(/[^0-9]/g, '').slice(-10) } : undefined,
          { phone: cleanIdentifier }
        ].filter(Boolean)
      }
    });

    // If customer doesn't exist yet, register them seamlessly under this business
    if (!customer) {
      const custCode = `CUST-${Date.now().toString().slice(-4)}`;
      customer = await prisma.customers.create({
        data: {
          business_id: business.id,
          customer_code: custCode,
          name: name ? name.trim() : (isPhone ? `Customer ${cleanIdentifier.slice(-4)}` : cleanIdentifier.split('@')[0]),
          phone: isPhone ? cleanIdentifier.replace(/[^0-9]/g, '').slice(-10) : null,
          email: isEmail ? cleanIdentifier.toLowerCase() : null,
          customer_type: 'RETAIL',
          is_active: true
        }
      });
    }

    // Issue Customer Portal JWT Token (valid 7 days)
    const token = jwt.sign(
      {
        customerId: customer.id,
        businessId: business.id,
        customerName: customer.name,
        companyId: business.company_id,
        type: 'CUSTOMER_PORTAL'
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return sendSuccess(res, 'Signed in successfully to Customer Portal', {
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        city: customer.city,
        state: customer.state,
        pincode: customer.pincode,
        current_balance: Number(customer.current_balance || 0)
      }
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// AUTHENTICATED CUSTOMER SELF-SERVICE PORTAL ROUTES
// ============================================================================

router.use('/:shopSlug', requireGrowthOrLifetimePortal);
router.use('/:shopSlug', authenticateCustomer);

/**
 * GET /api/portal/:shopSlug/me
 * Returns customer profile & current outstanding balance
 */
router.get('/:shopSlug/me', async (req, res) => {
  const c = req.currentCustomer;
  return sendSuccess(res, 'Customer profile retrieved', {
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      gst_number: c.gst_number,
      current_balance: Number(c.current_balance || 0),
      created_at: c.created_at
    }
  });
});

/**
 * PUT /api/portal/:shopSlug/me
 * Update personal customer profile details
 */
router.put('/:shopSlug/me', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const { name, email, phone, address, city, state, pincode, gst_number } = req.body || {};

    const updated = await prisma.customers.update({
      where: { id: c.id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(email ? { email: email.trim().toLowerCase() } : {}),
        ...(phone ? { phone: phone.trim() } : {}),
        ...(address !== undefined ? { address: address ? address.trim() : null } : {}),
        ...(city !== undefined ? { city: city ? city.trim() : null } : {}),
        ...(state !== undefined ? { state: state ? state.trim() : null } : {}),
        ...(pincode !== undefined ? { pincode: pincode ? pincode.trim() : null } : {}),
        ...(gst_number !== undefined ? { gst_number: gst_number ? gst_number.trim() : null } : {})
      }
    });

    return sendSuccess(res, 'Profile updated successfully', updated);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/invoices
 * Invoices belonging ONLY to this authenticated customer
 */
router.get('/:shopSlug/invoices', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const sales = await prisma.sales.findMany({
      where: {
        business_id: req.portalBusiness.id,
        customer_id: c.id
      },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        invoice_number: true,
        invoice_date: true,
        created_at: true,
        subtotal: true,
        taxable_amount: true,
        cgst_amount: true,
        sgst_amount: true,
        igst_amount: true,
        discount_amount: true,
        round_off: true,
        grand_total: true,
        paid_amount: true,
        balance_amount: true,
        status: true,
        notes: true,
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

    // Format fields expected by frontend
    const formattedSales = sales.map((s) => {
      const balance = Number(s.balance_amount || 0);
      const paid = Number(s.paid_amount || 0);
      const total = Number(s.grand_total || 0);
      const paymentStatus = balance <= 0 ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID');
      const taxAmount = Number(s.cgst_amount || 0) + Number(s.sgst_amount || 0) + Number(s.igst_amount || 0);

      return {
        ...s,
        due_amount: balance,
        tax_amount: taxAmount,
        payment_status: paymentStatus
      };
    });

    return sendSuccess(res, 'Invoices fetched', formattedSales);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/invoices/:id
 * Detailed invoice view with line items & business headers for PDF generation/print
 */
router.get('/:shopSlug/invoices/:id', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const sale = await prisma.sales.findFirst({
      where: {
        id: req.params.id,
        business_id: req.portalBusiness.id,
        customer_id: c.id
      },
      include: {
        sale_items: {
          include: {
            product_variants: true
          }
        },
        sale_payments: true,
        businesses: true
      }
    });

    if (!sale) {
      return sendError(res, 'Invoice not found or unauthorized', 404);
    }

    return sendSuccess(res, 'Invoice details', sale);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/quotations
 * Quotations / Estimates belonging strictly to this customer
 */
router.get('/:shopSlug/quotations', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const quotations = await prisma.quotations.findMany({
      where: {
        business_id: req.portalBusiness.id,
        customer_id: c.id
      },
      orderBy: { created_at: 'desc' },
      include: {
        quotation_items: true
      }
    });

    return sendSuccess(res, 'Quotations retrieved', quotations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/payments
 * Payment receipts and transaction history (both direct customer payments and POS/sale payments)
 */
router.get('/:shopSlug/payments', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const businessId = req.portalBusiness.id;

    // 1. Fetch direct standalone customer payments (receipts against ledger/accounts)
    const directPayments = await prisma.customer_payments.findMany({
      where: {
        business_id: businessId,
        customer_id: c.id
      },
      orderBy: { payment_date: 'desc' }
    });

    // 2. Fetch invoice/sale payments made by this customer
    const invoicePayments = await prisma.sale_payments.findMany({
      where: {
        sales: {
          business_id: businessId,
          customer_id: c.id
        }
      },
      include: {
        sales: {
          select: {
            invoice_number: true,
            grand_total: true
          }
        }
      },
      orderBy: { payment_date: 'desc' }
    });

    // 3. Unify and format both payment streams
    const formattedDirect = directPayments.map((p) => ({
      id: p.id,
      receipt_number: p.receipt_number || p.reference_number || `RCP-${p.id.slice(0, 8).toUpperCase()}`,
      reference_number: p.reference_number,
      payment_date: p.payment_date || p.created_at,
      payment_mode: p.payment_mode || 'Cash',
      amount: Number(p.amount || 0),
      notes: p.notes || 'Account Payment',
      type: 'ACCOUNT_PAYMENT'
    }));

    const formattedInvoice = invoicePayments.map((p) => ({
      id: p.id,
      receipt_number: p.reference_number || `PAY-${p.sales?.invoice_number || p.id.slice(0, 8).toUpperCase()}`,
      reference_number: p.sales?.invoice_number,
      payment_date: p.payment_date || p.created_at,
      payment_mode: p.payment_method || 'CASH',
      amount: Number(p.amount || 0),
      notes: p.notes || `Payment for Invoice ${p.sales?.invoice_number || ''}`,
      type: 'INVOICE_PAYMENT'
    }));

    // Merge and sort newest first
    const allPayments = [...formattedDirect, ...formattedInvoice].sort(
      (a, b) => new Date(b.payment_date) - new Date(a.payment_date)
    );

    return sendSuccess(res, 'Customer payments retrieved', allPayments);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/ledger
 * Real-time ledger entries and running balance calculation
 */
router.get('/:shopSlug/ledger', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const ledgerData = await customerService.getCustomerLedger(req.portalBusiness.id, c.id);
    return sendSuccess(res, 'Customer ledger', ledgerData);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/portal/:shopSlug/orders
 * Submitted store orders & status tracking
 */
router.get('/:shopSlug/orders', async (req, res, next) => {
  try {
    const c = req.currentCustomer;
    const orders = await prisma.customer_orders.findMany({
      where: {
        business_id: req.portalBusiness.id,
        OR: [
          { customer_id: c.id },
          c.phone ? { customer_phone: c.phone } : undefined
        ].filter(Boolean)
      },
      orderBy: { created_at: 'desc' },
      include: {
        customer_order_items: true
      }
    });

    return sendSuccess(res, 'Customer orders retrieved', orders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

