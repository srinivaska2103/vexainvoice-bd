const express = require('express');
const router = express.Router();
const salesEnquiryController = require('../controllers/salesEnquiry.controller');
const { optionalAuthenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Public / Authenticated Contact Sales Enquiry Submission
// Accepts authenticated token optionally; if token exists, backend safely associates the business
router.post(
  '/enquiries',
  apiLimiter,
  optionalAuthenticate,
  salesEnquiryController.submitEnquiry
);

// Optional customer payment verification for a sales enquiry
router.post(
  '/enquiries/:id/verify-payment',
  optionalAuthenticate,
  salesEnquiryController.verifyLifetimePayment
);

module.exports = router;
