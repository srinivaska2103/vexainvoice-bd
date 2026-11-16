const { z } = require('zod');

const baseCustomerSchema = z.object({
  customer_code: z.string().max(50).optional().nullable(),
  name: z.string().min(1, 'Customer name is required').max(200),
  customer_type: z.enum(['RETAIL', 'WHOLESALE', 'DEALER', 'BUSINESS', 'SHOP', 'PURCHASE']).default('RETAIL'),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  pincode: z.string().max(10).optional().nullable(),
  zip_code: z.string().max(10).optional().nullable(),
  notes: z.string().optional().nullable(),
  gst_number: z.string().max(20).optional().nullable(),
  credit_limit: z.number().min(0).default(0),
  opening_balance: z.number().default(0),
  price_level: z.enum(['RETAIL', 'WHOLESALE', 'DEALER', 'SPECIAL']).default('RETAIL'),
  is_active: z.boolean().default(true)
});

const mapCustomerPayload = (val) => {
  if (typeof val === 'object' && val !== null) {
    const res = { ...val };
    if (res.customerType && !res.customer_type) res.customer_type = res.customerType;
    if (res.customer_type === 'SHOP') res.customer_type = 'BUSINESS';
    if (res.zip_code && !res.pincode) res.pincode = res.zip_code;
    if (res.gstin !== undefined && res.gst_number === undefined) res.gst_number = res.gstin;
    if (res.creditLimit !== undefined && res.credit_limit === undefined) res.credit_limit = parseFloat(res.creditLimit || 0);
    if (res.openingBalance !== undefined && res.opening_balance === undefined) res.opening_balance = parseFloat(res.openingBalance || 0);
    return res;
  }
  return val;
};

const createCustomerSchema = z.preprocess(mapCustomerPayload, baseCustomerSchema);
const updateCustomerSchema = z.preprocess(mapCustomerPayload, baseCustomerSchema.partial());

module.exports = {
  createCustomerSchema,
  updateCustomerSchema
};
