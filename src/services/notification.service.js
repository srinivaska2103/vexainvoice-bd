const { sendEmail } = require('../config/email');
const prisma = require('../config/db');

/**
 * Format currency in INR format
 */
const formatINR = (amt) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(amt || 0));
};

/**
 * Format date
 */
const formatDateStr = (d) => {
  return new Date(d || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const path = require('path');
const fs = require('fs');

const extractBusinessLogo = (biz) => {
  if (!biz) return '/logo.png';
  let logo = null;
  if (biz.logo_url) {
    const raw = String(biz.logo_url).trim();
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        logo = parsed.logo || parsed.logo_url || null;
      } catch (e) {}
    } else {
      logo = raw;
    }
  }
  return logo || '/logo.png';
};

const getBusinessEmailSettings = async (business_id) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: business_id },
      select: { logo_url: true }
    });
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      const parsed = JSON.parse(biz.logo_url);
      if (parsed.email_settings) return parsed.email_settings;
    }
  } catch (e) {}
  return {
    sale_invoice: true,
    purchase_update: true,
    low_stock: true,
    customer_payment: true,
    supplier_payment: true,
    campaign_emails: true
  };
};

const getBusinessEmailTemplates = async (business_id) => {
  try {
    const biz = await prisma.businesses.findUnique({
      where: { id: business_id },
      select: { logo_url: true }
    });
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      const parsed = JSON.parse(biz.logo_url);
      if (parsed.email_templates) return parsed.email_templates;
    }
  } catch (e) {}
  return {};
};

const getAdminEmails = async (business_id) => {
  try {
    const authorizedUsers = await prisma.users.findMany({
      where: {
        business_id,
        role: { in: ['ADMIN', 'MANAGER', 'STOCK_STAFF', 'BILLING_STAFF', 'ACCOUNTANT'] }
      },
      select: { email: true, name: true, role: true }
    });

    const recipients = [];
    const addedEmails = new Set();

    for (const u of authorizedUsers) {
      if (u.email && u.email.includes('@') && !addedEmails.has(u.email.toLowerCase())) {
        addedEmails.add(u.email.toLowerCase());
        recipients.push({ email: u.email.trim(), name: u.name || 'Admin', role: u.role });
      }
    }

    const biz = await prisma.businesses.findUnique({
      where: { id: business_id },
      select: { email: true, business_name: true }
    });

    if (biz?.email && biz.email.includes('@') && !addedEmails.has(biz.email.toLowerCase())) {
      addedEmails.add(biz.email.toLowerCase());
      recipients.push({ email: biz.email.trim(), name: biz.business_name || 'Admin', role: 'ADMIN' });
    }

    return recipients;
  } catch (e) {
    console.error('Error fetching admin recipient emails:', e.message);
    return [];
  }
};

const renderTemplateText = (templateStr, vars) => {
  if (!templateStr) return '';
  let result = String(templateStr);
  for (const [key, value] of Object.entries(vars)) {
    const reg = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    result = result.replace(reg, value !== undefined && value !== null ? value : '');
  }
  return result;
};

const wrapHtmlEmail = (title, bodyText, businessName = 'VEXA Business', logoUrl = null) => {
  const isHtml = bodyText.trim().startsWith('<');
  const formattedBody = isHtml
    ? bodyText
    : bodyText
        .split('\n')
        .map(line => line.trim() ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #334155; line-height: 1.6;">${line}</p>` : '<br/>')
        .join('');

  const attachments = [];
  let logoHeader = '';
  let hasImageHeader = false;

  const processedLogo = logoUrl || '/logo.png';

  if (processedLogo && typeof processedLogo === 'string') {
    const rawLogo = processedLogo.trim();

    if (rawLogo.startsWith('data:image/')) {
      const matches = rawLogo.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const ext = mimeType.split('/')[1] || 'png';
        attachments.push({
          filename: `logo.${ext}`,
          content: Buffer.from(base64Data, 'base64'),
          cid: 'businesslogo@vexa'
        });
        logoHeader = `<img src="cid:businesslogo@vexa" alt="${businessName}" style="max-height: 48px; max-width: 180px; object-fit: contain; vertical-align: middle; border-radius: 8px;" />`;
        hasImageHeader = true;
      }
    } else if (rawLogo.startsWith('http://') || rawLogo.startsWith('https://')) {
      attachments.push({
        filename: 'logo.png',
        path: rawLogo,
        cid: 'businesslogo@vexa'
      });
      logoHeader = `<img src="cid:businesslogo@vexa" alt="${businessName}" style="max-height: 48px; max-width: 180px; object-fit: contain; vertical-align: middle; border-radius: 8px;" />`;
      hasImageHeader = true;
    } else {
      const cleanPath = rawLogo.startsWith('/') ? rawLogo.substring(1) : rawLogo;
      const candidates = [
        path.join(__dirname, '../../../frontend/public', cleanPath),
        path.join(__dirname, '../../../frontend/public/logo.png'),
        path.join(__dirname, '../../../frontend/public/vexa-logo.png')
      ];

      let foundPath = null;
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          foundPath = cand;
          break;
        }
      }

      if (foundPath) {
        attachments.push({
          filename: 'logo.png',
          path: foundPath,
          cid: 'businesslogo@vexa'
        });
        logoHeader = `<img src="cid:businesslogo@vexa" alt="${businessName}" style="max-height: 48px; max-width: 180px; object-fit: contain; vertical-align: middle; border-radius: 8px;" />`;
        hasImageHeader = true;
      }
    }
  }

  if (!hasImageHeader) {
    logoHeader = `<div style="display: inline-block; width: 42px; height: 42px; line-height: 42px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); color: #ffffff; font-weight: 800; font-size: 20px; text-align: center; font-family: sans-serif; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.25);">${businessName.charAt(0).toUpperCase()}</div>`;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);">
              
              <!-- Gradient Top Accent Bar -->
              <tr>
                <td style="height: 6px; background: linear-gradient(90deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%);"></td>
              </tr>

              <!-- Header Section with Logo -->
              <tr>
                <td style="padding: 24px 30px 20px 30px; border-bottom: 1px solid #f1f5f9;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="left" style="vertical-align: middle;">
                        <table border="0" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-right: 14px; vertical-align: middle;">
                              ${logoHeader}
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">${businessName}</h1>
                              <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 600; color: #64748b;">Verified Communication</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td align="right" style="vertical-align: middle;">
                        <span style="display: inline-block; background-color: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; border: 1px solid #bfdbfe;">
                          VERIFIED
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Title Banner -->
              <tr>
                <td style="padding: 18px 30px; background-color: #fafafa; border-bottom: 1px solid #f1f5f9;">
                  <h2 style="margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; text-transform: capitalize;">${title}</h2>
                </td>
              </tr>

              <!-- Body Content Section -->
              <tr>
                <td style="padding: 26px 30px;">
                  <div style="font-size: 14px; color: #334155; line-height: 1.6;">
                    ${formattedBody}
                  </div>
                </td>
              </tr>

              <!-- Footer Section -->
              <tr>
                <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
                  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #475569;">${businessName}</p>
                  <p style="margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                    This email was sent to you as a one-time message from <strong>${businessName}</strong>.<br/>
                    Powered by VEXA Tech Software & Solutions
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return {
    htmlBody: htmlContent,
    html: htmlContent,
    attachments,
    toString: () => htmlContent
  };
};

/**
 * Helper to fetch all low stock products/variants for a business
 */
const getAllLowStockItems = async (business_id) => {
  const products = await prisma.products.findMany({
    where: { business_id, is_active: true },
    include: {
      brands: true,
      product_variants: {
        include: {
          colors: true,
          sizes: true
        }
      }
    }
  });

  const lowStockItems = [];

  const { getCurrentStock } = require('./stock.service');
  const stockRes = await getCurrentStock(business_id, { limit: 1000 });
  const stockMap = new Map((stockRes.stock || []).map(s => [s.id, s]));

  for (const prod of products) {
    const minStock = Number(prod.minimum_stock || 5);
    const unit = prod.unit || 'PCS';
    const brandName = prod.brands?.name || prod.brand || 'N/A';
    const liveProdStock = stockMap.get(prod.id);

    if (prod.has_variants && prod.product_variants && prod.product_variants.length > 0) {
      for (const variant of prod.product_variants) {
        const liveVariant = (liveProdStock?.variants || []).find(v => v.id === variant.id);
        const varStock = liveVariant ? Number(liveVariant.quantity || 0) : Number(variant.current_stock || 0);

        if (varStock <= minStock) {
          const colorName = variant.colors?.name || variant.color || '';
          const sizeName = variant.sizes?.name || variant.size || '';
          const variantLabel = variant.variant_name || [colorName, sizeName].filter(Boolean).join(' / ') || 'Variant';
          lowStockItems.push({
            product_id: prod.id,
            product_name: prod.name,
            brand: brandName,
            is_variant: true,
            variant_id: variant.id,
            variant_name: variantLabel,
            color: colorName || 'N/A',
            size: sizeName || 'N/A',
            sku: variant.sku || prod.sku || 'N/A',
            current_stock: varStock,
            minimum_stock: minStock,
            unit
          });
        }
      }
    } else {
      const currentStock = liveProdStock ? Number(liveProdStock.stockQuantity || 0) : 0;
      if (currentStock <= minStock) {
        lowStockItems.push({
          product_id: prod.id,
          product_name: prod.name,
          brand: brandName,
          is_variant: false,
          color: 'N/A',
          size: 'N/A',
          sku: prod.sku || 'N/A',
          current_stock: currentStock,
          minimum_stock: minStock,
          unit
        });
      }
    }
  }

  return lowStockItems;
};

/**
 * 1. LOW STOCK ALERT EMAIL (CONSOLIDATED)
 * Collects all low stock items for business_id, groups by product & variants,
 * and dispatches ONE consolidated alert email to authorized admins.
 */
const sendLowStockAlert = async (business_id, productOrOptions = null, finalStock = null, variantInfo = null, forceSend = false) => {
  try {
    const isForce = typeof productOrOptions === 'boolean' ? productOrOptions : forceSend;

    console.log(`[LOW_STOCK_CONSOLIDATED_ALERT] Checking low stock for company: ${business_id}`);

    // Check business settings for low_stock
    const settings = await getBusinessEmailSettings(business_id);
    if (settings.low_stock === false) {
      console.log(`ℹ️ [LOW_STOCK_EMAIL] Low stock email disabled in business settings for company ${business_id}`);
      return { success: false, message: 'Low stock email disabled in settings' };
    }

    // Fetch all current qualifying low stock items for this business
    const lowStockItems = await getAllLowStockItems(business_id);
    if (lowStockItems.length === 0) {
      console.log(`ℹ️ [LOW_STOCK_EMAIL] No qualifying low stock items for company ${business_id}`);
      return { success: true, message: 'No low stock items' };
    }

    // Deduplication check: suppress duplicate consolidated email if sent within last 1 hour for this business
    if (!isForce) {
      const recentAlert = await prisma.email_logs.findFirst({
        where: {
          business_id,
          email_type: 'LOW_STOCK',
          status: 'SENT',
          sent_at: {
            gte: new Date(Date.now() - 1 * 60 * 60 * 1000)
          }
        }
      });

      if (recentAlert) {
        console.log(`ℹ️ [LOW_STOCK_EMAIL] Duplicate consolidated alert suppressed for company ${business_id} (already sent within 1 hour).`);
        return { success: true, message: 'Duplicate alert throttled' };
      }
    }

    // Fetch authorized recipients isolated strictly to Company ID
    const recipientUsers = await getAdminEmails(business_id);
    if (recipientUsers.length === 0) {
      console.warn('⚠️ [LOW_STOCK_EMAIL] No authorized recipient emails found for company', business_id);
      return { success: false, message: 'NO_ADMIN_EMAIL_AVAILABLE' };
    }

    const biz = await prisma.businesses.findUnique({ where: { id: business_id } });
    const businessName = biz?.business_name || 'VEXA Business';
    const logoUrl = extractBusinessLogo(biz);

    // Group items by Product
    const groupedMap = new Map();
    for (const item of lowStockItems) {
      if (!groupedMap.has(item.product_id)) {
        groupedMap.set(item.product_id, {
          product_name: item.product_name,
          brand: item.brand,
          items: []
        });
      }
      groupedMap.get(item.product_id).items.push(item);
    }
    const groupedProducts = Array.from(groupedMap.values());
    const totalCount = lowStockItems.length;

    // Build Text and HTML body following Product -> Variants -> Stock Details hierarchy
    let plainTextItems = '';
    let htmlItems = '';

    for (const group of groupedProducts) {
      const brandStr = group.brand && group.brand !== 'N/A' ? ` (${group.brand})` : '';
      plainTextItems += `${group.product_name}${brandStr}\n--------------------------------\n`;
      htmlItems += `
        <div style="margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; background-color: #ffffff;">
          <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 2px solid #ef4444; padding-bottom: 6px; display: inline-block;">
            ${group.product_name} ${brandStr ? `<span style="font-size: 13px; font-weight: 500; color: #64748b;">${brandStr}</span>` : ''}
          </h3>
      `;

      for (const item of group.items) {
        if (item.is_variant) {
          plainTextItems += `${item.variant_name}\nCurrent Stock: ${item.current_stock} ${item.unit}\nMinimum Stock: ${item.minimum_stock} ${item.unit}${item.sku && item.sku !== 'N/A' ? `\nSKU: ${item.sku}` : ''}\n\n`;
          htmlItems += `
            <div style="margin-top: 10px; padding: 12px 14px; background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 6px;">
              <div style="font-weight: 700; font-size: 14px; color: #1e293b;">${item.variant_name}</div>
              <div style="font-size: 13px; color: #475569; margin-top: 4px;">
                <strong style="color: #dc2626;">Current Stock: ${item.current_stock} ${item.unit}</strong> | 
                <span>Minimum Stock: ${item.minimum_stock} ${item.unit}</span>
                ${item.sku && item.sku !== 'N/A' ? ` | <span style="color: #64748b;">SKU: ${item.sku}</span>` : ''}
              </div>
            </div>
          `;
        } else {
          plainTextItems += `Current Stock: ${item.current_stock} ${item.unit}\nMinimum Stock: ${item.minimum_stock} ${item.unit}${item.sku && item.sku !== 'N/A' ? `\nSKU: ${item.sku}` : ''}\n\n`;
          htmlItems += `
            <div style="margin-top: 10px; padding: 12px 14px; background-color: #f8fafc; border-left: 4px solid #ef4444; border-radius: 6px;">
              <div style="font-size: 13px; color: #475569;">
                <strong style="color: #dc2626;">Current Stock: ${item.current_stock} ${item.unit}</strong> | 
                <span>Minimum Stock: ${item.minimum_stock} ${item.unit}</span>
                ${item.sku && item.sku !== 'N/A' ? ` | <span style="color: #64748b;">SKU: ${item.sku}</span>` : ''}
              </div>
            </div>
          `;
        }
      }

      htmlItems += `</div>`;
    }

    const defaultSubject = `Low Stock Alert – ${totalCount} Item${totalCount > 1 ? 's' : ''} Need Attention`;
    const templates = await getBusinessEmailTemplates(business_id);
    const customTmpl = templates.low_stock || {};

    const vars = {
      business_name: businessName,
      low_stock_count: totalCount,
      count: totalCount,
      product_name: `${totalCount} Low Stock Products/Variants`
    };

    const subject = customTmpl.subject ? renderTemplateText(customTmpl.subject, vars) : defaultSubject;

    const defaultMsg = `Hello Admin,\n\n${totalCount} item${totalCount > 1 ? 's are' : ' is'} currently low in stock for ${businessName}.\n\nLOW STOCK ITEMS\n\n${plainTextItems}Please review your stock and restock if required.\n\n${businessName}`;
    const textBody = customTmpl.message ? renderTemplateText(customTmpl.message, vars) : defaultMsg;

    const bodyHtmlCustom = `
      <p style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700; color: #dc2626;">
        ⚠️ Low Stock Alert: ${totalCount} item${totalCount > 1 ? 's' : ''} reached minimum stock threshold.
      </p>
      ${htmlItems}
    `;

    const emailTemplate = wrapHtmlEmail(
      `Low Stock Alert (${totalCount} Items)`,
      bodyHtmlCustom,
      businessName,
      logoUrl
    );

    let lastRes = null;
    for (const recipient of recipientUsers) {
      const recipientEmail = typeof recipient === 'string' ? recipient : recipient?.email;
      if (!recipientEmail) continue;

      lastRes = await sendEmail({
        business_id,
        recipient_email: recipientEmail,
        subject,
        body_text: textBody,
        body_html: emailTemplate.htmlBody,
        attachments: emailTemplate.attachments,
        email_type: 'LOW_STOCK',
        reference_id: null,
        reference_number: `${totalCount} Low Stock Items`
      });
    }

    return lastRes || { success: true };
  } catch (err) {
    console.error('Failed to send consolidated low stock alert email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 2. SALE INVOICE EMAIL
 * Sent to Customer + copy to Admin/Billing User
 */
const sendSaleInvoiceEmail = async (business_id, saleId, forceResend = false) => {
  try {
    const settings = await getBusinessEmailSettings(business_id);
    if (!forceResend && settings.sale_invoice === false) {
      console.log(`ℹ️ Sale invoice email disabled in business settings for sale ${saleId}`);
      return { success: false, message: 'Sale invoice email disabled in settings' };
    }

    const sale = await prisma.sales.findFirst({
      where: { id: saleId, business_id },
      include: {
        customers: true,
        businesses: true,
        users: true,
        sale_items: true
      }
    });

    if (!sale) return { success: false, message: 'Sale invoice not found' };

    // Duplicate check if not manual force resend
    if (!forceResend) {
      const existing = await prisma.email_logs.findFirst({
        where: {
          business_id,
          email_type: 'SALE_INVOICE',
          reference_id: saleId,
          status: 'SENT'
        }
      });
      if (existing) {
        console.log(`ℹ️ Sale invoice email for ${sale.invoice_number} already sent. Skipping duplicate.`);
        return { success: true, message: 'Invoice email already sent previously', alreadySent: true };
      }
    }

    const customer = sale.customers;
    const customerEmail = customer?.email;
    const businessName = sale.businesses?.business_name || 'VEXA Business';

    if (!customerEmail) {
      console.log(`ℹ️ Customer has no email address for sale ${sale.invoice_number}.`);
      return { success: false, message: 'Customer has no email address' };
    }

    const invNum = sale.invoice_number;
    const invDate = formatDateStr(sale.invoice_date || sale.created_at);
    const total = formatINR(sale.grand_total);
    const paid = formatINR(sale.paid_amount);
    const balance = formatINR(sale.balance_amount);

    const templates = await getBusinessEmailTemplates(business_id);
    const customTmpl = templates.sale_invoice || {};

    const vars = {
      customer_name: customer?.name || 'Valued Customer',
      business_name: businessName,
      invoice_number: invNum,
      invoice_total: total,
      paid_amount: paid,
      balance: balance,
      payment_date: invDate
    };

    const defaultSubject = `Invoice ${invNum} from ${businessName}`;
    const defaultMsg = `Hello ${customer?.name || 'Customer'},\n\nThank you for your purchase from ${businessName}.\n\nYour invoice ${invNum} for ${total} is ready.\nAmount Paid: ${paid}\nBalance Due: ${balance}\n\nRegards,\n${businessName}`;

    const logoUrl = extractBusinessLogo(sale.businesses);

    const subject = customTmpl.subject ? renderTemplateText(customTmpl.subject, vars) : defaultSubject;
    const textBody = customTmpl.message ? renderTemplateText(customTmpl.message, vars) : defaultMsg;
    const emailTemplate = wrapHtmlEmail(
      `Tax Invoice ${invNum}`, 
      textBody, 
      businessName, 
      logoUrl
    );

    const res = await sendEmail({
      business_id,
      recipient_email: customerEmail,
      subject,
      body_text: textBody,
      body_html: emailTemplate.htmlBody,
      attachments: emailTemplate.attachments,
      email_type: 'SALE_INVOICE',
      reference_id: saleId,
      reference_number: invNum
    });

    return { ...res, recipient_email: customerEmail };
  } catch (err) {
    console.error('Error sending sale invoice email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 3. PURCHASE ORDER / SUPPLIER EMAIL
 */
const sendPurchaseOrderEmail = async (business_id, purchaseId, forceResend = false) => {
  try {
    const purchase = await prisma.purchases.findFirst({
      where: { id: purchaseId, business_id },
      include: {
        suppliers: true,
        businesses: true,
        purchase_items: true
      }
    });

    if (!purchase) return { success: false, message: 'Purchase record not found' };

    const supplier = purchase.suppliers;
    if (!supplier?.email) {
      return { success: false, message: 'Supplier has no email address' };
    }

    if (!forceResend) {
      const existing = await prisma.email_logs.findFirst({
        where: { business_id, email_type: 'PURCHASE_ORDER', reference_id: purchaseId, status: 'SENT' }
      });
      if (existing) return { success: true, message: 'Purchase email already sent previously', alreadySent: true };
    }

    const businessName = purchase.businesses?.business_name || 'VEXA Business';
    const purNum = purchase.purchase_number;
    const purDate = formatDateStr(purchase.purchase_date || purchase.created_at);
    const total = formatINR(purchase.grand_total);

    const templates = await getBusinessEmailTemplates(business_id);
    const customTmpl = templates.purchase_update || {};

    const vars = {
      supplier_name: supplier?.name || 'Valued Supplier',
      business_name: businessName,
      order_number: purNum,
      order_total: total,
      purchase_date: purDate
    };

    const defaultSubject = `Purchase Order ${purNum} from ${businessName}`;
    const defaultMsg = `Hello ${supplier?.name || 'Supplier'},\n\nPlease find purchase order ${purNum} from ${businessName}.\nTotal Amount: ${total}\n\nRegards,\n${businessName}`;

    const subject = customTmpl.subject ? renderTemplateText(customTmpl.subject, vars) : defaultSubject;
    const textBody = customTmpl.message ? renderTemplateText(customTmpl.message, vars) : defaultMsg;
    const logoUrl = extractBusinessLogo(purchase.businesses);
    const emailTemplate = wrapHtmlEmail(`Purchase Order ${purNum}`, textBody, businessName, logoUrl);

    const recipients = [];
    if (supplier?.email) recipients.push(supplier.email);
    const adminEmails = await getAdminEmails(business_id);
    for (const item of adminEmails) {
      const emailAddr = typeof item === 'string' ? item : item?.email;
      if (emailAddr && !recipients.includes(emailAddr)) recipients.push(emailAddr);
    }

    let lastRes = null;
    for (const email of recipients) {
      lastRes = await sendEmail({
        business_id,
        recipient_email: email,
        subject,
        body_text: textBody,
        body_html: emailTemplate.htmlBody,
        attachments: emailTemplate.attachments,
        email_type: 'PURCHASE_ORDER',
        reference_id: purchaseId,
        reference_number: purNum
      });
    }

    return lastRes;
  } catch (err) {
    console.error('Error sending purchase order email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 4. CUSTOMER PAYMENT RECEIPT EMAIL
 */
const sendCustomerPaymentEmail = async (business_id, paymentId) => {
  try {
    const payment = await prisma.customer_payments.findFirst({
      where: { id: paymentId, business_id },
      include: { customers: true, businesses: true }
    });

    if (!payment) return { success: false, message: 'No payment record found' };

    const customer = payment.customers;
    const businessName = payment.businesses?.business_name || 'VEXA Business';
    const amount = formatINR(payment.amount);
    const date = formatDateStr(payment.payment_date);

    const templates = await getBusinessEmailTemplates(business_id);
    const customTmpl = templates.customer_payment || {};

    const vars = {
      customer_name: customer?.name || 'Valued Customer',
      business_name: businessName,
      paid_amount: amount,
      payment_date: date,
      payment_method: payment.payment_method || 'Online/Cash',
      reference_number: payment.reference_number || 'N/A'
    };

    const defaultSubject = `Payment Receipt from ${businessName}`;
    const defaultMsg = `Hello ${customer?.name || 'Customer'},\n\nWe have received your payment of ${amount} on ${date}.\n\nThank you!\n${businessName}`;

    const subject = customTmpl.subject ? renderTemplateText(customTmpl.subject, vars) : defaultSubject;
    const textBody = customTmpl.message ? renderTemplateText(customTmpl.message, vars) : defaultMsg;
    const logoUrl = extractBusinessLogo(payment.businesses);
    const emailTemplate = wrapHtmlEmail('Payment Receipt', textBody, businessName, logoUrl);

    const recipients = [];
    if (customer?.email) recipients.push(customer.email);
    const adminEmails = await getAdminEmails(business_id);
    for (const item of adminEmails) {
      const emailAddr = typeof item === 'string' ? item : item?.email;
      if (emailAddr && !recipients.includes(emailAddr)) recipients.push(emailAddr);
    }

    let lastRes = null;
    for (const email of recipients) {
      lastRes = await sendEmail({
        business_id,
        recipient_email: email,
        subject,
        body_text: textBody,
        body_html: emailTemplate.htmlBody,
        attachments: emailTemplate.attachments,
        email_type: 'CUSTOMER_PAYMENT',
        reference_id: paymentId,
        reference_number: payment.reference_number
      });
    }

    return lastRes || { success: false, message: 'No recipient email found' };
  } catch (err) {
    console.error('Error sending customer payment email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * 5. SUPPLIER PAYMENT CONFIRMATION EMAIL
 */
const sendSupplierPaymentEmail = async (business_id, paymentId) => {
  try {
    const payment = await prisma.supplier_payments.findFirst({
      where: { id: paymentId, business_id },
      include: { suppliers: true, businesses: true }
    });

    if (!payment) return { success: false, message: 'No payment record found' };

    const supplier = payment.suppliers;
    const businessName = payment.businesses?.business_name || 'VEXA Business';
    const amount = formatINR(payment.amount);
    const date = formatDateStr(payment.payment_date);

    const templates = await getBusinessEmailTemplates(business_id);
    const customTmpl = templates.supplier_payment || {};

    const vars = {
      supplier_name: supplier?.name || 'Valued Supplier',
      business_name: businessName,
      paid_amount: amount,
      payment_date: date,
      payment_method: payment.payment_method || 'Bank Transfer',
      reference_number: payment.reference_number || 'N/A'
    };

    const defaultSubject = `Payment Confirmation from ${businessName}`;
    const defaultMsg = `Hello ${supplier?.name || 'Supplier'},\n\nPayment of ${amount} has been issued on ${date}.\n\nRegards,\n${businessName}`;

    const subject = customTmpl.subject ? renderTemplateText(customTmpl.subject, vars) : defaultSubject;
    const textBody = customTmpl.message ? renderTemplateText(customTmpl.message, vars) : defaultMsg;
    const logoUrl = extractBusinessLogo(payment.businesses);
    const emailTemplate = wrapHtmlEmail('Supplier Payment Advice', textBody, businessName, logoUrl);

    const recipients = [];
    if (supplier?.email) recipients.push(supplier.email);
    const adminEmails = await getAdminEmails(business_id);
    for (const item of adminEmails) {
      const emailAddr = typeof item === 'string' ? item : item?.email;
      if (emailAddr && !recipients.includes(emailAddr)) recipients.push(emailAddr);
    }

    let lastRes = null;
    for (const email of recipients) {
      lastRes = await sendEmail({
        business_id,
        recipient_email: email,
        subject,
        body_text: textBody,
        body_html: emailTemplate.htmlBody,
        attachments: emailTemplate.attachments,
        email_type: 'SUPPLIER_PAYMENT',
        reference_id: paymentId,
        reference_number: payment.reference_number
      });
    }

    return lastRes || { success: false, message: 'No recipient email found' };
  } catch (err) {
    console.error('Error sending supplier payment email:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  extractBusinessLogo,
  wrapHtmlEmail,
  getAllLowStockItems,
  sendLowStockAlert,
  sendSaleInvoiceEmail,
  sendPurchaseOrderEmail,
  sendCustomerPaymentEmail,
  sendSupplierPaymentEmail
};
