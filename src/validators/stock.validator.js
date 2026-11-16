const { z } = require('zod');

const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  variant_id: z.string().uuid().optional().nullable(),
  transaction_type: z.string().optional(),
  type: z.string().optional(),
  quantity: z.number().optional(),
  notes: z.string().min(1, 'Reason or notes is required')
}).transform((data) => {
  const rawQty = data.quantity !== undefined ? data.quantity : 0;
  const rawType = data.transaction_type || data.type || (rawQty < 0 ? 'ADJUSTMENT_OUT' : 'ADJUSTMENT_IN');
  let targetType = 'ADJUSTMENT_IN';
  if (['ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER_OUT', 'SUBTRACT', 'STOCK_OUT', 'REMOVE'].includes(rawType)) {
    targetType = rawType === 'SUBTRACT' || rawType === 'STOCK_OUT' || rawType === 'REMOVE' ? 'ADJUSTMENT_OUT' : rawType;
  } else if (['ADJUSTMENT_IN', 'TRANSFER_IN', 'ADD', 'STOCK_IN'].includes(rawType)) {
    targetType = rawType === 'ADD' || rawType === 'STOCK_IN' ? 'ADJUSTMENT_IN' : rawType;
  }

  return {
    product_id: data.product_id,
    variant_id: data.variant_id || null,
    transaction_type: targetType,
    quantity: Math.abs(rawQty),
    notes: data.notes
  };
});

module.exports = {
  stockAdjustmentSchema
};
