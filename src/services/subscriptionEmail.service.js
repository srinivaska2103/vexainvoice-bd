const { sendEmail } = require('../config/email');
const env = require('../config/env');
const prisma = require('../config/db');

/**
 * Format currency amount
 */
const formatInr = (amount) => {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date display
 */
const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Common responsive HTML wrapper for VEXA Invoice subscription emails
 */
const getSubscriptionEmailTemplate = ({ title, preheader, contentHtml, ctaText = 'View Subscription & Billing', ctaUrl = `${env.CLIENT_URL}/settings/subscription` }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
      .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
      .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; }
      .logo { font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
      .badge { display: inline-block; background: rgba(255, 255, 255, 0.2); color: #ffffff; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-top: 6px; letter-spacing: 0.5px; }
      .body { padding: 32px 28px; }
      .h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0; }
      .p { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0; }
      .card { background-color: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
      .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
      .detail-row:last-child { border-bottom: none; }
      .label { color: #64748b; font-weight: 500; }
      .value { color: #0f172a; font-weight: 600; text-align: right; }
      .cta-btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 8px; margin: 10px 0 20px 0; text-align: center; }
      .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div style="display:none;font-size:1px;color:#333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${preheader || title}
    </div>
    <div class="container">
      <div class="header">
        <div class="logo">VEXA INVOICE</div>
        <div class="badge">Official Subscription Notice</div>
      </div>
      <div class="body">
        ${contentHtml}
        <div style="text-align: center;">
          <a href="${ctaUrl}" class="cta-btn">${ctaText}</a>
        </div>
        <p class="p" style="font-size: 12px; color: #94a3b8; margin-top: 15px; text-align: center;">
          If you have any questions or require assistance, please contact us at support@vexatech.in.
        </p>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} VEXA TECH. All rights reserved.<br>
        VEXA Invoice Software Platform • Enterprise Billing Engine
      </div>
    </div>
  </body>
  </html>
  `;
};

/**
 * Send async notification safely with DB logging and duplicate avoidance
 */
const dispatchSafeEmail = async ({ businessId, toEmail, subject, textBody, htmlBody, emailType, referenceId, referenceNumber }) => {
  if (!toEmail || !toEmail.includes('@')) return;

  // Fire asynchronously without blocking the caller
  setImmediate(async () => {
    try {
      await sendEmail({
        business_id: businessId,
        recipient_email: toEmail,
        subject,
        body_text: textBody,
        body_html: htmlBody,
        email_type: emailType,
        reference_id: referenceId,
        reference_number: referenceNumber
      });
    } catch (err) {
      console.error(`[SUBSCRIPTION EMAIL ERROR] Failed to send ${emailType} to ${toEmail}:`, err.message);
    }
  });
};

/**
 * A. New subscription successful
 * To: Subscriber and VEXA TECH admin
 */
const sendNewSubscriptionSuccessEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  planName = 'VEXA Invoice Monthly',
  amount = 599.00,
  paymentReference,
  startDate = new Date(),
  nextRenewalDate,
  mandateStatus = 'ACTIVE',
  subscriptionId
}) => {
  const adminEmail = env.SUBSCRIPTION_ADMIN_EMAIL;
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company / Business:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Subscriber:</span><span class="value">${subscriberName || 'Authorized Owner'}</span></div>
      <div class="detail-row"><span class="label">Plan:</span><span class="value">${planName}</span></div>
      <div class="detail-row"><span class="label">Billing Amount:</span><span class="value">${formatInr(amount)} / month</span></div>
      <div class="detail-row"><span class="label">Payment Reference:</span><span class="value">${paymentReference || 'VERIFIED'}</span></div>
      <div class="detail-row"><span class="label">Start Date:</span><span class="value">${formatDate(startDate)}</span></div>
      <div class="detail-row"><span class="label">Next Renewal Date:</span><span class="value">${formatDate(nextRenewalDate)}</span></div>
      <div class="detail-row"><span class="label">Recurring Mandate:</span><span class="value">${mandateStatus}</span></div>
    </div>
  `;

  // 1. Email to Subscriber
  const subscriberContent = `
    <h1 class="h1">🎉 Welcome to VEXA Invoice Full Access!</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">Your subscription to <strong>${planName}</strong> has been successfully authorized and confirmed. Full access to all business modules (Invoicing, Inventory, CRM, Financials, Reports) is now activated for your company.</p>
    ${detailsHtml}
    <p class="p">Your recurring monthly billing mandate is now active. Your subscription will automatically renew each month.</p>
  `;

  const subscriberHtml = getSubscriptionEmailTemplate({
    title: `Subscription Activated — ${companyName}`,
    preheader: `Your VEXA Invoice subscription is now active!`,
    contentHtml: subscriberContent,
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Subscription Activated — Welcome to VEXA Invoice (${companyName})`,
    textBody: `Your VEXA Invoice subscription for ${companyName} is active. Plan: ${planName} at ${formatInr(amount)}/mo. Payment Ref: ${paymentReference}. Next renewal: ${formatDate(nextRenewalDate)}.`,
    htmlBody: subscriberHtml,
    emailType: 'SUBSCRIPTION_ACTIVATED',
    referenceId: subscriptionId,
    referenceNumber: paymentReference
  });

  // 2. Email to Admin
  if (adminEmail && adminEmail !== subscriberEmail) {
    const adminContent = `
      <h1 class="h1">📈 New Subscription Confirmed</h1>
      <p class="p">A new company subscription has been confirmed and activated via Razorpay:</p>
      ${detailsHtml}
    `;

    const adminHtml = getSubscriptionEmailTemplate({
      title: `[NEW SUBSCRIPTION] ${companyName} (₹599/mo)`,
      preheader: `New paid subscription activated for ${companyName}`,
      contentHtml: adminContent,
      ctaUrl: billingLink
    });

    dispatchSafeEmail({
      businessId,
      toEmail: adminEmail,
      subject: `[ADMIN ALERT] New Subscription: ${companyName} (${formatInr(amount)})`,
      textBody: `New subscription activated for ${companyName}. Plan: ${planName}. Amount: ${formatInr(amount)}. Reference: ${paymentReference}.`,
      htmlBody: adminHtml,
      emailType: 'ADMIN_SUBSCRIPTION_ALERT',
      referenceId: subscriptionId,
      referenceNumber: paymentReference
    });
  }
};

/**
 * B. Subscription cancellation
 * To: Subscriber and VEXA TECH admin
 */
const sendSubscriptionCancellationEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  cancellationStatus = 'CANCELLED',
  requestDate = new Date(),
  effectiveDate,
  accessRemainsUntilEnd = true,
  autoRenew = false,
  subscriptionId
}) => {
  const adminEmail = env.SUBSCRIPTION_ADMIN_EMAIL;
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Cancellation Status:</span><span class="value">${cancellationStatus}</span></div>
      <div class="detail-row"><span class="label">Request Date:</span><span class="value">${formatDate(requestDate)}</span></div>
      <div class="detail-row"><span class="label">Effective Cancellation Date:</span><span class="value">${formatDate(effectiveDate)}</span></div>
      <div class="detail-row"><span class="label">Access Until Period End:</span><span class="value">${accessRemainsUntilEnd ? 'Yes, Full Access Maintained' : 'Immediate'}</span></div>
      <div class="detail-row"><span class="label">Future Auto-Renewal:</span><span class="value">${autoRenew ? 'Active' : 'Disabled'}</span></div>
    </div>
  `;

  // Subscriber Notice
  const subscriberContent = `
    <h1 class="h1">Subscription Cancellation Update</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">We have processed your subscription cancellation request for <strong>${companyName}</strong>.</p>
    ${detailsHtml}
    <p class="p">${accessRemainsUntilEnd 
      ? `You will continue to have full access to all your business data, invoices, and modules until <strong>${formatDate(effectiveDate)}</strong>. After this date, your account will enter restricted billing mode.` 
      : `Your subscription has been terminated and future charges have stopped.`
    }</p>
    <p class="p">You can reactivate your subscription anytime by visiting your Subscription & Billing settings.</p>
  `;

  const subscriberHtml = getSubscriptionEmailTemplate({
    title: `Subscription Cancelled — ${companyName}`,
    preheader: `Cancellation notice for your VEXA Invoice subscription`,
    contentHtml: subscriberContent,
    ctaText: 'Manage Subscription',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Subscription Cancellation Notice — VEXA Invoice (${companyName})`,
    textBody: `Subscription for ${companyName} has been cancelled. Status: ${cancellationStatus}. Effective: ${formatDate(effectiveDate)}. Access remains until period end: ${accessRemainsUntilEnd ? 'Yes' : 'No'}.`,
    htmlBody: subscriberHtml,
    emailType: 'SUBSCRIPTION_CANCELLED',
    referenceId: subscriptionId
  });

  // Admin Notice
  if (adminEmail && adminEmail !== subscriberEmail) {
    const adminContent = `
      <h1 class="h1">📉 Subscription Cancelled</h1>
      <p class="p">A customer subscription has been cancelled:</p>
      ${detailsHtml}
    `;

    const adminHtml = getSubscriptionEmailTemplate({
      title: `[CANCELLATION] ${companyName}`,
      preheader: `Subscription cancelled for ${companyName}`,
      contentHtml: adminContent,
      ctaUrl: billingLink
    });

    dispatchSafeEmail({
      businessId,
      toEmail: adminEmail,
      subject: `[ADMIN ALERT] Subscription Cancelled: ${companyName}`,
      textBody: `Subscription cancelled for ${companyName}. Status: ${cancellationStatus}. Effective: ${formatDate(effectiveDate)}.`,
      htmlBody: adminHtml,
      emailType: 'ADMIN_SUBSCRIPTION_CANCELLED',
      referenceId: subscriptionId
    });
  }
};

/**
 * C. Automatic renewal successful
 * To: Subscriber and VEXA TECH admin
 */
const sendRenewalSuccessEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  amountCharged = 599.00,
  paymentReference,
  periodStart,
  periodEnd,
  nextRenewalDate,
  subscriptionStatus = 'ACTIVE',
  subscriptionId
}) => {
  const adminEmail = env.SUBSCRIPTION_ADMIN_EMAIL;
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Amount Charged:</span><span class="value">${formatInr(amountCharged)}</span></div>
      <div class="detail-row"><span class="label">Payment Reference:</span><span class="value">${paymentReference || 'N/A'}</span></div>
      <div class="detail-row"><span class="label">Billing Period Covered:</span><span class="value">${formatDate(periodStart)} – ${formatDate(periodEnd)}</span></div>
      <div class="detail-row"><span class="label">Next Renewal Date:</span><span class="value">${formatDate(nextRenewalDate)}</span></div>
      <div class="detail-row"><span class="label">Subscription Status:</span><span class="value">${subscriptionStatus}</span></div>
    </div>
  `;

  // Subscriber Notice
  const subscriberContent = `
    <h1 class="h1">Renewal Successful — Thank You!</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">Your monthly subscription for <strong>${companyName}</strong> has been automatically renewed successfully.</p>
    ${detailsHtml}
    <p class="p">Your company account remains fully active with uninterrupted access to all features.</p>
  `;

  const subscriberHtml = getSubscriptionEmailTemplate({
    title: `Renewal Successful — ${companyName}`,
    preheader: `Your VEXA Invoice subscription renewed successfully`,
    contentHtml: subscriberContent,
    ctaText: 'View Invoice & Receipt',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Subscription Renewal Successful — VEXA Invoice (${companyName})`,
    textBody: `Your VEXA Invoice subscription for ${companyName} has renewed for ${formatInr(amountCharged)}. Covered through: ${formatDate(periodEnd)}. Payment Ref: ${paymentReference}.`,
    htmlBody: subscriberHtml,
    emailType: 'SUBSCRIPTION_RENEWED',
    referenceId: subscriptionId,
    referenceNumber: paymentReference
  });

  // Admin Notice
  if (adminEmail && adminEmail !== subscriberEmail) {
    const adminContent = `
      <h1 class="h1">💰 Subscription Auto-Renewal Received</h1>
      <p class="p">A monthly recurring charge succeeded via Razorpay:</p>
      ${detailsHtml}
    `;

    const adminHtml = getSubscriptionEmailTemplate({
      title: `[RENEWAL] ${companyName} (${formatInr(amountCharged)})`,
      preheader: `Monthly renewal paid for ${companyName}`,
      contentHtml: adminContent,
      ctaUrl: billingLink
    });

    dispatchSafeEmail({
      businessId,
      toEmail: adminEmail,
      subject: `[ADMIN ALERT] Renewal Paid: ${companyName} (${formatInr(amountCharged)})`,
      textBody: `Subscription renewed for ${companyName}. Charged: ${formatInr(amountCharged)}. Ref: ${paymentReference}.`,
      htmlBody: adminHtml,
      emailType: 'ADMIN_SUBSCRIPTION_RENEWED',
      referenceId: subscriptionId,
      referenceNumber: paymentReference
    });
  }
};

/**
 * D. Renewal failed or payment action required
 * To: Subscriber and VEXA TECH admin
 */
const sendRenewalFailedEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  amountDue = 599.00,
  paymentStatus = 'PAYMENT_FAILED',
  failureReason,
  gracePeriodDeadline,
  currentAccessStatus = 'ACTIVE (In Grace Period)',
  subscriptionId
}) => {
  const adminEmail = env.SUBSCRIPTION_ADMIN_EMAIL;
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card" style="background-color: #fff7ed; border-color: #ffedd5;">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Payment Status:</span><span class="value" style="color: #c2410c;">${paymentStatus}</span></div>
      <div class="detail-row"><span class="label">Amount Due:</span><span class="value">${formatInr(amountDue)}</span></div>
      ${failureReason ? `<div class="detail-row"><span class="label">Reason:</span><span class="value">${failureReason}</span></div>` : ''}
      <div class="detail-row"><span class="label">Grace Period Deadline:</span><span class="value" style="color: #b45309;">${formatDate(gracePeriodDeadline)}</span></div>
      <div class="detail-row"><span class="label">Current Access Status:</span><span class="value">${currentAccessStatus}</span></div>
    </div>
  `;

  // Subscriber Notice
  const subscriberContent = `
    <h1 class="h1" style="color: #c2410c;">⚠️ Action Required: Subscription Renewal Failed</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">We were unable to process the recurring monthly charge for your VEXA Invoice subscription.</p>
    ${detailsHtml}
    <p class="p"><strong>Grace Period Protection:</strong> To prevent any interruption to your daily business operations, full access remains enabled until <strong>${formatDate(gracePeriodDeadline)}</strong>. Please update your payment mandate or retry the payment before this deadline to avoid temporary access restriction.</p>
  `;

  const subscriberHtml = getSubscriptionEmailTemplate({
    title: `Payment Action Required — ${companyName}`,
    preheader: `Action required: VEXA Invoice renewal payment failed`,
    contentHtml: subscriberContent,
    ctaText: 'Retry Payment Now',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Payment Action Required: VEXA Invoice Renewal Failed (${companyName})`,
    textBody: `Your monthly renewal payment of ${formatInr(amountDue)} for ${companyName} could not be processed. Grace period active until ${formatDate(gracePeriodDeadline)}. Please visit ${billingLink} to retry payment.`,
    htmlBody: subscriberHtml,
    emailType: 'SUBSCRIPTION_PAYMENT_FAILED',
    referenceId: subscriptionId
  });

  // Admin Notice
  if (adminEmail && adminEmail !== subscriberEmail) {
    const adminContent = `
      <h1 class="h1" style="color: #c2410c;">⚠️ Customer Renewal Payment Failed</h1>
      <p class="p">A scheduled subscription renewal charge failed:</p>
      ${detailsHtml}
    `;

    const adminHtml = getSubscriptionEmailTemplate({
      title: `[PAYMENT FAILED] ${companyName} (${formatInr(amountDue)})`,
      preheader: `Renewal charge failed for ${companyName}`,
      contentHtml: adminContent,
      ctaUrl: billingLink
    });

    dispatchSafeEmail({
      businessId,
      toEmail: adminEmail,
      subject: `[ADMIN ALERT] Renewal Failed: ${companyName} (${formatInr(amountDue)})`,
      textBody: `Subscription renewal failed for ${companyName}. Status: ${paymentStatus}. Grace period: ${formatDate(gracePeriodDeadline)}.`,
      htmlBody: adminHtml,
      emailType: 'ADMIN_SUBSCRIPTION_FAILED',
      referenceId: subscriptionId
    });
  }
};

/**
 * E. Upcoming renewal reminder
 * Sent before renewal (e.g. 3 days before expected renewal date)
 */
const sendUpcomingRenewalReminderEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  expectedAmount = 599.00,
  renewalDate,
  subscriptionId
}) => {
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Expected Amount:</span><span class="value">${formatInr(expectedAmount)}</span></div>
      <div class="detail-row"><span class="label">Scheduled Renewal Date:</span><span class="value">${formatDate(renewalDate)}</span></div>
      <div class="detail-row"><span class="label">Payment Method:</span><span class="value">Authorized Payment Mandate</span></div>
    </div>
  `;

  const content = `
    <h1 class="h1">Upcoming Subscription Renewal Reminder</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">This is a friendly reminder that your monthly subscription for <strong>${companyName}</strong> will automatically renew on <strong>${formatDate(renewalDate)}</strong>.</p>
    ${detailsHtml}
    <p class="p">No action is required from you if your bank mandate and account balance are active. If you would like to view your billing history or manage your subscription settings, please click below.</p>
  `;

  const html = getSubscriptionEmailTemplate({
    title: `Upcoming Renewal Notice — ${companyName}`,
    preheader: `Upcoming monthly renewal reminder for VEXA Invoice`,
    contentHtml: content,
    ctaText: 'Manage Subscription',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Upcoming Renewal Notice: VEXA Invoice (${companyName})`,
    textBody: `Your VEXA Invoice subscription will automatically renew on ${formatDate(renewalDate)} for ${formatInr(expectedAmount)}. You can manage your subscription at ${billingLink}.`,
    htmlBody: html,
    emailType: 'SUBSCRIPTION_RENEWAL_REMINDER',
    referenceId: subscriptionId
  });
};

/**
 * F. Trial Started Email
 */
const sendTrialStartedEmail = async ({
  businessId,
  companyName,
  companyId,
  subscriberName,
  subscriberEmail,
  trialStartDate = new Date(),
  trialEndDate,
  subscriptionId
}) => {
  const dashboardLink = `${env.CLIENT_URL}/dashboard`;
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company Name:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Company ID:</span><span class="value">${companyId}</span></div>
      <div class="detail-row"><span class="label">Trial Start Date:</span><span class="value">${formatDate(trialStartDate)}</span></div>
      <div class="detail-row"><span class="label">Trial Expiry Date:</span><span class="value">${formatDate(trialEndDate)}</span></div>
      <div class="detail-row"><span class="label">Trial Duration:</span><span class="value">7 Days (Full Access)</span></div>
      <div class="detail-row"><span class="label">Plan After Trial:</span><span class="value">${formatInr(599)} / month</span></div>
    </div>
  `;

  const content = `
    <h1 class="h1">Welcome to VEXA Invoice — 7-Day Free Trial Activated!</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">Congratulations! Your company <strong>${companyName}</strong> has been registered successfully, and your <strong>7-Day Free Trial</strong> is now active. You have full access to billing, inventory, POS sales, and multi-user management.</p>
    ${detailsHtml}
    <p class="p">No credit card or payment details are required during your trial. After your 7-day trial ends, you can easily subscribe to continue uninterrupted access for just ₹599/month.</p>
  `;

  const html = getSubscriptionEmailTemplate({
    title: `Welcome to VEXA Invoice — 7-Day Free Trial Started`,
    preheader: `Your 7-Day Free Trial for ${companyName} is active!`,
    contentHtml: content,
    ctaText: 'Go to Executive Dashboard',
    ctaUrl: dashboardLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Welcome to VEXA Invoice! Your 7-Day Free Trial is Active (${companyName})`,
    textBody: `Your 7-day free trial for ${companyName} is active until ${formatDate(trialEndDate)}. Access your dashboard at ${dashboardLink}.`,
    htmlBody: html,
    emailType: 'TRIAL_STARTED',
    referenceId: subscriptionId
  });
};

/**
 * G. Trial Reminder — 3 Days Remaining
 */
const sendTrialReminder3DaysEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  trialEndDate,
  daysRemaining = 3,
  subscriptionId
}) => {
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Time Remaining:</span><span class="value font-bold text-amber-600">${daysRemaining} Days</span></div>
      <div class="detail-row"><span class="label">Trial Expiry Date:</span><span class="value">${formatDate(trialEndDate)}</span></div>
      <div class="detail-row"><span class="label">Monthly Plan:</span><span class="value">₹599 / month</span></div>
    </div>
  `;

  const content = `
    <h1 class="h1">3 Days Remaining in Your Free Trial</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">We hope you're enjoying VEXA Invoice! This is a reminder that your 7-day free trial for <strong>${companyName}</strong> has <strong>${daysRemaining} days remaining</strong> and will conclude on <strong>${formatDate(trialEndDate)}</strong>.</p>
    ${detailsHtml}
    <p class="p">To ensure seamless, uninterrupted access to your billing and stock management, you can subscribe to <strong>VEXA Invoice Monthly</strong> at any time.</p>
  `;

  const html = getSubscriptionEmailTemplate({
    title: `3 Days Left in Your Free Trial — ${companyName}`,
    preheader: `3 days remaining in your VEXA Invoice trial`,
    contentHtml: content,
    ctaText: 'Subscribe Now — ₹599/month',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Trial Reminder: 3 Days Remaining in Your VEXA Invoice Trial (${companyName})`,
    textBody: `Your trial for ${companyName} expires on ${formatDate(trialEndDate)}. Subscribe at ${billingLink} to continue using VEXA Invoice.`,
    htmlBody: html,
    emailType: 'TRIAL_REMINDER_3D',
    referenceId: subscriptionId
  });
};

/**
 * H. Trial Reminder — 1 Day Remaining (24 hours)
 */
const sendTrialReminder1DayEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  trialEndDate,
  subscriptionId
}) => {
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Trial Expiry:</span><span class="value font-bold text-rose-600">${formatDate(trialEndDate)} (Tomorrow)</span></div>
      <div class="detail-row"><span class="label">Monthly Subscription:</span><span class="value">₹599 / month</span></div>
    </div>
  `;

  const content = `
    <h1 class="h1">Your Free Trial Expires Tomorrow!</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">Your 7-day free trial for <strong>${companyName}</strong> expires in approximately 24 hours on <strong>${formatDate(trialEndDate)}</strong>.</p>
    ${detailsHtml}
    <p class="p">Don't lose momentum on your sales billing, inventory tracking, and reports. Activate your monthly subscription now to maintain full operational access.</p>
  `;

  const html = getSubscriptionEmailTemplate({
    title: `Final Notice: Your Free Trial Expires Tomorrow — ${companyName}`,
    preheader: `Your free trial for ${companyName} ends tomorrow`,
    contentHtml: content,
    ctaText: 'Subscribe Now to Continue Access',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Urgent: 1 Day Left in Your VEXA Invoice Trial (${companyName})`,
    textBody: `Your trial for ${companyName} expires tomorrow on ${formatDate(trialEndDate)}. Subscribe now at ${billingLink} to keep your account active.`,
    htmlBody: html,
    emailType: 'TRIAL_REMINDER_1D',
    referenceId: subscriptionId
  });
};

/**
 * I. Trial Expired Email
 */
const sendTrialExpiredEmail = async ({
  businessId,
  companyName,
  subscriberName,
  subscriberEmail,
  trialEndDate = new Date(),
  subscriptionId
}) => {
  const billingLink = `${env.CLIENT_URL}/settings/subscription`;

  const detailsHtml = `
    <div class="card">
      <div class="detail-row"><span class="label">Company:</span><span class="value">${companyName}</span></div>
      <div class="detail-row"><span class="label">Trial Ended:</span><span class="value">${formatDate(trialEndDate)}</span></div>
      <div class="detail-row"><span class="label">Data Status:</span><span class="value font-bold text-emerald-600">100% Retained & Safe</span></div>
      <div class="detail-row"><span class="label">Plan:</span><span class="value">VEXA Invoice Monthly (₹599/mo)</span></div>
    </div>
  `;

  const content = `
    <h1 class="h1">Your 7-Day Free Trial Has Ended</h1>
    <p class="p">Hello ${subscriberName || companyName},</p>
    <p class="p">The free trial period for <strong>${companyName}</strong> has concluded. Your operational modules have been temporarily locked until a subscription is activated.</p>
    ${detailsHtml}
    <p class="p"><strong>Rest assured: All your data is completely preserved.</strong> None of your invoices, customer profiles, products, or stock transactions have been deleted. To unlock all features immediately, please click below to subscribe.</p>
  `;

  const html = getSubscriptionEmailTemplate({
    title: `Your 7-Day Free Trial Has Ended — ${companyName}`,
    preheader: `Your trial for ${companyName} has concluded. All data is preserved.`,
    contentHtml: content,
    ctaText: 'Subscribe Now — ₹599/month',
    ctaUrl: billingLink
  });

  dispatchSafeEmail({
    businessId,
    toEmail: subscriberEmail,
    subject: `Trial Expired: Subscribe to Continue Using VEXA Invoice (${companyName})`,
    textBody: `Your trial for ${companyName} has ended. Your data is 100% safe. Subscribe at ${billingLink} to unlock full access.`,
    htmlBody: html,
    emailType: 'TRIAL_EXPIRED',
    referenceId: subscriptionId
  });
};

module.exports = {
  formatInr,
  formatDate,
  sendNewSubscriptionSuccessEmail,
  sendSubscriptionCancellationEmail,
  sendRenewalSuccessEmail,
  sendRenewalFailedEmail,
  sendUpcomingRenewalReminderEmail,
  sendTrialStartedEmail,
  sendTrialReminder3DaysEmail,
  sendTrialReminder1DayEmail,
  sendTrialExpiredEmail
};

