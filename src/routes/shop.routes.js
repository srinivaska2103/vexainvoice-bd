const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response.util');

// GET /api/shop/:shopSlug
// Fetches public shop profile and active products catalogue for public customer portal
router.get('/:shopSlug', async (req, res, next) => {
  try {
    const { shopSlug } = req.params;
    const { search = '', category = '' } = req.query;

    if (!shopSlug || !shopSlug.trim()) {
      return sendError(res, 'Shop identifier slug is required.', 400);
    }

    const cleanSlug = shopSlug.trim();

    // Match business by company_id (e.g. VEXA-000101) or business_name
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
        address: true,
        is_active: true
      }
    });

    // Fallback: If slug contains hyphens (e.g., sai-textiles), search without hyphens
    if (!business && cleanSlug.includes('-')) {
      const spacedName = cleanSlug.replace(/-/g, ' ');
      business = await prisma.businesses.findFirst({
        where: {
          business_name: { equals: spacedName, mode: 'insensitive' }
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
          address: true,
          is_active: true
        }
      });
    }

    if (!business || !business.is_active) {
      return sendError(res, `Shop '${shopSlug}' was not found or is currently inactive.`, 404);
    }

    // Query active categories for filter pills
    const categoriesList = await prisma.categories.findMany({
      where: {
        business_id: business.id,
        is_active: true
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    // Query active brands for filter pills
    const brandsList = await prisma.brands.findMany({
      where: {
        business_id: business.id,
        is_active: true
      },
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    });

    // Build product filter
    const productWhere = {
      business_id: business.id,
      is_active: true,
      ...(category ? { category_id: category } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    };

    // Query active products for this shop only (Strict Company Isolation)
    const rawProducts = await prisma.products.findMany({
      where: productWhere,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unit: true,
        retail_price: true,
        purchase_price: true,
        category_id: true,
        brand_id: true,
        categories: {
          select: {
            id: true,
            name: true
          }
        },
        brands: {
          select: {
            id: true,
            name: true
          }
        },
        product_variants: {
          select: {
            id: true,
            variant_name: true,
            sku: true,
            barcode: true,
            retail_price: true,
            purchase_price: true,
            current_stock: true,
            colors: {
              select: {
                id: true,
                name: true,
                hex_code: true
              }
            },
            sizes: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        product_stock: {
          select: {
            quantity: true,
            variant_id: true
          }
        }
      }
    });

    // Format products for Text-Only Card UI (NO image fields returned)
    const formattedProducts = rawProducts.map((p) => {
      // Calculate overall stock
      const totalStock = (p.product_stock || []).reduce((acc, s) => acc + Number(s.quantity || 0), 0);
      
      const variants = (p.product_variants || []).map((v) => ({
        id: v.id,
        variantName: v.variant_name || `${v.colors?.name || ''} ${v.sizes?.name || ''}`.trim() || 'Standard',
        sku: v.sku || null,
        barcode: v.barcode || null,
        price: Number(v.purchase_price || p.purchase_price || v.retail_price || p.retail_price || 0),
        purchasePrice: Number(v.purchase_price || p.purchase_price || 0),
        retailPrice: Number(v.retail_price || p.retail_price || 0),
        color: v.colors?.name || null,
        colorHex: v.colors?.hex_code || null,
        size: v.sizes?.name || null,
        stock: Number(v.current_stock || 0)
      }));

      return {
        id: p.id,
        name: p.name,
        sku: p.sku || null,
        barcode: p.barcode || null,
        unit: p.unit || 'PCS',
        sellingPrice: Number(p.purchase_price || p.retail_price || 0),
        purchasePrice: Number(p.purchase_price || 0),
        retailPrice: Number(p.retail_price || 0),
        categoryName: p.categories?.name || 'General',
        categoryId: p.categories?.id || null,
        brandName: p.brands?.name || 'General',
        brandId: p.brands?.id || null,
        totalStock: totalStock,
        variants: variants
      };
    });

    // Extract clean logo_url if stored inside business settings JSON string
    let extractedLogoUrl = business.logo_url;
    if (typeof extractedLogoUrl === 'string' && extractedLogoUrl.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(extractedLogoUrl);
        extractedLogoUrl = parsed.logo_url || parsed.logo || parsed.url || extractedLogoUrl;
      } catch (e) {}
    }

    // Evaluate QR Self-Shopping Entitlement for shop catalogue state
    const { evaluateSelfShoppingEntitlement } = require('../utils/selfShoppingPolicy');
    const entitlement = await evaluateSelfShoppingEntitlement(business);

    return sendSuccess(res, 'Public shop catalogue fetched', {
      shop: {
        name: business.business_name,
        companyId: business.company_id,
        type: business.business_type,
        logoUrl: extractedLogoUrl,
        city: business.city,
        state: business.state,
        phone: business.phone,
        address: business.address
      },
      entitlement: {
        allowed: entitlement.allowed,
        status: entitlement.status,
        isTrial: entitlement.isTrial,
        isLifetime: entitlement.isLifetime,
        daysRemaining: entitlement.daysRemaining,
        trialEnd: entitlement.trialEnd
      },
      categories: categoriesList,
      brands: brandsList,
      products: formattedProducts
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/shop/:shopSlug/order
// Public endpoint for customer to submit cart items as a PENDING_REVIEW order
// Authoritative backend price & stock calculation, idempotency support, company isolation
router.post('/:shopSlug/order', async (req, res, next) => {
  try {
    const { shopSlug } = req.params;
    const customerOrderService = require('../services/customerOrder.service');

    const result = await customerOrderService.submitCustomerOrder(shopSlug, req.body);
    return sendSuccess(res, result.message, {
      order: {
        id: result.order.id,
        orderNumber: result.order.order_number,
        status: result.order.status,
        customerName: result.order.customer_name,
        customerPhone: result.order.customer_phone,
        customerAddress: result.order.customer_address,
        estimatedTotal: Number(result.order.estimated_total),
        createdAt: result.order.created_at,
        shop: {
          name: result.order.businesses?.business_name,
          companyId: result.order.businesses?.company_id,
          phone: result.order.businesses?.phone
        },
        items: (result.order.customer_order_items || []).map(i => ({
          productName: i.product_name,
          variantName: i.variant_name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
          lineTotal: Number(i.line_total)
        }))
      },
      isDuplicate: result.isDuplicate
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/shop/:shopSlug/order/:orderId
// Public endpoint for customer to track live order status (polling & refresh)
router.get('/:shopSlug/order/:orderId', async (req, res, next) => {
  try {
    const { shopSlug, orderId } = req.params;

    const cleanSlug = shopSlug.trim();
    const business = await prisma.businesses.findFirst({
      where: {
        OR: [
          { company_id: { equals: cleanSlug, mode: 'insensitive' } },
          { id: cleanSlug.match(/^[0-9a-fA-F-]{36}$/) ? cleanSlug : undefined },
          { business_name: { equals: cleanSlug, mode: 'insensitive' } }
        ].filter(Boolean)
      },
      select: { id: true, business_name: true, company_id: true, phone: true }
    });

    if (!business) {
      return sendError(res, 'Shop not found.', 404);
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(orderId);
    const order = await prisma.customer_orders.findFirst({
      where: {
        business_id: business.id,
        ...(isUuid
          ? { OR: [{ id: orderId }, { order_number: orderId }] }
          : { order_number: orderId }
        )
      },
      include: {
        customer_order_items: true
      }
    });

    if (!order) {
      return sendError(res, 'Order not found.', 404);
    }

    let invoiceData = null;
    let authoritativeItems = (order.customer_order_items || []).map(i => ({
      productName: i.product_name,
      variantName: i.variant_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total)
    }));

    if (order.sale_id) {
      const sale = await prisma.sales.findUnique({
        where: { id: order.sale_id },
        select: {
          id: true,
          invoice_number: true,
          grand_total: true,
          created_at: true,
          status: true,
          sale_items: {
            include: {
              product_variants: {
                select: {
                  variant_name: true,
                  colors: { select: { name: true } },
                  sizes: { select: { name: true } }
                }
              }
            }
          }
        }
      });

      if (sale) {
        invoiceData = {
          id: sale.id,
          invoiceNumber: sale.invoice_number,
          grandTotal: Number(sale.grand_total),
          createdAt: sale.created_at,
          status: sale.status
        };

        // When order has been billed/invoiced, display the authoritative products from the invoice
        // This includes all original items and extra products added by shop ADMIN in /sales/new
        if (sale.sale_items && sale.sale_items.length > 0) {
          authoritativeItems = sale.sale_items.map(si => {
            const v = si.product_variants;
            const variantStr = v ? (v.variant_name || [v.colors?.name, v.sizes?.name].filter(Boolean).join(' / ') || null) : null;
            return {
              productName: si.product_name,
              variantName: variantStr,
              quantity: Number(si.quantity),
              unitPrice: Number(si.unit_price),
              lineTotal: Number(si.total_amount)
            };
          });
        }
      }
    }

    return sendSuccess(res, 'Order status retrieved', {
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerAddress: order.customer_address,
        estimatedTotal: invoiceData ? invoiceData.grandTotal : Number(order.estimated_total),
        rejectionReason: order.rejection_reason,
        adjustmentNotes: order.adjustment_notes,
        createdAt: order.created_at,
        reviewedAt: order.reviewed_at,
        invoice: invoiceData,
        shop: {
          name: business.business_name,
          companyId: business.company_id,
          phone: business.phone
        },
        items: authoritativeItems
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

