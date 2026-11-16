const express = require('express');
const router = express.Router();
const supportController = require('../controllers/support.controller');
const { authenticate } = require('../middleware/auth');

// 1. Authenticated User Help Center & FAQs Routes
// Accessible to Admin and all active employee roles
router.use(authenticate);

// Help Center Guides & FAQs
router.get('/help/categories', supportController.getHelpCategories);
router.get('/help/featured', supportController.getFeaturedGuides);
router.get('/help/latest', supportController.getLatestGuides);
router.get('/help/articles/:slug', supportController.getArticleBySlug);
router.post('/help/articles/:slug/feedback', supportController.recordArticleFeedback);
router.get('/help/faqs', supportController.getFaqs);
router.post('/help/faqs/:id/feedback', supportController.recordFaqFeedback);

// Support Tickets
router.post('/tickets', supportController.createTicket);
router.get('/tickets', supportController.getMyTickets);
router.get('/tickets/:id', supportController.getTicketDetails);
router.post('/tickets/:id/reply', supportController.replyTicket);
router.post('/tickets/:id/close', supportController.closeTicket);
router.get('/attachments/:attachmentId/download', supportController.downloadAttachment);

module.exports = router;

