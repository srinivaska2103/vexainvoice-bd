const { z } = require('zod');

const purchasePaymentItemSchema = z.object({
  payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']),
  amount: z.number().min(0),
  reference_number: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable()
});

const purchaseItemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  gst_percentage: z.number().min(0).max(100).default(0),
  is_igst: z.boolean().default(false)
});

const createPurchaseSchema = z.object({
  supplier_id: z.string().uuid().optional().nullable(),
  purchase_number: z.string().max(50).optional(),
  purchase_date: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'Purchase must contain at least one item'),
  payments: z.array(purchasePaymentItemSchema).optional().default([]),
  discount_amount: z.number().min(0).default(0),
  round_off: z.number().default(0),
  notes: z.string().optional().nullable()
});

const purchaseReturnSchema = z.object({
  returned_items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional().nullable(),
    quantity: z.number().positive()
  })).min(1),
  reason: z.string().optional()
});

module.exports = {
  createPurchaseSchema,
  purchaseReturnSchema
};
