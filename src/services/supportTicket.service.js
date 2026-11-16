const prisma = require('../config/db');
const { sendEmail } = require('../config/email');
const env = require('../config/env');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/support');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Allowed MIME types and binary signatures
const ALLOWED_MIME_TYPES = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_ATTACHMENTS_COUNT = 5;

/**
 * Generate Next Support Ticket Number: VEXA-YYYY-000001
 */
const generateTicketNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `VEXA-${year}-`;

  const lastTicket = await prisma.support_tickets.findFirst({
    where: { ticket_number: { startsWith: prefix } },
    orderBy: { ticket_number: 'desc' },
    select: { ticket_number: true }
  });

  let nextSequence = 1;
  if (lastTicket && lastTicket.ticket_number) {
    const parts = lastTicket.ticket_number.split('-');
    const currentNum = parseInt(parts[2], 10);
    if (!isNaN(currentNum)) {
      nextSequence = currentNum + 1;
    }
  }

  return `${prefix}${String(nextSequence).padStart(6, '0')}`;
};

/**
 * Validate and save base64 attachment safely to disk
 */
const saveBase64Attachment = (attachmentObj) => {
  const { fileName, fileType, base64Data } = attachmentObj;

  if (!ALLOWED_MIME_TYPES[fileType]) {
    throw new Error(`File type "${fileType}" is not permitted. Only PNG, JPG, JPEG, WEBP and PDF are accepted.`);
  }

  // Strip possible data URI scheme: data:image/png;base64,...
  const cleanBase64 = base64Data.replace(/^data:[a-zA-Z0-9\/+-]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File "${fileName}" exceeds maximum 10MB limit.`);
  }

  // Validate magic bytes
  if (fileType === 'application/pdf') {
    if (buffer.slice(0, 4).toString() !== '%PDF') {
      throw new Error(`File content signature does not match PDF format.`);
    }
  } else if (fileType === 'image/png') {
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      throw new Error(`File content signature does not match PNG format.`);
    }
  } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      throw new Error(`File content signature does not match JPEG format.`);
    }
  }

  const safeHash = crypto.randomBytes(16).toString('hex');
  const ext = ALLOWED_MIME_TYPES[fileType];
  const diskFileName = `${Date.now()}_${safeHash}${ext}`;
  const diskPath = path.join(UPLOADS_DIR, diskFileName);

  fs.writeFileSync(diskPath, buffer);

  return {
    fileName: fileName || `attachment${ext}`,
    fileType,
    fileSize: buffer.length,
    filePath: diskFileName
  };
};

/**
 * Queue & Dispatch Ticket Notification Emails Asynchronously
 */
const dispatchTicketNotifications = async (ticketId, eventType = 'TICKET_CREATED', extraData = {}) => {
  try {
    const ticket = await prisma.support_tickets.findUnique({
      where: { id: ticketId },
      include: {
        businesses: true,
        users: true,
        attachments: true
      }
    });

    if (!ticket) return;

    const vexaTechEmail = process.env.VEXA_TECH_SUPPORT_EMAIL || 'vexatech.connect@gmail.com';
    const companyAdminEmail = ticket.businesses?.email || null;
    const subscriptionAdminEmail = env.SUBSCRIPTION_ADMIN_EMAIL || 'vexatech.connect@gmail.com';
    const notificationPolicy = process.env.SUPPORT_NOTIFICATION_POLICY || 'OPTION_D'; // A, B, C, or D

    // Determine target recipient set based on Super Admin policy
    const recipients = new Set();
    recipients.add(vexaTechEmail);

    if (notificationPolicy === 'OPTION_B' || notificationPolicy === 'OPTION_D') {
      if (companyAdminEmail && companyAdminEmail.includes('@')) {
        recipients.add(companyAdminEmail);
      }
    }

    if (notificationPolicy === 'OPTION_C' || notificationPolicy === 'OPTION_D') {
      if (subscriptionAdminEmail && subscriptionAdminEmail.includes('@')) {
        recipients.add(subscriptionAdminEmail);
      }
    }

    // Prepare email content based on eventType
    let emailSubject = '';
    let emailHtml = '';

    if (eventType === 'TICKET_CREATED') {
      emailSubject = `New VEXA Invoice Support Ticket – ${ticket.ticket_number} – [${ticket.priority}]`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e293b, #0f172a); padding: 20px; border-radius: 8px; margin-bottom: 24px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">VEXA INVOICE SUPPORT</h2>
            <p style="margin: 4px 0 0; font-size: 13px; color: #94a3b8;">New Customer Support Request Logged</p>
          </div>

          <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
            <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>Ticket Number:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: bold; color: #0f172a;">${ticket.ticket_number}</span></p>
            <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>Priority:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${ticket.priority === 'CRITICAL' ? '#fee2e2; color: #b91c1c' : ticket.priority === 'HIGH' ? '#ffedd5; color: #c2410c' : '#e0e7ff; color: #4338ca'};">${ticket.priority}</span></p>
            <p style="margin: 0 0 6px; font-size: 13px; color: #64748b;"><strong>Category:</strong> ${ticket.category.replace(/_/g, ' ')}</p>
            <p style="margin: 0; font-size: 13px; color: #64748b;"><strong>Affected Module:</strong> ${ticket.affected_module || 'General'}</p>
          </div>

          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Company & Submitter Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px;">
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b; width: 140px;">Company Name:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${ticket.businesses?.business_name || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Company ID:</td>
              <td style="padding: 8px 0; font-family: monospace; color: #0f172a;">${ticket.businesses?.company_id || ticket.business_id}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Submitted By:</td>
              <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${ticket.users?.name || 'Authorized User'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">User Email:</td>
              <td style="padding: 8px 0; color: #0f172a;">${ticket.users?.email || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 8px 0; color: #64748b;">Assigned Role:</td>
              <td style="padding: 8px 0; color: #0f172a;">${ticket.users?.role || 'EMPLOYEE'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;">Submitted On:</td>
              <td style="padding: 8px 0; color: #0f172a;">${new Date(ticket.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          </table>

          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Issue Subject</h3>
          <p style="font-size: 14px; font-weight: 600; color: #1e293b; margin: 0 0 16px;">${ticket.subject}</p>

          <h3 style="font-size: 15px; font-weight: bold; color: #0f172a; margin-bottom: 8px;">Issue Description</h3>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; font-size: 13px; color: #334155; line-height: 1.6; white-space: pre-wrap; margin-bottom: 20px;">${ticket.description}</div>

          ${ticket.attachments && ticket.attachments.length > 0 ? `
            <div style="margin-bottom: 24px; padding: 12px; background: #f1f5f9; border-radius: 6px;">
              <strong style="font-size: 12px; color: #475569;">Attachments (${ticket.attachments.length}):</strong>
              <ul style="margin: 6px 0 0; padding-left: 20px; font-size: 12px; color: #334155;">
                ${ticket.attachments.map(att => `<li>${att.file_name} (${(att.file_size / 1024).toFixed(1)} KB)</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 24px; text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0;">Authorized support agents can manage this ticket in the VEXA TECH Super Admin Panel.</p>
          </div>
        </div>
      `;
    } else if (eventType === 'SUPPORT_REPLIED') {
      emailSubject = `Support Update on Ticket ${ticket.ticket_number}: ${ticket.subject}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">VEXA TECH Support Team Replied</h2>
          <p style="font-size: 13px; color: #64748b;">Ticket: <strong>${ticket.ticket_number}</strong> (${ticket.subject})</p>
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px; border-radius: 6px; font-size: 14px; color: #1e293b; margin: 16px 0; white-space: pre-wrap;">${extraData.message}</div>
          <p style="font-size: 13px; color: #475569;">You can view the full conversation and reply through your company portal under <strong>Help & Support > My Support Tickets</strong>.</p>
        </div>
      `;
      // Send response directly to ticket submitter email
      if (ticket.users?.email) {
        recipients.add(ticket.users.email);
      }
    } else if (eventType === 'STATUS_CHANGED') {
      emailSubject = `Ticket ${ticket.ticket_number} Status Updated to ${ticket.status}`;
      emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Support Ticket Status Changed</h2>
          <p style="font-size: 13px; color: #64748b;">Ticket: <strong>${ticket.ticket_number}</strong></p>
          <p style="font-size: 14px; color: #1e293b;">The status of your ticket has been updated to: <strong style="color: #2563eb;">${ticket.status}</strong></p>
          ${extraData.note ? `<p style="font-size: 13px; color: #475569; background: #f8fafc; padding: 10px; border-radius: 6px;">${extraData.note}</p>` : ''}
          <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Thank you for choosing VEXA Invoice.</p>
        </div>
      `;
      if (ticket.users?.email) {
        recipients.add(ticket.users.email);
      }
    }

    // Dispatch asynchronously to each unique recipient and record notification logs
    for (const recipientEmail of recipients) {
      if (!recipientEmail || !recipientEmail.trim()) continue;

      const notifRecord = await prisma.support_notifications.create({
        data: {
          ticket_id: ticket.id,
          recipient_email: recipientEmail.trim(),
          recipient_type: recipientEmail === vexaTechEmail ? 'VEXA_TECH' : (recipientEmail === companyAdminEmail ? 'COMPANY_ADMIN' : 'TICKET_OWNER'),
          subject: emailSubject,
          status: 'PENDING'
        }
      });

      sendEmail({
        business_id: ticket.business_id,
        recipient_email: recipientEmail.trim(),
        subject: emailSubject,
        body_text: `Ticket: ${ticket.ticket_number}\nSubject: ${ticket.subject}\nStatus: ${ticket.status}\nDescription: ${ticket.description}`,
        body_html: emailHtml,
        email_type: 'SUPPORT_TICKET'
      }).then(async (result) => {
        if (result && result.success) {
          await prisma.support_notifications.update({
            where: { id: notifRecord.id },
            data: { status: 'SENT', sent_at: new Date() }
          }).catch(() => {});
        } else {
          await prisma.support_notifications.update({
            where: { id: notifRecord.id },
            data: { status: 'FAILED', error_message: result?.error || 'Email delivery failed' }
          }).catch(() => {});
        }
      }).catch(async (err) => {
        await prisma.support_notifications.update({
          where: { id: notifRecord.id },
          data: { status: 'FAILED', error_message: err.message }
        }).catch(() => {});
      });
    }
  } catch (error) {
    console.error('Error dispatching support ticket notifications:', error.message);
  }
};

/**
 * Create a new Support Ticket
 */
const createTicket = async (businessId, userId, data, attachments = []) => {
  if (!data.subject || !data.subject.trim()) {
    throw new Error('Ticket subject is required.');
  }
  if (!data.description || !data.description.trim()) {
    throw new Error('Issue description is required.');
  }

  // Idempotency check: prevent duplicate submissions within 30 seconds
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  const duplicate = await prisma.support_tickets.findFirst({
    where: {
      business_id: businessId,
      user_id: userId,
      subject: data.subject.trim(),
      created_at: { gte: thirtySecondsAgo }
    }
  });

  if (duplicate) {
    return {
      success: true,
      ticket: duplicate,
      message: 'Ticket already submitted. Please check your support dashboard.'
    };
  }

  // Validate attachments limit
  if (attachments && attachments.length > MAX_ATTACHMENTS_COUNT) {
    throw new Error(`Maximum ${MAX_ATTACHMENTS_COUNT} attachments permitted per ticket.`);
  }

  // Process attachments
  const savedAttachments = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att && att.base64Data) {
        const saved = saveBase64Attachment(att);
        savedAttachments.push(saved);
      }
    }
  }

  const ticketNumber = await generateTicketNumber();

  // Create Ticket inside Transaction
  const ticket = await prisma.$transaction(async (tx) => {
    const newTicket = await tx.support_tickets.create({
      data: {
        ticket_number: ticketNumber,
        business_id: businessId,
        user_id: userId,
        subject: data.subject.trim(),
        category: data.category || 'OTHER',
        priority: data.priority || 'MEDIUM',
        status: 'OPEN',
        affected_module: data.affected_module || 'General',
        description: data.description.trim(),
        current_route: data.current_route || null,
        app_version: data.app_version || '1.0.0'
      }
    });

    if (savedAttachments.length > 0) {
      await tx.support_ticket_attachments.createMany({
        data: savedAttachments.map(att => ({
          ticket_id: newTicket.id,
          file_name: att.fileName,
          file_type: att.fileType,
          file_size: att.fileSize,
          file_path: att.filePath
        }))
      });
    }

    await tx.support_ticket_activities.create({
      data: {
        ticket_id: newTicket.id,
        actor_type: 'USER',
        actor_name: data.userName || 'Ticket Submitter',
        action: 'TICKET_CREATED',
        new_value: `Created ticket ${ticketNumber}`
      }
    });

    return newTicket;
  });

  // Trigger Asynchronous Email Notifications (Does NOT block HTTP response)
  setImmediate(() => {
    dispatchTicketNotifications(ticket.id, 'TICKET_CREATED').catch(() => {});
  });

  return {
    success: true,
    ticketNumber: ticket.ticket_number,
    ticketId: ticket.id,
    message: `Support ticket ${ticket.ticket_number} created successfully. Our technical team has been notified.`
  };
};

/**
 * Get Company Support Tickets (Scoped strictly by business_id)
 */
const getCompanyTickets = async (businessId, userId, userRole, query = {}) => {
  const where = { business_id: businessId };

  // If user is a regular employee (not ADMIN/MANAGER), they view their own tickets
  if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
    where.user_id = userId;
  }

  if (query.status && query.status !== 'ALL') {
    where.status = query.status;
  }
  if (query.priority && query.priority !== 'ALL') {
    where.priority = query.priority;
  }
  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { ticket_number: { contains: term, mode: 'insensitive' } },
      { subject: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } }
    ];
  }

  const tickets = await prisma.support_tickets.findMany({
    where,
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      attachments: { select: { id: true, file_name: true, file_type: true, file_size: true } },
      messages: {
        where: { is_internal_note: false },
        orderBy: { created_at: 'desc' },
        take: 1
      }
    },
    orderBy: { created_at: 'desc' }
  });

  return tickets.map(t => ({
    id: t.id,
    ticket_number: t.ticket_number,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    affected_module: t.affected_module,
    created_at: t.created_at,
    updated_at: t.updated_at,
    user_name: t.users?.name,
    user_email: t.users?.email,
    user_role: t.users?.role,
    attachments_count: t.attachments.length,
    latest_response: t.messages[0] ? {
      sender_name: t.messages[0].sender_name,
      sender_type: t.messages[0].sender_type,
      message: t.messages[0].message,
      created_at: t.messages[0].created_at
    } : null
  }));
};

/**
 * Get Ticket Details for Company User (Strict Company Isolation, Excludes Internal Notes)
 */
const getCompanyTicketDetails = async (businessId, userId, userRole, ticketId) => {
  const ticket = await prisma.support_tickets.findFirst({
    where: {
      id: ticketId,
      business_id: businessId
    },
    include: {
      users: { select: { id: true, name: true, email: true, role: true } },
      businesses: { select: { id: true, business_name: true, company_id: true } },
      attachments: true,
      messages: {
        where: { is_internal_note: false }, // Company users NEVER see internal notes
        orderBy: { created_at: 'asc' }
      },
      activities: {
        orderBy: { created_at: 'asc' }
      }
    }
  });

  if (!ticket) {
    throw new Error('Support ticket not found or access restricted.');
  }

  // Non-admin can only see their own ticket
  if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && ticket.user_id !== userId) {
    throw new Error('Access restricted. You can only view tickets submitted by your account.');
  }

  return ticket;
};

/**
 * Company User Reply to Ticket
 */
const replyCompanyTicket = async (businessId, userId, userObj, ticketId, messageText, attachments = []) => {
  const ticket = await prisma.support_tickets.findFirst({
    where: { id: ticketId, business_id: businessId }
  });

  if (!ticket) {
    throw new Error('Support ticket not found.');
  }

  if (ticket.status === 'CLOSED') {
    throw new Error('This support ticket has been closed. Please open a new ticket for further assistance.');
  }

  // Process attachments if any
  const savedAttachments = [];
  if (Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att && att.base64Data) {
        savedAttachments.push(saveBase64Attachment(att));
      }
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const newMsg = await tx.support_ticket_messages.create({
      data: {
        ticket_id: ticketId,
        sender_type: 'USER',
        user_id: userId,
        sender_name: userObj.name || 'User',
        message: messageText.trim(),
        is_internal_note: false
      }
    });

    if (savedAttachments.length > 0) {
      await tx.support_ticket_attachments.createMany({
        data: savedAttachments.map(att => ({
          ticket_id: ticketId,
          message_id: newMsg.id,
          file_name: att.fileName,
          file_type: att.fileType,
          file_size: att.fileSize,
          file_path: att.filePath
        }))
      });
    }

    // Automatically set status back to OPEN or IN_PROGRESS if waiting for customer
    const newStatus = ticket.status === 'WAITING_FOR_CUSTOMER' ? 'IN_PROGRESS' : ticket.status;
    await tx.support_tickets.update({
      where: { id: ticketId },
      data: { status: newStatus, updated_at: new Date() }
    });

    await tx.support_ticket_activities.create({
      data: {
        ticket_id: ticketId,
        actor_type: 'USER',
        actor_name: userObj.name || 'User',
        action: 'CUSTOMER_REPLIED',
        new_value: messageText.slice(0, 100)
      }
    });

    return newMsg;
  });

  return { success: true, message };
};

/**
 * Company User Closes / Confirms Resolution of Ticket
 */
const closeCompanyTicket = async (businessId, userId, userObj, ticketId) => {
  const ticket = await prisma.support_tickets.findFirst({
    where: { id: ticketId, business_id: businessId }
  });

  if (!ticket) throw new Error('Ticket not found.');

  await prisma.$transaction([
    prisma.support_tickets.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', closed_at: new Date(), updated_at: new Date() }
    }),
    prisma.support_ticket_activities.create({
      data: {
        ticket_id: ticketId,
        actor_type: 'USER',
        actor_name: userObj.name || 'User',
        action: 'STATUS_CHANGE',
        old_value: ticket.status,
        new_value: 'CLOSED'
      }
    })
  ]);

  return { success: true, message: 'Ticket marked as closed.' };
};

/**
 * Secure Attachment Stream/Download (Scoped by business_id)
 */
const getAttachmentStream = async (businessId, userRole, userId, attachmentId, isAdmin = false) => {
  const attachment = await prisma.support_ticket_attachments.findUnique({
    where: { id: attachmentId },
    include: { support_tickets: true }
  });

  if (!attachment) {
    throw new Error('Attachment not found.');
  }

  // Verify access authorization
  if (!isAdmin) {
    if (attachment.support_tickets.business_id !== businessId) {
      throw new Error('Unauthorized attachment download.');
    }
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER' && attachment.support_tickets.user_id !== userId) {
      throw new Error('Access denied to this attachment.');
    }
  }

  const filePath = path.join(UPLOADS_DIR, attachment.file_path);
  if (!fs.existsSync(filePath)) {
    throw new Error('Physical attachment file missing from storage.');
  }

  return {
    filePath,
    fileName: attachment.file_name,
    fileType: attachment.file_type,
    fileSize: attachment.file_size
  };
};

/**
 * Super Admin: Get all tickets across all companies
 */
const getSuperAdminTickets = async (query = {}) => {
  const where = {};
  if (query.status && query.status !== 'ALL') where.status = query.status;
  if (query.priority && query.priority !== 'ALL') where.priority = query.priority;
  if (query.category && query.category !== 'ALL') where.category = query.category;
  if (query.businessId) where.business_id = query.businessId;

  if (query.search) {
    const term = query.search.trim();
    where.OR = [
      { ticket_number: { contains: term, mode: 'insensitive' } },
      { subject: { contains: term, mode: 'insensitive' } },
      { businesses: { business_name: { contains: term, mode: 'insensitive' } } },
      { users: { name: { contains: term, mode: 'insensitive' } } }
    ];
  }

  const [tickets, totalCount, openCount, inProgressCount, waitingCount, resolvedCount, criticalCount] = await Promise.all([
    prisma.support_tickets.findMany({
      where,
      include: {
        businesses: { select: { id: true, business_name: true, company_id: true } },
        users: { select: { id: true, name: true, email: true, role: true } },
        assigned_admin: { select: { id: true, name: true, email: true } },
        attachments: { select: { id: true } }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    }),
    prisma.support_tickets.count(),
    prisma.support_tickets.count({ where: { status: 'OPEN' } }),
    prisma.support_tickets.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.support_tickets.count({ where: { status: 'WAITING_FOR_CUSTOMER' } }),
    prisma.support_tickets.count({ where: { status: 'RESOLVED' } }),
    prisma.support_tickets.count({ where: { priority: 'CRITICAL', status: { not: 'CLOSED' } } })
  ]);

  return {
    tickets,
    metrics: {
      total: totalCount,
      open: openCount,
      inProgress: inProgressCount,
      waiting: waitingCount,
      resolved: resolvedCount,
      critical: criticalCount
    }
  };
};

/**
 * Super Admin: Get Ticket Detailed View (Includes Internal Notes)
 */
const getSuperAdminTicketDetails = async (ticketId) => {
  const ticket = await prisma.support_tickets.findUnique({
    where: { id: ticketId },
    include: {
      businesses: true,
      users: true,
      assigned_admin: { select: { id: true, name: true, email: true } },
      attachments: true,
      messages: { orderBy: { created_at: 'asc' } },
      activities: { orderBy: { created_at: 'asc' } },
      notifications: { orderBy: { created_at: 'desc' } }
    }
  });

  if (!ticket) throw new Error('Ticket not found.');
  return ticket;
};

/**
 * Super Admin: Reply / Add Internal Note / Change Status
 */
const updateSuperAdminTicket = async (adminObj, ticketId, actionData) => {
  let { action, message, replyMessage, status, priority, assignedToAdminId, isInternalNote } = actionData;

  const msgContent = message || replyMessage;

  // Auto-detect action if not explicitly supplied
  if (!action) {
    if (msgContent && msgContent.trim()) {
      action = 'REPLY';
      message = msgContent;
    } else if (status) {
      action = 'UPDATE_STATUS';
    } else if (assignedToAdminId !== undefined) {
      action = 'ASSIGN';
    }
  }

  const ticket = await prisma.support_tickets.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new Error('Ticket not found.');

  if (action === 'REPLY') {
    const finalMsg = (message || replyMessage || '').trim();
    if (!finalMsg) throw new Error('Message text is required.');

    const newMsg = await prisma.support_ticket_messages.create({
      data: {
        ticket_id: ticketId,
        sender_type: 'ADMIN',
        admin_id: adminObj.id,
        sender_name: adminObj.name || 'VEXA TECH Support',
        message: finalMsg,
        is_internal_note: !!isInternalNote
      }
    });

    await prisma.support_ticket_activities.create({
      data: {
        ticket_id: ticketId,
        actor_type: 'ADMIN',
        actor_name: adminObj.name || 'Support Staff',
        action: isInternalNote ? 'INTERNAL_NOTE_ADDED' : 'REPLY_SENT',
        new_value: finalMsg.slice(0, 100)
      }
    });

    // If customer-facing reply, update status if requested and send email
    if (!isInternalNote) {
      if (status && status !== ticket.status) {
        await prisma.support_tickets.update({
          where: { id: ticketId },
          data: { status, updated_at: new Date() }
        });
      }
      setImmediate(() => {
        dispatchTicketNotifications(ticketId, 'SUPPORT_REPLIED', { message: finalMsg }).catch(() => {});
      });
    }

    return { success: true, message: newMsg };
  }

  if (action === 'UPDATE_STATUS') {
    if (!status) throw new Error('Status is required.');

    const updateData = { status, updated_at: new Date() };
    if (status === 'RESOLVED') updateData.resolved_at = new Date();
    if (status === 'CLOSED') updateData.closed_at = new Date();

    await prisma.$transaction([
      prisma.support_tickets.update({
        where: { id: ticketId },
        data: updateData
      }),
      prisma.support_ticket_activities.create({
        data: {
          ticket_id: ticketId,
          actor_type: 'ADMIN',
          actor_name: adminObj.name || 'Support Staff',
          action: 'STATUS_CHANGE',
          old_value: ticket.status,
          new_value: status
        }
      })
    ]);

    setImmediate(() => {
      dispatchTicketNotifications(ticketId, 'STATUS_CHANGED', { note: `Ticket status set to ${status}` }).catch(() => {});
    });

    return { success: true, status };
  }

  if (action === 'ASSIGN') {
    await prisma.$transaction([
      prisma.support_tickets.update({
        where: { id: ticketId },
        data: { assigned_to_admin_id: assignedToAdminId || null, updated_at: new Date() }
      }),
      prisma.support_ticket_activities.create({
        data: {
          ticket_id: ticketId,
          actor_type: 'ADMIN',
          actor_name: adminObj.name || 'Support Staff',
          action: 'ASSIGNMENT',
          old_value: ticket.assigned_to_admin_id || 'Unassigned',
          new_value: assignedToAdminId || 'Unassigned'
        }
      })
    ]);
    return { success: true };
  }

  throw new Error(`Unsupported action "${action}".`);
};

module.exports = {
  createTicket,
  getCompanyTickets,
  getCompanyTicketDetails,
  replyCompanyTicket,
  closeCompanyTicket,
  getAttachmentStream,
  getSuperAdminTickets,
  getSuperAdminTicketDetails,
  updateSuperAdminTicket
};

