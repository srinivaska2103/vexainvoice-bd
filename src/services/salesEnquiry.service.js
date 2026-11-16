const prisma = require('../config/db');
const { sendEmail } = require('../config/email');
const razorpay = require('../config/razorpay');
const env = require('../config/env');

/**
 * Generate unique Human-Readable Enquiry Number (e.g. ENQ-2026-000101)
 */
const generateEnquiryNumber = async () => {
  const year = new Date().getFullYear();
  const count = await prisma.sales_enquiries.count();
  const nextNum = (count + 1).toString().padStart(6, '0');
  return `ENQ-${year}-${nextNum}`;
};

/**
 * Create a new Lifetime Plan Sales Enquiry
 */
const createSalesEnquiry = async (data, authenticatedContext = null) => {
  const {
    contact_name,
    business_name,
    email,
    mobile,
    business_type,
    interested_plan = 'Lifetime – ₹59,999',
    current_plan,
    preferred_time,
    message
  } = data;

  if (!contact_name?.trim()) throw new Error('Contact Person Name is required.');
  if (!business_name?.trim()) throw new Error('Business / Company Name is required.');
  if (!email?.trim()) throw new Error('Valid Email Address is required.');
  if (!mobile?.trim()) throw new Error('Mobile Number is required.');
  if (!message?.trim()) throw new Error('Message / Requirements description is required.');

  const cleanEmail = email.trim().toLowerCase();
  const cleanMobile = mobile.trim();
  const cleanName = contact_name.trim();
  const cleanBusiness = business_name.trim();

  // Prevent duplicate submissions within the last 5 minutes with identical email and message
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentDuplicate = await prisma.sales_enquiries.findFirst({
    where: {
      email: cleanEmail,
      message: message.trim(),
      created_at: { gte: fiveMinutesAgo }
    }
  });

  if (recentDuplicate) {
    return {
      enquiry: recentDuplicate,
      isDuplicate: true,
      message: 'Your enquiry has already been received. Our sales team will get in touch shortly.'
    };
  }

  // Authoritative extraction of authenticated business & user
  let businessId = null;
  let companyId = null;
  let userId = null;
  let currentSubscriptionPlan = current_plan || null;

  if (authenticatedContext && authenticatedContext.business_id) {
    businessId = authenticatedContext.business_id;
    userId = authenticatedContext.id;
    
    // Fetch authoritative business data
    const authCompany = await prisma.businesses.findUnique({
      where: { id: businessId },
      include: {
        platform_subscriptions: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { subscription_plans: true }
        }
      }
    });

    if (authCompany) {
      companyId = authCompany.company_id || `VEXA-${authCompany.id.slice(0, 6)}`;
      const latestSub = authCompany.platform_subscriptions?.[0];
      if (latestSub?.subscription_plans?.plan_name) {
        currentSubscriptionPlan = `${latestSub.subscription_plans.plan_name} (${latestSub.status})`;
      } else if (authCompany.subscription_status === 'TRIAL') {
        currentSubscriptionPlan = '7-Day Free Trial';
      }
    }
  }

  const enquiryNumber = await generateEnquiryNumber();

  const newEnquiry = await prisma.sales_enquiries.create({
    data: {
      enquiry_number: enquiryNumber,
      contact_name: cleanName,
      business_name: cleanBusiness,
      email: cleanEmail,
      mobile: cleanMobile,
      business_type: business_type?.trim() || null,
      interested_plan: interested_plan || 'Lifetime – ₹59,999',
      current_plan: currentSubscriptionPlan,
      preferred_time: preferred_time?.trim() || null,
      message: message.trim(),
      source: 'VEXA Invoice Lifetime Pricing',
      status: 'NEW',
      business_id: businessId,
      company_id: companyId,
      user_id: userId,
      notes: {
        create: {
          note_type: 'SYSTEM_EVENT',
          note_text: `Enquiry submitted via Lifetime pricing page. Source: VEXA Invoice Web Application.`,
          author_name: cleanName,
          author_email: cleanEmail
        }
      }
    }
  });

  // 4. Send Email Notification to vexatech.connect@gmail.com
  // The enquiry is saved authoritatively first; email failure will never lose the lead.
  try {
    const targetRecipient = 'vexatech.connect@gmail.com';
    const emailSubject = `New Lifetime Plan Enquiry – VEXA Invoice – ${enquiryNumber}`;

    const submissionTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; background-color: #f8fafc; color: #1e293b;">
        <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <div style="background-color: #2563eb; padding: 24px; color: #ffffff;">
            <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: #bfdbfe; margin-bottom: 4px;">VEXA TECH SALES OPERATIONS</div>
            <h1 style="margin: 0; font-size: 22px; font-weight: 900; line-height: 1.2;">New Lifetime Plan Enquiry</h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #e0e7ff;">Reference: <strong>${enquiryNumber}</strong></p>
          </div>

          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
              <tbody>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b; width: 35%;">Enquiry ID</td>
                  <td style="padding: 10px 0; font-weight: 800; color: #1e293b;">${enquiryNumber}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Contact Person</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #1e293b;">${cleanName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Business / Company</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #1e293b;">${cleanBusiness} ${companyId ? `(${companyId})` : ''}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Email Address</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #2563eb;"><a href="mailto:${cleanEmail}">${cleanEmail}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Mobile Number</td>
                  <td style="padding: 10px 0; font-weight: 700; color: #1e293b;"><a href="tel:${cleanMobile}">${cleanMobile}</a></td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Business Type</td>
                  <td style="padding: 10px 0; color: #1e293b;">${business_type || 'Not specified'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Interested Plan</td>
                  <td style="padding: 10px 0; font-weight: 800; color: #2563eb;">${interested_plan}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Current Subscription</td>
                  <td style="padding: 10px 0; color: #1e293b;">${currentSubscriptionPlan || 'None / New Lead'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Preferred Contact Time</td>
                  <td style="padding: 10px 0; color: #1e293b;">${preferred_time || 'Anytime during business hours'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; font-weight: 700; color: #64748b;">Submission Time</td>
                  <td style="padding: 10px 0; color: #64748b;">${submissionTime}</td>
                </tr>
              </tbody>
            </table>

            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">Customer Requirements & Message</div>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${message.trim()}</p>
            </div>

            <div style="text-align: center;">
              <a href="http://localhost:3002/admin/sales-enquiries/${newEnquiry.id}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px;">Open Enquiry in Super Admin Panel &rarr;</a>
            </div>
          </div>
        </div>
      </div>
    `;

    const emailRes = await sendEmail({
      business_id: businessId || '00000000-0000-0000-0000-000000000000',
      recipient_email: targetRecipient,
      subject: emailSubject,
      body_text: `New Lifetime Plan Enquiry\nRef: ${enquiryNumber}\nName: ${cleanName}\nBusiness: ${cleanBusiness}\nMobile: ${cleanMobile}\nEmail: ${cleanEmail}\nMessage: ${message.trim()}`,
      body_html: htmlBody,
      email_type: 'SALES_ENQUIRY',
      reference_id: newEnquiry.id,
      reference_number: enquiryNumber
    });

    if (emailRes?.success) {
      await prisma.sales_enquiries.update({
        where: { id: newEnquiry.id },
        data: { email_notified: true }
      });
    } else {
      await prisma.sales_enquiries.update({
        where: { id: newEnquiry.id },
        data: {
          email_notified: false,
          email_error: emailRes?.message || 'Queued / provider unconfirmed'
        }
      });
    }
  } catch (emailErr) {
    console.error('Non-blocking: Failed to dispatch email notification for sales enquiry:', emailErr.message);
    await prisma.sales_enquiries.update({
      where: { id: newEnquiry.id },
      data: {
        email_notified: false,
        email_error: emailErr.message
      }
    });
  }

  return {
    enquiry: newEnquiry,
    isDuplicate: false,
    message: 'Thank you! Your Lifetime Plan enquiry has been submitted. Our sales team will get in touch shortly.'
  };
};

/**
 * Super Admin: Get all sales enquiries with filtering, stats and pagination
 */
const getSuperAdminEnquiries = async (query = {}) => {
  const { status, search, page = 1, limit = 25 } = query;
  const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const where = {};

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (search && search.trim()) {
    const s = search.trim();
    where.OR = [
      { enquiry_number: { contains: s, mode: 'insensitive' } },
      { contact_name: { contains: s, mode: 'insensitive' } },
      { business_name: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { mobile: { contains: s, mode: 'insensitive' } },
      { company_id: { contains: s, mode: 'insensitive' } }
    ];
  }

  const [enquiries, total, allStatusCounts] = await Promise.all([
    prisma.sales_enquiries.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { notes: true } }
      }
    }),
    prisma.sales_enquiries.count({ where }),
    prisma.sales_enquiries.groupBy({
      by: ['status'],
      _count: { status: true }
    })
  ]);

  // Aggregate stats
  const stats = {
    total: 0,
    new: 0,
    contacted: 0,
    follow_up: 0,
    negotiation: 0,
    converted: 0,
    closed_lost: 0
  };

  allStatusCounts.forEach((c) => {
    const count = c._count.status;
    stats.total += count;
    const st = c.status?.toUpperCase();
    if (st === 'NEW') stats.new = count;
    else if (st === 'CONTACTED') stats.contacted = count;
    else if (st === 'FOLLOW_UP') stats.follow_up = count;
    else if (st === 'NEGOTIATION') stats.negotiation = count;
    else if (st === 'CONVERTED') stats.converted = count;
    else if (st === 'CLOSED_LOST') stats.closed_lost = count;
  });

  return {
    enquiries,
    stats,
    pagination: {
      total,
      page: parseInt(page),
      limit: take,
      totalPages: Math.ceil(total / take)
    }
  };
};

/**
 * Super Admin: Get Enquiry Details by ID
 */
const getEnquiryDetails = async (id) => {
  const enquiry = await prisma.sales_enquiries.findUnique({
    where: { id },
    include: {
      businesses: {
        select: {
          id: true,
          company_id: true,
          business_name: true,
          email: true,
          phone: true,
          subscription_status: true,
          license_status: true,
          self_shopping_status: true
        }
      },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true
        }
      },
      notes: {
        orderBy: { created_at: 'desc' }
      }
    }
  });

  if (!enquiry) throw new Error('Sales enquiry not found.');
  return enquiry;
};

/**
 * Super Admin: Update Enquiry Status, Follow-up, or Internal Notes
 */
const updateEnquiryStatusAndNotes = async (id, payload, adminUser) => {
  const enquiry = await prisma.sales_enquiries.findUnique({ where: { id } });
  if (!enquiry) throw new Error('Sales enquiry not found.');

  const {
    status,
    assigned_admin,
    contact_date,
    follow_up_date,
    next_action,
    note_text,
    note_type = 'INTERNAL_NOTE'
  } = payload;

  const dataToUpdate = {};
  if (status && status !== enquiry.status) {
    dataToUpdate.status = status;
    if (status === 'CONVERTED' && !enquiry.converted_at) {
      dataToUpdate.converted_at = new Date();
    }
  }

  if (assigned_admin !== undefined) dataToUpdate.assigned_admin = assigned_admin;
  if (contact_date !== undefined) dataToUpdate.contact_date = contact_date ? new Date(contact_date) : null;
  if (follow_up_date !== undefined) dataToUpdate.follow_up_date = follow_up_date ? new Date(follow_up_date) : null;
  if (next_action !== undefined) dataToUpdate.next_action = next_action;

  // Transactionally update enquiry and append note if provided
  return await prisma.$transaction(async (tx) => {
    let noteCreated = null;

    if (note_text && note_text.trim()) {
      noteCreated = await tx.sales_enquiry_notes.create({
        data: {
          enquiry_id: id,
          note_type,
          note_text: note_text.trim(),
          author_name: adminUser?.name || 'Super Admin',
          author_email: adminUser?.email || 'vexatech.connect@gmail.com'
        }
      });
    }

    if (status && status !== enquiry.status && (!note_text || note_type !== 'STATUS_CHANGE')) {
      await tx.sales_enquiry_notes.create({
        data: {
          enquiry_id: id,
          note_type: 'STATUS_CHANGE',
          note_text: `Status changed from ${enquiry.status} to ${status}.`,
          author_name: adminUser?.name || 'Super Admin',
          author_email: adminUser?.email || 'vexatech.connect@gmail.com'
        }
      });
    }

    const updated = await tx.sales_enquiries.update({
      where: { id },
      data: dataToUpdate,
      include: {
        notes: { orderBy: { created_at: 'desc' } }
      }
    });

    return updated;
  });
};

/**
 * Super Admin: Create Verified Razorpay Lifetime Payment Order for Enquiry
 */
const createLifetimePaymentForEnquiry = async (enquiryId, adminUser) => {
  if (!razorpay.isConfigured()) {
    throw new Error('Razorpay credentials are not configured on the server. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  const enquiry = await prisma.sales_enquiries.findUnique({
    where: { id: enquiryId },
    include: { businesses: true }
  });

  if (!enquiry) throw new Error('Sales enquiry not found.');

  // If already paid
  if (enquiry.payment_status === 'PAID') {
    throw new Error(`This enquiry has already been paid and processed via Razorpay (${enquiry.razorpay_payment_id}).`);
  }

  let businessId = enquiry.business_id;

  // If business was not already linked, try to match by email
  if (!businessId) {
    const existingBiz = await prisma.businesses.findFirst({
      where: { email: enquiry.email }
    });
    if (existingBiz) {
      businessId = existingBiz.id;
      await prisma.sales_enquiries.update({
        where: { id: enquiryId },
        data: {
          business_id: existingBiz.id,
          company_id: existingBiz.company_id || `VEXA-${existingBiz.id.slice(0, 6)}`
        }
      });
    }
  }

  const totalAmount = 59999.00;
  const amountInPaise = Math.round(totalAmount * 100);

  const rzp = razorpay.getRazorpayInstance();
  const rzpOrder = await rzp.orders.create({
    amount: amountInPaise,
    currency: 'INR',
    receipt: `rcpt_enq_${enquiry.enquiry_number.slice(-8)}`,
    notes: {
      enquiry_id: enquiry.id,
      enquiry_number: enquiry.enquiry_number,
      business_id: businessId || '',
      company_id: enquiry.company_id || '',
      customer_email: enquiry.email,
      plan_type: 'LIFETIME_ONE_TIME'
    }
  });

  const orderId = rzpOrder.id;

  // Record order details on enquiry and internal notes
  await prisma.$transaction(async (tx) => {
    await tx.sales_enquiries.update({
      where: { id: enquiryId },
      data: {
        razorpay_order_id: orderId,
        payment_status: 'ORDER_CREATED',
        payment_amount: totalAmount,
        status: enquiry.status === 'NEW' ? 'NEGOTIATION' : enquiry.status
      }
    });

    await tx.sales_enquiry_notes.create({
      data: {
        enquiry_id: enquiryId,
        note_type: 'PAYMENT_LINK_CREATED',
        note_text: `Authorized Lifetime Order ₹59,999 created with Razorpay Order ID: ${orderId}.`,
        author_name: adminUser?.name || 'Super Admin',
        author_email: adminUser?.email || 'vexatech.connect@gmail.com'
      }
    });
  });

  return {
    order_id: orderId,
    key_id: env.RAZORPAY_KEY_ID,
    amount: totalAmount,
    amount_in_paise: amountInPaise,
    currency: 'INR',
    enquiry_number: enquiry.enquiry_number,
    customer: {
      name: enquiry.contact_name,
      business_name: enquiry.business_name,
      email: enquiry.email,
      contact: (enquiry.mobile || '').replace(/[^0-9]/g, '').slice(-10)
    }
  };
};

/**
 * Super Admin or Client: Verify Lifetime Payment for Enquiry and Grant Entitlement
 */
const verifyEnquiryLifetimePayment = async (enquiryId, verificationData) => {
  const { order_id, razorpay_payment_id, razorpay_signature } = verificationData;

  const enquiry = await prisma.sales_enquiries.findUnique({
    where: { id: enquiryId },
    include: { businesses: true }
  });

  if (!enquiry) throw new Error('Sales enquiry not found.');

  const orderId = order_id || enquiry.razorpay_order_id;
  if (!orderId) throw new Error('Order ID is required to verify enquiry payment.');

  // Verify signature if provided
  if (razorpay_payment_id && razorpay_signature) {
    const isSigValid = razorpay.verifyPaymentSignature({
      order_id: orderId,
      razorpay_payment_id,
      razorpay_signature
    });
    if (!isSigValid) throw new Error('Invalid Razorpay payment signature.');
  }

  // Authoritatively fetch order status from Razorpay
  const rzp = razorpay.getRazorpayInstance();
  const rzpOrder = await rzp.orders.fetch(orderId);
  const isPaid = (rzpOrder.status || '').toUpperCase() === 'PAID';

  if (!isPaid) {
    throw new Error(`Razorpay order is ${rzpOrder.status}. Payment has not been captured yet.`);
  }

  const now = new Date();
  const paymentRef = razorpay_payment_id || `RZP-PAY-${orderId}`;
  const totalAmount = Number(rzpOrder.amount_paid || rzpOrder.amount) / 100;

  let businessId = enquiry.business_id;

  // If business was not already linked, find or assign
  if (!businessId) {
    const biz = await prisma.businesses.findFirst({ where: { email: enquiry.email } });
    if (biz) businessId = biz.id;
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update enquiry record
    const updatedEnquiry = await tx.sales_enquiries.update({
      where: { id: enquiryId },
      data: {
        status: 'CONVERTED',
        payment_status: 'PAID',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentRef,
        payment_amount: totalAmount,
        converted_at: now
      }
    });

    // 2. Add conversion note
    await tx.sales_enquiry_notes.create({
      data: {
        enquiry_id: enquiryId,
        note_type: 'PAYMENT_VERIFIED',
        note_text: `Payment of ₹${totalAmount.toFixed(2)} verified successfully via Razorpay Payment ID: ${paymentRef}. Enquiry marked as CONVERTED.`,
        author_name: 'Payment Webhook / Verification',
        author_email: 'vexatech.connect@gmail.com'
      }
    });

    // 3. If linked to an active company, grant LIFETIME entitlement
    if (businessId) {
      const company = await tx.businesses.findUnique({ where: { id: businessId } });
      if (company) {
        let lic = await tx.platform_licenses.findFirst({
          where: { business_id: businessId, license_type: 'ONE_TIME_LICENSE' }
        });

        if (!lic) {
          lic = await tx.platform_licenses.create({
            data: {
              license_key: `LIC-LIFE-${company.company_id || company.id.slice(0, 6)}-${Date.now().toString(36).toUpperCase()}`,
              company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
              business_id: businessId,
              license_type: 'ONE_TIME_LICENSE',
              status: 'ACTIVE',
              duration_type: 'LIFETIME',
              activated_at: now,
              expiry_date: null
            }
          });
        } else {
          lic = await tx.platform_licenses.update({
            where: { id: lic.id },
            data: { status: 'ACTIVE', activated_at: now, expiry_date: null }
          });
        }

        await tx.businesses.update({
          where: { id: businessId },
          data: {
            self_shopping_status: 'LIFETIME_ACTIVE',
            license_status: 'ACTIVE',
            subscription_status: 'ACTIVE'
          }
        });

        // Record payment transaction
        await tx.payment_transactions.create({
          data: {
            company_id: company.company_id || `VEXA-${company.id.slice(0, 6)}`,
            business_id: businessId,
            license_id: lic.id,
            payment_type: 'ONE_TIME_LICENSE',
            payment_method: 'ONLINE',
            amount: totalAmount,
            currency: 'INR',
            status: 'VERIFIED',
            transaction_type: 'LIFETIME_SALES_CONVERSION',
            provider: 'RAZORPAY',
            provider_order_id: orderId,
            provider_payment_id: paymentRef,
            idempotency_key: `ENQUIRY-PAY-${enquiryId}-${orderId}`,
            reference_number: enquiry.enquiry_number,
            notes: `Converted from Sales Enquiry ${enquiry.enquiry_number}. Lifetime license issued.`
          }
        });
      }
    }

    return updatedEnquiry;
  });

  return {
    success: true,
    message: 'Lifetime payment verified and entitlement granted.',
    enquiry: result
  };
};

module.exports = {
  createSalesEnquiry,
  getSuperAdminEnquiries,
  getEnquiryDetails,
  updateEnquiryStatusAndNotes,
  createLifetimePaymentForEnquiry,
  verifyEnquiryLifetimePayment
};

