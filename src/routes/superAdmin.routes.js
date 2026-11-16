const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdmin.controller');
const { authenticateSuperAdmin } = require('../middleware/superAdmin.middleware');

// Public routes for Super Admin OTP-based authentication only (no public signup exists)
router.post('/send-otp', superAdminController.sendOtp);
router.post('/verify-otp', superAdminController.verifyOtp);
router.post('/login', superAdminController.verifyOtp);

// All subsequent routes strictly require platform-level Super Admin authorization
router.use(authenticateSuperAdmin);

router.get('/me', superAdminController.getMe);
router.get('/dashboard', superAdminController.getDashboardMetrics);

// Companies Management
router.get('/companies', superAdminController.getCompanies);
router.get('/companies/:id', superAdminController.getCompanyById);
router.put('/companies/:id/status', superAdminController.toggleCompanyStatus);

// Users Management
router.get('/users', superAdminController.getUsers);
router.put('/users/:id/status', superAdminController.toggleUserStatus);

// Subscriptions Management
router.get('/subscriptions', superAdminController.getSubscriptions);
router.get('/subscriptions/:id', superAdminController.getSubscriptionById);

// Payments & Revenue
router.get('/payments', superAdminController.getPayments);

// Analytics & Reports
router.get('/analytics', superAdminController.getAnalytics);

// Notifications & Audit Logs
router.get('/logs', superAdminController.getNotificationsAndLogs);

// Platform Settings
router.get('/settings', superAdminController.getSettings);

// Support Tickets Management (Super Admin only)
const supportController = require('../controllers/support.controller');
router.get('/support/tickets', supportController.getSuperAdminTickets);
router.get('/support/tickets/:id', supportController.getSuperAdminTicketDetails);
router.put('/support/tickets/:id', supportController.updateSuperAdminTicket);
router.get('/support/attachments/:attachmentId/download', supportController.downloadSuperAdminAttachment);

// Help Center Articles & Categories Management (Super Admin only)
router.get('/help/articles', supportController.getSuperAdminArticles);
router.post('/help/articles', supportController.createSuperAdminArticle);
router.put('/help/articles/:id', supportController.updateSuperAdminArticle);
router.delete('/help/articles/:id', supportController.deleteSuperAdminArticle);

router.post('/help/categories', supportController.createSuperAdminCategory);
router.put('/help/categories/:id', supportController.updateSuperAdminCategory);
router.delete('/help/categories/:id', supportController.deleteSuperAdminCategory);

router.post('/help/faqs', supportController.createSuperAdminFaq);
router.put('/help/faqs/:id', supportController.updateSuperAdminFaq);
router.delete('/help/faqs/:id', supportController.deleteSuperAdminFaq);

// Lifetime Sales Enquiries Management (Super Admin only)
const salesEnquiryController = require('../controllers/salesEnquiry.controller');
router.get('/sales/enquiries', salesEnquiryController.getSuperAdminEnquiries);
router.get('/sales/enquiries/:id', salesEnquiryController.getEnquiryDetails);
router.put('/sales/enquiries/:id', salesEnquiryController.updateEnquiry);
router.post('/sales/enquiries/:id/create-payment', salesEnquiryController.createLifetimePayment);
router.post('/sales/enquiries/:id/verify-payment', salesEnquiryController.verifyLifetimePayment);

module.exports = router;
