const supportTicketService = require('../services/supportTicket.service');
const helpCenterService = require('../services/helpCenter.service');

// -------------------------------------------------------------
// HELP CENTER PUBLIC / USER HANDLERS
// -------------------------------------------------------------
const getHelpCategories = async (req, res, next) => {
  try {
    const { search } = req.query;
    const categories = await helpCenterService.getCategoriesWithArticles(search);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const getFeaturedGuides = async (req, res, next) => {
  try {
    const featured = await helpCenterService.getFeaturedArticles();
    res.json({ success: true, data: featured });
  } catch (error) {
    next(error);
  }
};

const getLatestGuides = async (req, res, next) => {
  try {
    const latest = await helpCenterService.getLatestArticles();
    res.json({ success: true, data: latest });
  } catch (error) {
    next(error);
  }
};

const recordArticleFeedback = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { isHelpful } = req.body;
    await helpCenterService.recordArticleFeedback(slug, !!isHelpful);
    res.json({ success: true, message: 'Feedback recorded.' });
  } catch (error) {
    next(error);
  }
};

const getArticleBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const article = await helpCenterService.getArticleBySlug(slug);
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
};

const getFaqs = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    const faqs = await helpCenterService.getFaqs(category, search);
    res.json({ success: true, data: faqs });
  } catch (error) {
    next(error);
  }
};

const recordFaqFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isHelpful } = req.body;
    await helpCenterService.recordFaqFeedback(id, !!isHelpful);
    res.json({ success: true, message: 'FAQ feedback recorded.' });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// SUPPORT TICKETS (COMPANY USER HANDLERS)
// -------------------------------------------------------------
const createTicket = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { attachments, ...ticketData } = req.body;

    ticketData.userName = req.user.name;
    const result = await supportTicketService.createTicket(businessId, userId, ticketData, attachments);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getMyTickets = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const tickets = await supportTicketService.getCompanyTickets(businessId, userId, userRole, req.query);
    res.json({ success: true, data: tickets });
  } catch (error) {
    next(error);
  }
};

const getTicketDetails = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const ticket = await supportTicketService.getCompanyTicketDetails(businessId, userId, userRole, id);
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

const replyTicket = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { id } = req.params;
    const { message, attachments } = req.body;

    const result = await supportTicketService.replyCompanyTicket(businessId, userId, req.user, id, message, attachments);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const closeTicket = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const { id } = req.params;

    const result = await supportTicketService.closeCompanyTicket(businessId, userId, req.user, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const downloadAttachment = async (req, res, next) => {
  try {
    const businessId = req.user.business_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { attachmentId } = req.params;

    const fileMeta = await supportTicketService.getAttachmentStream(businessId, userRole, userId, attachmentId, false);
    res.setHeader('Content-Type', fileMeta.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${fileMeta.fileName}"`);
    res.sendFile(fileMeta.filePath);
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// SUPER ADMIN SUPPORT TICKET & HELP CENTER MANAGEMENT
// -------------------------------------------------------------
const getSuperAdminTickets = async (req, res, next) => {
  try {
    const result = await supportTicketService.getSuperAdminTickets(req.query);
    res.json({ success: true, data: result.tickets, metrics: result.metrics });
  } catch (error) {
    next(error);
  }
};

const getSuperAdminTicketDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await supportTicketService.getSuperAdminTicketDetails(id);
    res.json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

const updateSuperAdminTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminUser = req.superAdmin || req.admin || req.user || { id: 'admin', name: 'VEXA Super Admin' };
    const result = await supportTicketService.updateSuperAdminTicket(adminUser, id, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const downloadSuperAdminAttachment = async (req, res, next) => {
  try {
    const { attachmentId } = req.params;
    const fileMeta = await supportTicketService.getAttachmentStream(null, 'SUPER_ADMIN', null, attachmentId, true);
    res.setHeader('Content-Type', fileMeta.fileType);
    res.setHeader('Content-Disposition', `inline; filename="${fileMeta.fileName}"`);
    res.sendFile(fileMeta.filePath);
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------
// SUPER ADMIN ARTICLE & FAQ MANAGEMENT
// -------------------------------------------------------------
const getSuperAdminArticles = async (req, res, next) => {
  try {
    const articles = await helpCenterService.getSuperAdminArticles(req.query);
    res.json({ success: true, data: articles });
  } catch (error) {
    next(error);
  }
};

const createSuperAdminArticle = async (req, res, next) => {
  try {
    const article = await helpCenterService.createArticle(req.body);
    res.status(201).json({ success: true, data: article, message: 'Article created successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateSuperAdminArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await helpCenterService.updateArticle(id, req.body);
    res.json({ success: true, data: article, message: 'Article updated successfully.' });
  } catch (error) {
    next(error);
  }
};

const deleteSuperAdminArticle = async (req, res, next) => {
  try {
    const { id } = req.params;
    await helpCenterService.deleteArticle(id);
    res.json({ success: true, message: 'Article deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const createSuperAdminCategory = async (req, res, next) => {
  try {
    const category = await helpCenterService.createCategory(req.body);
    res.status(201).json({ success: true, data: category, message: 'Category created successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateSuperAdminCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const category = await helpCenterService.updateCategory(id, req.body);
    res.json({ success: true, data: category, message: 'Category updated successfully.' });
  } catch (error) {
    next(error);
  }
};

const deleteSuperAdminCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    await helpCenterService.deleteCategory(id);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

const createSuperAdminFaq = async (req, res, next) => {
  try {
    const faq = await helpCenterService.createFaq(req.body);
    res.status(201).json({ success: true, data: faq, message: 'FAQ created successfully.' });
  } catch (error) {
    next(error);
  }
};

const updateSuperAdminFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    const faq = await helpCenterService.updateFaq(id, req.body);
    res.json({ success: true, data: faq, message: 'FAQ updated successfully.' });
  } catch (error) {
    next(error);
  }
};

const deleteSuperAdminFaq = async (req, res, next) => {
  try {
    const { id } = req.params;
    await helpCenterService.deleteFaq(id);
    res.json({ success: true, message: 'FAQ deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHelpCategories,
  getFeaturedGuides,
  getLatestGuides,
  recordArticleFeedback,
  getArticleBySlug,
  getFaqs,
  recordFaqFeedback,
  createTicket,
  getMyTickets,
  getTicketDetails,
  replyTicket,
  closeTicket,
  downloadAttachment,
  getSuperAdminTickets,
  getSuperAdminTicketDetails,
  updateSuperAdminTicket,
  downloadSuperAdminAttachment,
  getSuperAdminArticles,
  createSuperAdminArticle,
  updateSuperAdminArticle,
  deleteSuperAdminArticle,
  createSuperAdminCategory,
  updateSuperAdminCategory,
  deleteSuperAdminCategory,
  createSuperAdminFaq,
  updateSuperAdminFaq,
  deleteSuperAdminFaq
};

