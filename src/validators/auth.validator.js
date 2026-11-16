const { z } = require('zod');

const registerSchema = z.object({
  business_name: z.string().min(2, 'Company name must be at least 2 characters').max(200),
  business_type: z.enum(['RETAIL', 'WHOLESALE', 'GARMENT', 'TEXTILE', 'RETAIL_WHOLESALE', 'GARMENT_TEXTILE']).default('GARMENT_TEXTILE'),
  owner_name: z.string().min(2, 'Owner name must be at least 2 characters').max(150).optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(20),
  email: z.string().email('Invalid email address'),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(10).optional(),
  gst_number: z.string().max(20).optional(),
  pan_number: z.string().max(20).optional(),
  currency: z.string().default('INR'),
  invoice_prefix: z.string().default('INV'),
  
  // Admin User details
  admin_name: z.string().min(2, 'Full name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  role_slug: z.string().optional().nullable()
});

const sendOtpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  name: z.string().optional()
});

const verifyOtpSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  registrationData: z.any().optional()
}).refine(data => data.id || data.email, {
  message: 'Registration ID or email is required',
  path: ['id']
});

const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
  new_password: z.string().min(6, 'New password must be at least 6 characters')
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  current_password: z.string().optional(),
  new_password: z.string().min(6).optional()
});

const updateBusinessSchema = z.object({
  business_name: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  gst_number: z.string().optional(),
  logo_url: z.string().optional(),
  invoice_template: z.string().optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  sendOtpSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  updateProfileSchema,
  updateBusinessSchema
};
