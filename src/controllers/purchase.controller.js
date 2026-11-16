const purchaseService = require('../services/purchase.service');
const { createPurchaseSchema, purchaseReturnSchema } = require('../validators/purchase.validator');
const { sendSuccess } = require('../utils/response.util');

const getPurchases = async (req, res, next) => {
  try {
    const result = await purchaseService.getPurchases(req.user.business_id, req.query);
    return sendSuccess(res, 'Purchases fetched', result.purchases, 200, result.pagination);
  } catch (error) { next(error); }
};

const getPurchaseById = async (req, res, next) => {
  try {
    const purchase = await purchaseService.getPurchaseById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Purchase details fetched', purchase);
  } catch (error) { next(error); }
};

const createPurchase = async (req, res, next) => {
  try {
    const rawBody = req.body || {};
    const normalizedData = {
      supplier_id: rawBody.supplier_id || rawBody.supplierId || null,
      purchase_number: rawBody.purchase_number || rawBody.supplierInvoiceNumber || rawBody.purchaseNumber || undefined,
      purchase_date: rawBody.purchase_date || rawBody.purchaseDate || undefined,
      discount_amount: rawBody.discount_amount ?? rawBody.discountAmount ?? 0,
      round_off: rawBody.round_off ?? rawBody.roundOff ?? 0,
      notes: rawBody.notes || null,
      payments: (rawBody.payments || []).map((p) => ({
        payment_method: p.payment_method || p.paymentMethod || 'CASH',
        amount: Number(p.amount || 0),
        reference_number: p.reference_number || p.referenceNumber || null,
        notes: p.notes || null
      })),
      items: (rawBody.items || []).map((item) => ({
        product_id: item.product_id || item.productId,
        variant_id: item.variant_id || item.variantId || null,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price ?? item.unitPrice ?? item.unitCost ?? 0),
        discount_amount: Number(item.discount_amount ?? item.discountAmount ?? 0),
        gst_percentage: Number(item.gst_percentage ?? item.gstPercentage ?? item.taxRate ?? 0),
        is_igst: Boolean(item.is_igst ?? item.isIgst ?? false)
      }))
    };

    const data = createPurchaseSchema.parse(normalizedData);
    const purchase = await purchaseService.createPurchase(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Purchase created successfully', purchase, 201);
  } catch (error) { next(error); }
};

const returnPurchase = async (req, res, next) => {
  try {
    const data = purchaseReturnSchema.parse(req.body);
    const result = await purchaseService.returnPurchase(req.user.business_id, req.params.id, req.user.id, data);
    return sendSuccess(res, result.message, result);
  } catch (error) { next(error); }
};

module.exports = {
  getPurchases,
  getPurchaseById,
  createPurchase,
  returnPurchase
};
