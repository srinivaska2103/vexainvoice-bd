const { z } = require('zod');

const customerPaymentSchema = z.preprocess(
  (val) => {
    if (typeof val === 'object' && val !== null) {
      return {
        ...val,
        payment_method: val.payment_method || val.payment_mode || 'CASH',
        reference_number: val.reference_number || val.reference_no || null
      };
    }
    return val;
  },
  z.object({
    customer_id: z.string().uuid('Valid customer ID required'),
    sale_id: z.string().uuid().optional().nullable(),
    amount: z.number().positive('Payment amount must be greater than 0'),
    payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']).default('CASH'),
    payment_date: z.string().optional(),
    reference_number: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable()
  })
);

const supplierPaymentSchema = z.preprocess(
  (val) => {
    if (typeof val === 'object' && val !== null) {
      return {
        ...val,
        payment_method: val.payment_method || val.payment_mode || 'CASH',
        reference_number: val.reference_number || val.reference_no || null
      };
    }
    return val;
  },
  z.object({
    supplier_id: z.string().uuid('Valid supplier ID required'),
    purchase_id: z.string().uuid().optional().nullable(),
    amount: z.number().positive('Payment amount must be greater than 0'),
    payment_method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT']).default('CASH'),
    payment_date: z.string().optional(),
    reference_number: z.string().max(100).optional().nullable(),
    notes: z.string().optional().nullable()
  })
);

module.exports = {
  customerPaymentSchema,
  supplierPaymentSchema
};
