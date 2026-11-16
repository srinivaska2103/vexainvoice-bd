const { z } = require('zod');

const quotationItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
  product_name: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  discount_amount: z.number().min(0).default(0),
  gst_percentage: z.number().min(0).default(0),
  sku: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  unit: z.string().optional().nullable()
});

const createQuotationSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  quotation_number: z.string().max(50).optional(),
  quotation_date: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  items: z.array(quotationItemSchema).min(1, 'Quotation must contain at least one item'),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']).optional().default('DRAFT'),
  discount_amount: z.number().min(0).optional().default(0),
  trade_discount_type: z.enum(['PERCENT', 'FIXED']).optional().default('PERCENT'),
  trade_discount_value: z.number().min(0).optional().default(0),
  scheme_discount_type: z.enum(['PERCENT', 'FIXED']).optional().default('PERCENT'),
  scheme_discount_value: z.number().min(0).optional().default(0),
  cash_discount_type: z.enum(['PERCENT', 'FIXED']).optional().default('PERCENT'),
  cash_discount_value: z.number().min(0).optional().default(0),
  less_amount: z.number().min(0).optional().default(0),
  round_off: z.number().optional().default(0),
  apply_gst: z.boolean().optional().default(true),
  payment_terms: z.string().optional().nullable(),
  delivery_terms: z.string().optional().nullable(),
  customer_snapshot: z.record(z.any()).optional().nullable(),
  notes: z.string().optional().nullable()
});

const updateQuotationSchema = createQuotationSchema.partial();

const updateStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'])
});

module.exports = {
  createQuotationSchema,
  updateQuotationSchema,
  updateStatusSchema
};
