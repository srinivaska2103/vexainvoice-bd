const PDFDocument = require('pdfkit');
const prisma = require('../config/db');

/**
 * Service to generate professional Tax Invoice PDF for sales
 * Compatible with standard A4 vector PDF format
 */
class InvoicePdfService {
  /**
   * Generates a PDF buffer for a completed sale
   * @param {string} saleId 
   * @returns {Promise<Buffer>}
   */
  static async generateSaleInvoicePdfBuffer(saleId) {
    const sale = await prisma.sales.findUnique({
      where: { id: saleId },
      include: {
        customers: true,
        businesses: true,
        sale_items: {
          include: {
            products: true
          }
        },
        sale_payments: true
      }
    });

    if (!sale) {
      throw new Error(`Sale with ID ${saleId} not found`);
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Invoice - ${sale.invoice_number}`,
            Author: sale.businesses?.business_name || 'VEXA Invoice',
            Subject: 'Tax Invoice'
          }
        });

        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        // Colors
        const primaryColor = '#1e3a8a'; // Deep Navy Blue
        const secondaryColor = '#475569'; // Slate
        const darkText = '#0f172a';
        const lightBg = '#f8fafc';
        const borderColor = '#cbd5e1';

        // --- Header Section ---
        let currentY = 40;

        // Check if business has logo
        let logoDrawn = false;
        if (sale.businesses?.logo_url) {
          try {
            let base64Data = null;
            if (sale.businesses.logo_url.startsWith('{')) {
              const parsed = JSON.parse(sale.businesses.logo_url);
              base64Data = parsed.logo || parsed.url;
            } else {
              base64Data = sale.businesses.logo_url;
            }

            if (base64Data && base64Data.includes('base64,')) {
              const rawData = base64Data.split('base64,')[1];
              const imgBuffer = Buffer.from(rawData, 'base64');
              doc.image(imgBuffer, 40, currentY, { fit: [100, 45] });
              logoDrawn = true;
            }
          } catch (logoErr) {
            console.warn('Could not render logo on invoice PDF:', logoErr.message);
          }
        }

        const headerLeftX = logoDrawn ? 150 : 40;
        const bizName = sale.businesses?.business_name || 'Business Name';
        doc.fillColor(primaryColor)
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(bizName.toUpperCase(), headerLeftX, currentY);

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(secondaryColor);

        let bizDetails = [];
        if (sale.businesses?.address) bizDetails.push(sale.businesses.address);
        const cityState = [sale.businesses?.city, sale.businesses?.state, sale.businesses?.pincode].filter(Boolean).join(', ');
        if (cityState) bizDetails.push(cityState);
        if (sale.businesses?.phone) bizDetails.push(`Phone: +91 ${sale.businesses.phone}`);
        if (sale.businesses?.email) bizDetails.push(`Email: ${sale.businesses.email}`);
        if (sale.businesses?.gst_number) bizDetails.push(`GSTIN: ${sale.businesses.gst_number}`);

        let lineY = currentY + 20;
        bizDetails.slice(0, 4).forEach(line => {
          doc.text(line, headerLeftX, lineY, { width: 230 });
          lineY += 10;
        });

        // Top Right: TAX INVOICE title & meta
        doc.fillColor(primaryColor)
           .fontSize(18)
           .font('Helvetica-Bold')
           .text('TAX INVOICE', 380, currentY, { align: 'right', width: 175 });

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(darkText)
           .text(`Invoice #: ${sale.invoice_number}`, 380, currentY + 22, { align: 'right', width: 175 });

        const invDate = sale.invoice_date 
          ? new Date(sale.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : new Date(sale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(secondaryColor)
           .text(`Date: ${invDate}`, 380, currentY + 36, { align: 'right', width: 175 });

        const paymentMethod = sale.sale_payments?.[0]?.payment_method || 'CASH';
        doc.text(`Payment: ${paymentMethod}`, 380, currentY + 48, { align: 'right', width: 175 });
        doc.text(`Status: ${sale.status || 'COMPLETED'}`, 380, currentY + 60, { align: 'right', width: 175 });

        // Divider
        currentY = Math.max(lineY + 10, currentY + 75);
        doc.strokeColor(borderColor).lineWidth(1).moveTo(40, currentY).lineTo(555, currentY).stroke();

        // --- Bill To Section ---
        currentY += 10;
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text('BILL TO:', 40, currentY);
        currentY += 12;

        const customer = sale.customers;
        const custName = customer?.name || 'Walk-in Customer';
        doc.fillColor(darkText).fontSize(10).font('Helvetica-Bold').text(custName, 40, currentY);
        currentY += 12;

        doc.fontSize(8).font('Helvetica').fillColor(secondaryColor);
        if (customer?.phone) {
          doc.text(`Phone: +91 ${customer.phone}`, 40, currentY);
          currentY += 10;
        }
        if (customer?.address) {
          doc.text(`Address: ${customer.address}`, 40, currentY, { width: 300 });
          currentY += 12;
        }

        currentY += 10;

        // --- Table Headers ---
        doc.rect(40, currentY, 515, 20).fill(lightBg);
        doc.strokeColor(borderColor).lineWidth(0.5).rect(40, currentY, 515, 20).stroke();

        doc.fillColor(primaryColor).fontSize(8).font('Helvetica-Bold');
        doc.text('#', 45, currentY + 6, { width: 20 });
        doc.text('ITEM DESCRIPTION', 70, currentY + 6, { width: 220 });
        doc.text('QTY', 295, currentY + 6, { width: 35, align: 'center' });
        doc.text('RATE (₹)', 335, currentY + 6, { width: 60, align: 'right' });
        doc.text('GST', 400, currentY + 6, { width: 45, align: 'center' });
        doc.text('AMOUNT (₹)', 455, currentY + 6, { width: 95, align: 'right' });

        currentY += 20;

        // --- Line Items ---
        const items = sale.sale_items || [];
        doc.font('Helvetica').fontSize(8);

        items.forEach((item, index) => {
          const itemY = currentY;
          const bg = (index % 2 === 1) ? '#fafafa' : '#ffffff';
          doc.rect(40, itemY, 515, 20).fill(bg);
          doc.strokeColor(borderColor).lineWidth(0.3).rect(40, itemY, 515, 20).stroke();

          doc.fillColor(darkText);
          doc.text(String(index + 1), 45, itemY + 6, { width: 20 });
          
          let itemTitle = item.product_name || item.products?.name || 'Item';
          if (item.sku) itemTitle += ` (${item.sku})`;
          doc.text(itemTitle, 70, itemY + 6, { width: 220, ellipsis: true });

          const qty = Number(item.quantity || 1);
          doc.text(String(qty), 295, itemY + 6, { width: 35, align: 'center' });

          const rate = Number(item.unit_price || 0).toFixed(2);
          doc.text(rate, 335, itemY + 6, { width: 60, align: 'right' });

          const gstPct = item.gst_percentage ? `${item.gst_percentage}%` : '0%';
          doc.text(gstPct, 400, itemY + 6, { width: 45, align: 'center' });

          const itemTotal = Number(item.total_amount || (qty * Number(item.unit_price || 0))).toFixed(2);
          doc.font('Helvetica-Bold').text(itemTotal, 455, itemY + 6, { width: 95, align: 'right' }).font('Helvetica');

          currentY += 20;
        });

        // --- Summary Totals Box ---
        currentY += 15;
        const summaryX = 340;
        const summaryWidth = 215;

        doc.rect(summaryX, currentY, summaryWidth, 105).fill(lightBg);
        doc.strokeColor(borderColor).lineWidth(0.5).rect(summaryX, currentY, summaryWidth, 105).stroke();

        let sY = currentY + 8;
        const subtotal = Number(sale.subtotal || sale.grand_total || 0).toFixed(2);
        const grandTotal = Number(sale.grand_total || 0).toFixed(2);
        const paidAmount = Number(sale.paid_amount || 0).toFixed(2);
        const balance = Math.max(0, Number(sale.grand_total || 0) - Number(sale.paid_amount || 0)).toFixed(2);

        // Subtotal
        doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text('Subtotal:', summaryX + 10, sY);
        doc.font('Helvetica-Bold').fillColor(darkText).text(`₹${subtotal}`, summaryX + 10, sY, { align: 'right', width: summaryWidth - 20 });
        sY += 16;

        // Taxes if any
        const cgst = Number(sale.cgst_amount || 0);
        const sgst = Number(sale.sgst_amount || 0);
        if (cgst > 0 || sgst > 0) {
          doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text('CGST + SGST:', summaryX + 10, sY);
          doc.font('Helvetica-Bold').fillColor(darkText).text(`₹${(cgst + sgst).toFixed(2)}`, summaryX + 10, sY, { align: 'right', width: summaryWidth - 20 });
          sY += 16;
        }

        // Grand Total
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(summaryX, sY).lineTo(summaryX + summaryWidth, sY).stroke();
        sY += 6;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('Grand Total:', summaryX + 10, sY);
        doc.fontSize(11).fillColor(primaryColor).text(`₹${grandTotal}`, summaryX + 10, sY - 1, { align: 'right', width: summaryWidth - 20 });
        sY += 18;

        // Paid & Balance
        doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text('Amount Paid:', summaryX + 10, sY);
        doc.font('Helvetica-Bold').fillColor('#15803d').text(`₹${paidAmount}`, summaryX + 10, sY, { align: 'right', width: summaryWidth - 20 });
        sY += 14;

        doc.fontSize(8).font('Helvetica').fillColor(secondaryColor).text('Balance Due:', summaryX + 10, sY);
        doc.font('Helvetica-Bold').fillColor(Number(balance) > 0 ? '#b91c1c' : '#15803d').text(`₹${balance}`, summaryX + 10, sY, { align: 'right', width: summaryWidth - 20 });

        // Left note: Terms & Thank you
        doc.fontSize(8).font('Helvetica-Bold').fillColor(darkText).text('Thank you for your business!', 40, currentY + 10);
        doc.fontSize(7.5).font('Helvetica').fillColor(secondaryColor)
           .text('Goods once sold can only be returned or exchanged in accordance with shop policy.', 40, currentY + 24, { width: 280 })
           .text('For queries regarding this invoice, please contact the store administrator.', 40, currentY + 42, { width: 280 });

        // Footer Branding
        const footerY = 770;
        doc.strokeColor(borderColor).lineWidth(0.5).moveTo(40, footerY).lineTo(555, footerY).stroke();
        doc.fontSize(8).font('Helvetica').fillColor(secondaryColor)
           .text('Generated via VEXA Invoice | Digital Billing & Management Platform', 40, footerY + 8, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = InvoicePdfService;
