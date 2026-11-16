const { z } = require('zod');

const createFollowupSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  assigned_to: z.string().uuid().optional().nullable(),
  type: z.enum(['Call', 'Visit', 'Payment Follow-up', 'Product Follow-up', 'Order Follow-up', 'General']).default('Call'),
  reason: z.string().min(1, 'Reason is required').max(255),
  notes: z.string().optional().nullable(),
  due_date: z.string().min(1, 'Due date is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED', 'OVERDUE']).default('PENDING')
});

const updateFollowupSchema = createFollowupSchema.partial().extend({
  completed_notes: z.string().optional().nullable(),
  completion_notes: z.string().optional().nullable()
});

const createCustomerNoteSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  note: z.string().min(1, 'Note content is required')
});

const saveSegmentSchema = z.object({
  name: z.string().min(1, 'Segment name is required').max(150),
  description: z.string().optional().nullable(),
  filter_definition: z.object({}).passthrough()
});

module.exports = {
  createFollowupSchema,
  updateFollowupSchema,
  createCustomerNoteSchema,
  saveSegmentSchema
};
