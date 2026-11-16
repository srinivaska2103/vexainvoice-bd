const path = require('path');
const dotenv = require('dotenv');

// Load .env relative to backend directory first, then fallback to cwd
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

// Validate required JWT environment variables
const rawJwtSecret = process.env.JWT_SECRET;
const isProduction = (process.env.NODE_ENV || 'development') === 'production';

if (!rawJwtSecret) {
  if (isProduction) {
    console.error('FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is missing in production.');
    process.exit(1);
  } else {
    console.warn('⚠️ WARNING: JWT_SECRET environment variable is missing. Please set a secure 64-byte random secret in .env.');
  }
} else if (rawJwtSecret.length < 32) {
  console.error('FATAL CONFIGURATION ERROR: JWT_SECRET must be at least 32 characters long (recommended: 64 random bytes / 128 hex characters).');
  if (isProduction) {
    process.exit(1);
  }
}

module.exports = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: rawJwtSecret || 'vexa_invoice_secret_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_ALGORITHM: 'HS256',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  
  // SMTP Email Settings
  SMTP_HOST: process.env.SMTP_HOST || 'smtpout.secureserver.net',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || 'noreply@vexatech.in',
  SMTP_PASS: process.env.SMTP_PASS || 'Srini@2103',
  SMTP_FROM: process.env.SMTP_FROM || 'Vexatech Support <noreply@vexatech.in>',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@vexatech.in',

  // OTP Configuration
  OTP_EXPIRY_MINUTES: parseInt(process.env.OTP_EXPIRY_MINUTES || '5', 10),

  // Subscription Admin Email
  SUBSCRIPTION_ADMIN_EMAIL: process.env.SUBSCRIPTION_ADMIN_EMAIL || 'vexatech.connect@gmail.com',

  // Razorpay Payment Gateway & Subscriptions
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  RAZORPAY_PLAN_ID: process.env.RAZORPAY_PLAN_ID || '',
  RAZORPAY_GROWTH_PLAN_ID: process.env.RAZORPAY_GROWTH_PLAN_ID || '',

  // Multi-Server Database & Connection Pool Configuration
  DB_CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT || '7', 10),
  DB_POOL_TIMEOUT: parseInt(process.env.DB_POOL_TIMEOUT || '10', 10), // seconds
  RUN_BACKGROUND_WORKERS: process.env.RUN_BACKGROUND_WORKERS !== 'false',
  SERVER_ROLE: process.env.SERVER_ROLE || 'all', // 'web' | 'worker' | 'all'
  ASSIGNED_COMPANY_ID: process.env.ASSIGNED_COMPANY_ID || null // Optional strict pinning for dedicated shop servers
};

