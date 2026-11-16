const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(150),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'BILLING_STAFF', 'STOCK_STAFF', 'ACCOUNTANT']).default('BILLING_STAFF'),
  custom_role_id: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']).optional().default('Active'),
  is_active: z.boolean().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.enum(['ADMIN', 'MANAGER', 'BILLING_STAFF', 'STOCK_STAFF', 'ACCOUNTANT']).optional(),
  custom_role_id: z.string().uuid().optional().nullable().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']).optional(),
  is_active: z.boolean().optional()
});

module.exports = {
  createUserSchema,
  updateUserSchema
};
