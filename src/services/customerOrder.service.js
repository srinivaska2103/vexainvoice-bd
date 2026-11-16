const prisma = require('../config/db');

/**
 * Generate sequential Customer Order Reference for a business
 * Format: ORD-YYYY-XXXX (e.g. ORD-2026-0001)
 */
const generateOrderNumber = async (business_id) => {
  const currentYear = new Date().getFullYear();
  const yearStr = String(currentYear);
  const prefix = `ORD-${yearStr}-`;

  const orders = await prisma.customer_orders.findMany({
    where: {
      business_id,
      order_number: { startsWith: prefix }
    },
    select: { order_number: true },
    orderBy: { created_at: 'desc' },
    take: 50
  });

  let maxSeq = 0;
  for (const o of orders) {
    if (o.order_number && o.order_number.startsWith(prefix)) {
      const num = parseInt(o.order_number.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
};

/**
 * Submit a customer cart to create a PENDING_REVIEW customer order
 * Authoritative Backend Pricing & Stock Checks
 * DOES NOT deduct inventory. DOES NOT create final invoice or mark payment.
 */
const submitCustomerOrder = async (shopSlug, payload) => {
  const {
    items = [],
    customerName = '',
    customerPhone = '',
    customerEmail = '',
    customerAddress = '',
    notes = '',
    sessionToken = '',
    idempotencyKey = ''
  } = payload;

  if (!items || !Array.isArray(items) || items.length === 0) {
    const err = new Error('Cart is empty. Please add at least one product before submitting.');
    err.statusCode = 400;
    throw err;
  }

  // Check idempotency if key is provided
  if (idempotencyKey) {
    const existingOrder = await prisma.customer_orders.findFirst({
      where: { idempotency_key: idempotencyKey },
      include: {
        customer_order_items: true,
        businesses: {
          select: {
            business_name: true,
            company_id: true,
            phone: true
          }
        }
      }
    });

    if (existingOrder) {
      return {
        order: existingOrder,
        isDuplicate: true,
        message: 'Order has already been submitted.'
      };
    }
  }

  // Resolve business by shopSlug
  const cleanSlug = shopSlug.trim();
  let business = await prisma.businesses.findFirst({
    where: {
      OR: [
        { company_id: { equals: cleanSlug, mode: 'insensitive' } },
        { id: cleanSlug.match(/^[0-9a-fA-F-]{36}$/) ? cleanSlug : undefined },
        { business_name: { equals: cleanSlug, mode: 'insensitive' } }
      ].filter(Boolean)
    }
  });

  if (!business && cleanSlug.includes('-')) {
    const spacedName = cleanSlug.replace(/-/g, ' ');
    business = await prisma.businesses.findFirst({
      where: { business_name: { equals: spacedName, mode: 'insensitive' } }
    });
  }

  if (!business || !business.is_active) {
    const err = new Error('Shop not found or inactive.');
    err.statusCode = 404;
    throw err;
  }

  // Enforce QR Self-Shopping & Customer Orders Entitlement
  const { evaluateSelfShoppingEntitlement } = require('../utils/selfShoppingPolicy');
  const entitlement = await evaluateSelfShoppingEntitlement(business);

  if (!entitlement.allowed) {
    const err = new Error(
      entitlement.reason ||
      'This shop’s Self-Shopping portal trial has expired. Online order submissions are currently disabled.'
    );
    err.statusCode = 403;
    err.entitlementStatus = entitlement.status;
    throw err;
  }

  const businessId = business.id;

  // Derive or match customer in company-scoped Customers table
  const trimmedName = (customerName || '').trim();
  const trimmedPhone = (customerPhone || '').trim();
  const trimmedEmail = (customerEmail || '').trim().toLowerCase();
  const trimmedAddress = (customerAddress || '').trim();

  let resolvedCustomerId = null;
  let resolvedCustomerName = trimmedName;

  const getNextCustomerCode = async (bId) => {
    const custs = await prisma.customers.findMany({
      where: { business_id: bId },
      select: { customer_code: true }
    });
    let max = 0;
    for (const c of custs) {
      if (c.customer_code) {
        const m = c.customer_code.match(/CUST-(\d+)/);
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > max) max = num;
        }
      }
    }
    return `CUST-${String(max + 1).padStart(4, '0')}`;
  };

  try {
    if (trimmedPhone) {
      // 1. Match existing customer ONLY using reliable identifier (phone) within the business
      let existingCustomer = await prisma.customers.findFirst({
        where: {
          business_id: businessId,
          phone: trimmedPhone
        }
      });

      if (existingCustomer) {
        resolvedCustomerId = existingCustomer.id;
        resolvedCustomerName = existingCustomer.name || trimmedName;
        // Safely update address, email, active status or name if not previously present
        const updateData = {};
        if (trimmedAddress && !existingCustomer.address) updateData.address = trimmedAddress;
        if (trimmedEmail && !existingCustomer.email) updateData.email = trimmedEmail;
        if (trimmedName && (!existingCustomer.name || existingCustomer.name === 'Walk-in Customer')) updateData.name = trimmedName;
        if (existingCustomer.customer_type === 'PURCHASE') updateData.customer_type = 'BUSINESS';
        if (!existingCustomer.is_active) updateData.is_active = true;
        if (Object.keys(updateData).length > 0) {
          await prisma.customers.update({
            where: { id: existingCustomer.id },
            data: updateData
          });
        }
      } else {
        // Create new company-scoped customer record as BUSINESS (Shop Customer)
        const code = await getNextCustomerCode(businessId);
        const newCust = await prisma.customers.create({
          data: {
            business_id: businessId,
            customer_code: code,
            name: trimmedName || `Customer ${trimmedPhone.slice(-4)}`,
            phone: trimmedPhone,
            email: trimmedEmail || null,
            address: trimmedAddress || null,
            customer_type: 'BUSINESS',
            price_level: 'RETAIL',
            is_active: true
          }
        });
        resolvedCustomerId = newCust.id;
        resolvedCustomerName = newCust.name;
      }
    } else if (trimmedName && trimmedName.toLowerCase() !== 'walk-in customer') {
      // 2. Name provided without phone - create customer record or reuse if identical
      let existingByName = await prisma.customers.findFirst({
        where: {
          business_id: businessId,
          name: { equals: trimmedName, mode: 'insensitive' }
        }
      });

      if (existingByName) {
        resolvedCustomerId = existingByName.id;
        resolvedCustomerName = existingByName.name;
        const updateData = {};
        if (trimmedAddress && !existingByName.address) updateData.address = trimmedAddress;
        if (trimmedEmail && !existingByName.email) updateData.email = trimmedEmail;
        if (existingByName.customer_type === 'PURCHASE') updateData.customer_type = 'BUSINESS';
        if (!existingByName.is_active) updateData.is_active = true;
        if (Object.keys(updateData).length > 0) {
          await prisma.customers.update({
            where: { id: existingByName.id },
            data: updateData
          });
        }
      } else {
        const code = await getNextCustomerCode(businessId);
        const newCust = await prisma.customers.create({
          data: {
            business_id: businessId,
            customer_code: code,
            name: trimmedName,
            email: trimmedEmail || null,
            address: trimmedAddress || null,
            customer_type: 'BUSINESS',
            price_level: 'RETAIL',
            is_active: true
          }
        });
        resolvedCustomerId = newCust.id;
        resolvedCustomerName = newCust.name;
      }
    } else {
      // 3. No identifying details supplied: reuse or create the company's designated Walk-in Customer record
      let walkInCust = await prisma.customers.findFirst({
        where: {
          business_id: businessId,
          name: { equals: 'Walk-in Customer', mode: 'insensitive' }
        }
      });

      if (!walkInCust) {
        const code = await getNextCustomerCode(businessId);
        walkInCust = await prisma.customers.create({
          data: {
            business_id: businessId,
            customer_code: code,
            name: 'Walk-in Customer',
            customer_type: 'BUSINESS',
            price_level: 'RETAIL',
            is_active: true
          }
        });
      }

      resolvedCustomerId = walkInCust.id;
      resolvedCustomerName = walkInCust.name;
    }
  } catch (custErr) {
    console.error('Error resolving or creating shop customer:', custErr);
  }

  // Validate all items & calculate authoritative totals strictly from database
  let estimatedTotal = 0;
  const validatedItems = [];

  for (const item of items) {
    const productId = item.productId || item.product_id || item.id;
    const variantId = item.variantId || item.variant_id || null;
    const requestedQty = parseFloat(item.quantity || 1);

    if (isNaN(requestedQty) || requestedQty <= 0) {
      const err = new Error('Invalid item quantity.');
      err.statusCode = 400;
      throw err;
    }

    // Verify product belongs to this business
    const product = await prisma.products.findFirst({
      where: {
        id: productId,
        business_id: businessId,
        is_active: true
      },
      include: {
        product_variants: {
          include: {
            colors: true,
            sizes: true
          }
        }
      }
    });

    if (!product) {
      const err = new Error(`One or more items in the cart do not belong to ${business.business_name} or are no longer active.`);
      err.statusCode = 400;
      throw err;
    }

    let authoritativeUnitPrice = parseFloat(product.purchase_price || product.retail_price || 0);
    let variantName = null;
    let colorName = null;
    let sizeName = null;
    let sku = product.sku;
    let barcode = product.barcode;

    if (product.has_variants || (product.product_variants && product.product_variants.length > 0)) {
      if (!variantId) {
        // If product has variants, require customer to select a variant
        const firstVar = product.product_variants[0];
        if (!firstVar) {
          const err = new Error(`Variant selection required for "${product.name}".`);
          err.statusCode = 400;
          throw err;
        }
      }

      const selectedVar = product.product_variants.find(v => v.id === variantId);
      if (!selectedVar && variantId) {
        const err = new Error(`Selected variant not found for "${product.name}".`);
        err.statusCode = 400;
        throw err;
      }

      const activeVar = selectedVar || product.product_variants[0];
      if (activeVar) {
        authoritativeUnitPrice = parseFloat(activeVar.purchase_price || activeVar.retail_price || product.purchase_price || product.retail_price || 0);
        variantName = activeVar.variant_name || `${activeVar.colors?.name || ''} ${activeVar.sizes?.name || ''}`.trim() || 'Standard';
        colorName = activeVar.colors?.name || null;
        sizeName = activeVar.sizes?.name || null;
        sku = activeVar.sku || sku;
        barcode = activeVar.barcode || barcode;
      }
    }

    const lineTotal = parseFloat((authoritativeUnitPrice * requestedQty).toFixed(2));
    estimatedTotal += lineTotal;

    validatedItems.push({
      productId: product.id,
      variantId: variantId,
      productName: product.name,
      variantName: variantName,
      sku: sku,
      barcode: barcode,
      color: colorName,
      size: sizeName,
      quantity: requestedQty,
      unitPrice: authoritativeUnitPrice,
      lineTotal: lineTotal
    });
  }

  // Generate unique order number
  const orderNumber = await generateOrderNumber(businessId);

  // Create order & order items in a transaction
  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.customer_orders.create({
      data: {
        business_id: businessId,
        order_number: orderNumber,
        status: 'PENDING_REVIEW',
        session_token: sessionToken || null,
        idempotency_key: idempotencyKey || null,
        customer_id: resolvedCustomerId || null,
        customer_name: resolvedCustomerName || (customerName || '').trim() || 'Walk-in Customer',
        customer_phone: (customerPhone || '').trim() || null,
        customer_address: (customerAddress || '').trim() || null,
        notes: (notes || '').trim() || null,
        estimated_total: parseFloat(estimatedTotal.toFixed(2)),
        customer_order_items: {
          create: validatedItems.map(vi => ({
            product_id: vi.productId,
            variant_id: vi.variantId,
            product_name: vi.productName,
            variant_name: vi.variantName,
            sku: vi.sku,
            barcode: vi.barcode,
            color: vi.color,
            size: vi.size,
            quantity: vi.quantity,
            unit_price: vi.unitPrice,
            line_total: vi.lineTotal
          }))
        }
      },
      include: {
        customer_order_items: true,
        businesses: {
          select: {
            business_name: true,
            company_id: true,
            phone: true,
            address: true,
            city: true
          }
        }
      }
    });

    return order;
  });

  // Post-transaction WhatsApp Order Receipt notification (Template: vexa_order_receipt)
  setTimeout(async () => {
    try {
      const WhatsAppTemplateService = require('./whatsappTemplateService');
      await WhatsAppTemplateService.sendOrderReceipt({ orderId: createdOrder.id });
    } catch (orderNotifErr) {
      console.error('Async order receipt WhatsApp trigger error:', orderNotifErr.message);
    }
  }, 10);

  return {
    order: createdOrder,
    isDuplicate: false,
    message: 'Your order has been submitted successfully to the shop! The shop administrator will review and bill your order.'
  };
};

/**
 * Get all customer orders for an ADMIN's business
 */
const getCustomerOrders = async (business_id, queryParams = {}) => {
  const { status, search = '', page = 1, limit = 50 } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(status && status !== 'ALL' ? { status } : {}),
    ...(search ? {
      OR: [
        { order_number: { contains: search, mode: 'insensitive' } },
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };

  const total = await prisma.customer_orders.count({ where });
  const orders = await prisma.customer_orders.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { created_at: 'desc' },
    include: {
      customer_order_items: true,
      customers: true
    }
  });

  return {
    orders,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Get single customer order details
 */
const getCustomerOrderById = async (business_id, orderId) => {
  const order = await prisma.customer_orders.findFirst({
    where: {
      id: orderId,
      business_id
    },
    include: {
      customer_order_items: true,
      customers: true,
      businesses: {
        select: {
          business_name: true,
          company_id: true,
          phone: true,
          address: true
        }
      }
    }
  });

  if (!order) {
    const err = new Error('Customer order not found.');
    err.statusCode = 404;
    throw err;
  }

  // Enrich items with live current stock & price for ADMIN review using authoritative stock service
  const { getCurrentStock } = require('./stock.service');
  const liveStockRes = await getCurrentStock(business_id, { limit: 1000 });
  const stockMap = new Map((liveStockRes.stock || []).map(s => [s.id, s]));

  const enrichedItems = order.customer_order_items.map((item) => {
    const liveProduct = stockMap.get(item.product_id);
    let liveStock = 0;
    let livePrice = parseFloat(item.unit_price);

    if (item.variant_id && liveProduct) {
      const liveVariant = (liveProduct.variants || []).find(v => v.id === item.variant_id);
      if (liveVariant) {
        liveStock = Number(liveVariant.stockQuantity ?? liveVariant.quantity ?? 0);
        livePrice = Number(liveVariant.retail_price ?? item.unit_price);
      } else {
        liveStock = Number(liveProduct.stockQuantity ?? 0);
      }
    } else if (liveProduct) {
      liveStock = Number(liveProduct.stockQuantity ?? 0);
    }

    return {
      ...item,
      liveStock,
      livePrice,
      priceChanged: livePrice !== parseFloat(item.unit_price),
      hasSufficientStock: liveStock >= parseFloat(item.quantity)
    };
  });

  return {
    ...order,
    customer_order_items: enrichedItems
  };
};

/**
 * ADMIN Action: Update customer order status (ACCEPT, REJECT, ADJUST, READY_FOR_BILLING)
 */
const updateCustomerOrderStatus = async (business_id, orderId, userId, payload) => {
  const { status, rejectionReason, adjustmentNotes, updatedItems } = payload;

  const order = await prisma.customer_orders.findFirst({
    where: { id: orderId, business_id }
  });

  if (!order) {
    const err = new Error('Customer order not found.');
    err.statusCode = 404;
    throw err;
  }

  if (order.status === 'BILLED') {
    const err = new Error('Cannot modify an order that has already been billed.');
    err.statusCode = 400;
    throw err;
  }

  const updatedOrder = await prisma.$transaction(async (tx) => {
    // If updated items were sent (e.g. ADMIN changed quantities or marked items removed)
    if (updatedItems && Array.isArray(updatedItems)) {
      let newEstimatedTotal = 0;
      for (const ui of updatedItems) {
        if (ui.id) {
          const qty = parseFloat(ui.quantity || 1);
          const isRemoved = Boolean(ui.is_removed);
          const lineTotal = isRemoved ? 0 : parseFloat((parseFloat(ui.unit_price || 0) * qty).toFixed(2));
          if (!isRemoved) newEstimatedTotal += lineTotal;

          await tx.customer_order_items.update({
            where: { id: ui.id },
            data: {
              quantity: qty,
              is_removed: isRemoved,
              removal_reason: ui.removal_reason || null,
              line_total: lineTotal
            }
          });
        }
      }

      await tx.customer_orders.update({
        where: { id: orderId },
        data: { estimated_total: newEstimatedTotal }
      });
    }

    const updated = await tx.customer_orders.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
        ...(adjustmentNotes ? { adjustment_notes: adjustmentNotes } : {}),
        reviewed_by: userId,
        reviewed_at: new Date()
      },
      include: {
        customer_order_items: true
      }
    });

    return updated;
  });

  return updatedOrder;
};

/**
 * Link created sale invoice to customer order and update status to BILLED
 */
const markCustomerOrderAsBilled = async (business_id, orderId, saleId, userId) => {
  const order = await prisma.customer_orders.findFirst({
    where: { id: orderId, business_id }
  });

  if (!order) return null;

  return await prisma.customer_orders.update({
    where: { id: orderId },
    data: {
      status: 'BILLED',
      sale_id: saleId,
      reviewed_by: userId,
      reviewed_at: new Date()
    }
  });
};

module.exports = {
  generateOrderNumber,
  submitCustomerOrder,
  getCustomerOrders,
  getCustomerOrderById,
  updateCustomerOrderStatus,
  markCustomerOrderAsBilled
};
