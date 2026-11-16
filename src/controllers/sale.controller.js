const saleService = require('../services/sale.service');
const { createSaleSchema, saleReturnSchema } = require('../validators/sale.validator');
const { sendSuccess } = require('../utils/response.util');

const getSales = async (req, res, next) => {
  try {
    const result = await saleService.getSales(req.user.business_id, req.query);
    return sendSuccess(res, 'Sales fetched', result.sales, 200, result.pagination);
  } catch (error) { next(error); }
};

const getSaleById = async (req, res, next) => {
  try {
    const sale = await saleService.getSaleById(req.user.business_id, req.params.id);
    return sendSuccess(res, 'Sale details fetched', sale);
  } catch (error) { next(error); }
};

const createSale = async (req, res, next) => {
  try {
    const data = createSaleSchema.parse(req.body);
    const sale = await saleService.createSale(req.user.business_id, req.user.id, data);
    return sendSuccess(res, 'Sale created successfully', sale, 201);
  } catch (error) { next(error); }
};

const returnSale = async (req, res, next) => {
  try {
    const data = saleReturnSchema.parse(req.body);
    const result = await saleService.returnSale(req.user.business_id, req.params.id, req.user.id, data);
    return sendSuccess(res, result.message, result);
  } catch (error) { next(error); }
};

const deleteSale = async (req, res, next) => {
  try {
    const result = await saleService.deleteSale(req.user.business_id, req.params.id, req.user.id);
    return sendSuccess(res, result.message, result);
  } catch (error) { next(error); }
};

const getNextNumber = async (req, res, next) => {
  try {
    const result = await saleService.getNextNumber(req.user.business_id);
    return sendSuccess(res, 'Next sequential numbers fetched', result);
  } catch (error) { next(error); }
};

const getSalePdf = async (req, res, next) => {
  try {
    const InvoicePdfService = require('../services/invoicePdf.service');
    const sale = await saleService.getSaleById(req.user.business_id, req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    const pdfBuffer = await InvoicePdfService.generateSaleInvoicePdfBuffer(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sale.invoiceNumber || sale.invoice_number || 'invoice'}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) { next(error); }
};

const retryWhatsAppReceipt = async (req, res, next) => {
  try {
    const WhatsAppTemplateService = require('../services/whatsappTemplateService');
    const sale = await saleService.getSaleById(req.user.business_id, req.params.id);
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const result = await WhatsAppTemplateService.sendOrderReceipt({
      saleId: req.params.id,
      forceRetry: true
    });

    return sendSuccess(res, 'WhatsApp Order Receipt delivery triggered', result);
  } catch (error) { next(error); }
};

const getSaleWhatsAppStatus = async (req, res, next) => {
  try {
    const prisma = require('../config/db');
    const messages = await prisma.whatsapp_messages.findMany({
      where: {
        business_id: req.user.business_id,
        invoice_id: req.params.id
      },
      orderBy: { created_at: 'desc' }
    });

    const receiptMsg = messages.find(m => m.template_name === 'vexa_order_receipt') || null;
    return sendSuccess(res, 'WhatsApp receipt status fetched', {
      receiptMessage: receiptMsg,
      allMessages: messages
    });
  } catch (error) { next(error); }
};

module.exports = {
  getSales,
  getSaleById,
  getNextNumber,
  createSale,
  returnSale,
  deleteSale,
  getSalePdf,
  retryWhatsAppReceipt,
  getSaleWhatsAppStatus
};
