const { z } = require('zod');

const salePaymentItemSchema = z.object({
  payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']),
  amount: z.number().min(0),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable()
});

const saleItemSchema = z.object({
  product_id: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  variant_id: z.string().uuid().optional().nullable(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0).optional(),
  unitPrice: z.number().min(0).optional(),
  discount_percentage: z.number().min(0).max(100).default(0),
  discount_amount: z.number().min(0).default(0),
  gst_percentage: z.number().min(0).max(100).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  is_igst: z.boolean().default(false)
}).transform(val => ({
  product_id: val.product_id || val.productId,
  variant_id: val.variant_id || val.variantId || null,
  quantity: val.quantity,
  unit_price: val.unit_price !== undefined ? val.unit_price : val.unitPrice,
  discount_percentage: val.discount_percentage,
  discount_amount: val.discount_amount,
  gst_percentage: val.gst_percentage !== undefined ? val.gst_percentage : val.taxRate,
  is_igst: val.is_igst
})).refine(val => !!val.product_id, {
  message: 'product_id or productId is required',
  path: ['product_id']
});

const createSaleSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  invoiceNumber: z.string().optional().nullable(),
  invoice_type: z.enum(['SALE', 'RETAIL', 'WHOLESALE', 'RETURN', 'ESTIMATE', 'QUOTATION', 'PROFORMA']).optional().default('SALE'),
  invoiceType: z.string().optional(),
  invoice_date: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Sale must contain at least one item'),
  payments: z.array(salePaymentItemSchema).optional().default([]),
  paymentMethod: z.string().optional(),
  payment_method: z.string().optional(),
  
  // Discount Breakdown Fields
  trade_discount_type: z.enum(['PERCENT', 'AMOUNT']).optional().default('PERCENT'),
  trade_discount_value: z.number().min(0).optional().default(0),
  scheme_discount_type: z.enum(['PERCENT', 'AMOUNT']).optional().default('PERCENT'),
  scheme_discount_value: z.number().min(0).optional().default(0),
  cash_discount_type: z.enum(['PERCENT', 'AMOUNT']).optional().default('PERCENT'),
  cash_discount_value: z.number().min(0).optional().default(0),
  less_amount: z.number().min(0).optional().default(0),

  discount_amount: z.number().min(0).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  round_off: z.number().optional().default(0),
  notes: z.string().optional().nullable()
}).transform(val => {
  const pm = val.paymentMethod || val.payment_method;
  return {
    customer_id: val.customer_id !== undefined ? val.customer_id : (val.customerId || null),
    invoice_number: val.invoice_number || val.invoiceNumber || null,
    invoice_type: val.invoice_type || (val.invoiceType === 'RETAIL' || val.invoiceType === 'WHOLESALE' ? 'SALE' : val.invoiceType) || 'SALE',
    invoice_date: val.invoice_date,
    items: val.items,
    paymentMethod: pm,
    payment_method: pm,
    payments: val.payments.length > 0 ? val.payments : (pm ? [{ payment_method: pm === 'CREDIT' ? 'CREDIT' : (['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE'].includes(pm) ? pm : 'CASH'), amount: 0 }] : []),
    trade_discount_type: val.trade_discount_type,
    trade_discount_value: val.trade_discount_value,
    scheme_discount_type: val.scheme_discount_type,
    scheme_discount_value: val.scheme_discount_value,
    cash_discount_type: val.cash_discount_type,
    cash_discount_value: val.cash_discount_value,
    less_amount: val.less_amount,
    discount_amount: val.discount_amount || val.discountAmount || 0,
    round_off: val.round_off,
    notes: val.notes
  };
});

const saleReturnSchema = z.object({
  returned_items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional().nullable(),
    quantity: z.number().positive()
  })).min(1),
  reason: z.string().optional().nullable(),
  refund_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT', 'STORE_CREDIT']).optional().default('CASH'),
  refund_status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional().default('COMPLETED'),
  notes: z.string().optional().nullable()
});

module.exports = {
  createSaleSchema,
  saleReturnSchema
};
