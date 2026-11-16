const { z } = require('zod');

const createSupplierSchema = z.object({
  supplier_code: z.string().max(50).optional().nullable(),
  name: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  gst_number: z.string().max(20).optional().nullable(),
  opening_balance: z.number().default(0),
  is_active: z.boolean().default(true)
});

const updateSupplierSchema = createSupplierSchema.partial();

module.exports = {
  createSupplierSchema,
  updateSupplierSchema
};
