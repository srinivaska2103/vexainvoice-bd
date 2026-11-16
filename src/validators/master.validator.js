const { z } = require('zod');

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(150),
  description: z.string().optional(),
  is_active: z.boolean().default(true)
});

const brandSchema = z.object({
  name: z.string().min(1, 'Brand name is required').max(150),
  is_active: z.boolean().default(true)
});

const colorSchema = z.object({
  name: z.string().min(1, 'Color name is required').max(100),
  hex_code: z.string().max(10).optional()
});

const sizeSchema = z.object({
  name: z.string().min(1, 'Size name is required').max(50),
  sort_order: z.number().int().default(0)
});

module.exports = {
  categorySchema,
  brandSchema,
  colorSchema,
  sizeSchema
};
