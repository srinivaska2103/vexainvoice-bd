const { z } = require('zod');

const productVariantSchema = z.object({
  color_id: z.string().uuid().optional().nullable(),
  size_id: z.string().uuid().optional().nullable(),
  variant_name: z.string().max(200).optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  purchase_price: z.number().min(0).default(0),
  retail_price: z.number().min(0).default(0),
  wholesale_price: z.number().min(0).default(0),
  dealer_price: z.number().min(0).default(0),
  opening_stock: z.number().min(0).default(0)
});

const createProductSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  brand_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(200),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  unit: z.enum(['PCS', 'DOZEN', 'BOX', 'BUNDLE', 'METER', 'KG', 'GRAM', 'ROLL', 'SET']).default('PCS'),
  hsn_code: z.string().max(20).optional().nullable(),
  gst_percentage: z.number().min(0).max(100).default(0),
  purchase_price: z.number().min(0).default(0),
  retail_price: z.number().min(0).default(0),
  wholesale_price: z.number().min(0).default(0),
  dealer_price: z.number().min(0).default(0),
  minimum_stock: z.number().min(0).default(0),
  maximum_stock: z.number().min(0).optional().nullable(),
  has_variants: z.boolean().default(false),
  is_active: z.boolean().default(true),
  opening_stock: z.number().min(0).default(0),
  variants: z.array(productVariantSchema).optional()
});

const updateProductSchema = createProductSchema.partial();

module.exports = {
  createProductSchema,
  updateProductSchema,
  productVariantSchema
};
