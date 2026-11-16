const nodemailer = require('nodemailer');
const prisma = require('./db');

/**
 * Get nodemailer transporter configured via environment variables
 */
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS environment variables are missing. Emails will be simulated/logged.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Centralized email sending function with DB logging & failure safety
 * @param {Object} options
 * @param {string} options.business_id
 * @param {string} options.recipient_email
 * @param {string} options.subject
 * @param {string} options.body_text
 * @param {string} options.body_html
 * @param {string} [options.email_type='GENERAL'] - SALE_INVOICE, PURCHASE_ORDER, LOW_STOCK, CUSTOMER_PAYMENT, SUPPLIER_PAYMENT, TEST
 * @param {string} [options.reference_id]
 * @param {string} [options.reference_number]
 * @param {Array} [options.attachments]
 */
const sendEmail = async ({
  business_id,
  recipient_email,
  subject,
  body_text,
  body_html,
  email_type = 'GENERAL',
  reference_id = null,
  reference_number = null,
  attachments = []
}) => {
  if (!recipient_email || !recipient_email.trim()) {
    console.log(`ℹ️ No recipient email provided for ${email_type} notification. Skipping email.`);
    return { success: false, message: 'No recipient email specified' };
  }

  const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@vexainvoice.com';
  let emailLogId = null;

  // 1. Record Email Log in DB as PENDING
  try {
    const log = await prisma.email_logs.create({
      data: {
        business_id,
        email_type,
        recipient_email: recipient_email.trim(),
        subject,
        reference_id,
        reference_number,
        status: 'PENDING'
      }
    });
    emailLogId = log.id;
  } catch (err) {
    console.error('Failed to create DB email log entry:', err.message);
  }

  // 2. Transport Execution
  try {
    const transporter = getTransporter();

    if (!transporter) {
      // SMTP not configured - log as PENDING in desktop mode or SIMULATED
      const isDesktop = process.env.IS_DESKTOP === 'true';
      const defaultStatus = isDesktop ? 'PENDING' : 'SENT';
      const statusNote = isDesktop ? 'Offline Desktop Mode - Queued PENDING' : 'Simulated (SMTP not configured)';
      console.log(`[${isDesktop ? 'OFFLINE QUEUED EMAIL' : 'SIMULATED EMAIL'}] To: ${recipient_email} | Subject: ${subject}`);
      if (emailLogId) {
        try {
          const logExist = await prisma.email_logs.findUnique({ where: { id: emailLogId } });
          if (logExist) {
            await prisma.email_logs.update({
              where: { id: emailLogId },
              data: { status: defaultStatus, sent_at: isDesktop ? null : new Date(), error_message: statusNote }
            });
          }
        } catch (e) {}
      }
      return { success: true, message: statusNote };
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'VEXA Invoice'}" <${senderEmail}>`,
      to: recipient_email.trim(),
      subject,
      text: body_text,
      html: body_html,
      attachments
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully [${email_type}] to ${recipient_email}: MessageID ${info.messageId}`);

    if (emailLogId) {
      try {
        const logExist = await prisma.email_logs.findUnique({ where: { id: emailLogId } });
        if (logExist) {
          await prisma.email_logs.update({
            where: { id: emailLogId },
            data: { status: 'SENT', sent_at: new Date() }
          });
        }
      } catch (e) {
        // Record deleted or cleanup race condition
      }
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email sending failed [${email_type}] to ${recipient_email}:`, error.message);

    if (emailLogId) {
      try {
        const logExist = await prisma.email_logs.findUnique({ where: { id: emailLogId } });
        if (logExist) {
          await prisma.email_logs.update({
            where: { id: emailLogId },
            data: { status: 'FAILED', error_message: error.message }
          });
        }
      } catch (logErr) {
        console.error('Failed to update email log status to FAILED:', logErr.message);
      }
    }

    // Do NOT throw error to caller - ensure business transactions do not roll back
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  getTransporter
};
