const prisma = require('../config/db');
const razorpay = require('../config/razorpay');
const env = require('../config/env');
const {
  sendNewSubscriptionSuccessEmail,
  sendSubscriptionCancellationEmail,
  sendRenewalSuccessEmail,
  sendRenewalFailedEmail
} = require('../services/subscriptionEmail.service');

const PLAN_NAME = 'VEXA Invoice Monthly';

/**
 * Handle Razorpay Webhook Notifications for Subscriptions & One-time Orders
 *
 * Supported official Razorpay events:
 * - payment.captured / order.paid: successful payment for orders or invoices
 * - payment.failed: failed payment attempt
 * - subscription.activated: recurring mandate authorized & subscription active
 * - subscription.charged: recurring cycle charged successfully
 * - subscription.pending: subscription mandate authorization pending
 * - subscription.halted: recurring subscription halted due to repeated failed retries
 * - subscription.cancelled: subscription cancelled
 * - subscription.completed: subscription completed full term
 */
const handlePaymentWebhook = async (req, res, next) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  console.log(`\n======================================================`);
  console.log(`🔔 [RAZORPAY WEBHOOK] Incoming Webhook received at ${new Date().toISOString()}`);

  // 1. Verify Webhook Signature if secret is configured
  const isSignatureValid = razorpay.verifyWebhookSignature(rawBody, signature);

  if (env.RAZORPAY_WEBHOOK_SECRET && !isSignatureValid) {
    console.error(`❌ [WEBHOOK REJECTED] Invalid signature verification.`);
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  const payload = req.body || {};
  const eventType = payload.event || 'UNKNOWN';

  // Extract core entity payloads
  const eventPayload = payload.payload || {};
  const paymentEntity = eventPayload.payment?.entity || {};
  const orderEntity = eventPayload.order?.entity || {};
  const subscriptionEntity = eventPayload.subscription?.entity || {};

  const paymentId = paymentEntity.id;
  const orderId = orderEntity.id || paymentEntity.order_id;
  const subId = subscriptionEntity.id || paymentEntity.subscription_id;

  const eventId = req.headers['x-razorpay-event-id'] 
    || payload.event_id 
    || (paymentId ? `EVT-${paymentId}` : null) 
    || `EVT-${subId || orderId || 'RZP'}-${Date.now()}`;

  console.log(`🔔 [WEBHOOK EVENT] Type: ${eventType} | Event ID: ${eventId}`);

  try {
    // 2. Idempotency Check
    const existingEvent = await prisma.webhook_events.findUnique({
      where: { event_id: String(eventId) }
    });

    if (existingEvent) {
      console.log(`⚠️ [WEBHOOK IDEMPOTENT] Event ${eventId} already processed. Returning 200.`);
      return res.status(200).json({ success: true, idempotent: true, message: 'Event already processed' });
    }

    const now = new Date();

    // 3. Handle One-Time Order / Lifetime Plan Events: payment.captured, order.paid
    if (orderId && (eventType === 'order.paid' || eventType === 'payment.captured') && !subId) {
      console.log(`💎 [LIFETIME RAZORPAY WEBHOOK] Processing order: ${orderId} (${eventType})`);

      const matchingTx = await prisma.payment_transactions.findFirst({
        where: { provider_order_id: orderId },
        include: { businesses: true }
      });

      if (matchingTx) {
        const businessId = matchingTx.business_id;
        const paymentRef = paymentId || `RZP-${Date.now()}`;
        const paidAmount = paymentEntity.amount ? Number(paymentEntity.amount) / 100 : Number(matchingTx.amount);

        await prisma.$transaction(async (tx) => {
          let lic = await tx.platform_licenses.findFirst({
            where: {
              business_id: businessId,
              license_type: 'ONE_TIME_LICENSE'
            }
          });

          if (!lic) {
            lic = await tx.platform_licenses.create({
              data: {
                license_key: `LIC-LIFE-${matchingTx.company_id}-${Date.now().toString(36).toUpperCase()}`,
                company_id: matchingTx.company_id,
                business_id: businessId,
                license_type: 'ONE_TIME_LICENSE',
                status: 'ACTIVE',
                duration_type: 'LIFETIME',
                duration_days: null,
                activated_at: now,
                expiry_date: null
              }
            });
          } else {
            await tx.platform_licenses.update({
              where: { id: lic.id },
              data: { status: 'ACTIVE', activated_at: lic.activated_at || now, expiry_date: null }
            });
          }

          // Authoritative Lifetime status update
          await tx.businesses.update({
            where: { id: businessId },
            data: {
              self_shopping_status: 'LIFETIME_ACTIVE',
              is_active: true
            }
          });

          // Update transaction
          await tx.payment_transactions.update({
            where: { id: matchingTx.id },
            data: {
              status: 'VERIFIED',
              provider: 'RAZORPAY',
              provider_payment_id: paymentRef,
              license_id: lic.id,
              amount: paidAmount,
              verified_at: now,
              verified_by: 'Razorpay Webhook (order.paid)',
              notes: `Lifetime access verified via Razorpay payment ID: ${paymentRef}`
            }
          });

          // Record receipt
          await tx.payment_receipts.create({
            data: {
              company_id: matchingTx.company_id,
              business_id: businessId,
              transaction_id: matchingTx.id,
              receipt_number: `RCP-LIFE-${Date.now().toString().slice(-8)}`,
              amount: paidAmount,
              currency: matchingTx.currency || 'INR',
              customer_name: matchingTx.businesses.business_name || 'Business Owner',
              payment_method: paymentEntity.method ? String(paymentEntity.method).toUpperCase() : 'ONLINE',
              provider: 'RAZORPAY',
              provider_reference: paymentRef,
              status: 'PAID',
              issued_at: now,
              pdf_url: null,
              notes: 'Official Lifetime Plan Invoice (Core SaaS + Online Store)'
            }
          });
        });

        console.log(`✅ [LIFETIME ACTIVATED] Company ${matchingTx.company_id} granted LIFETIME_ACTIVE via Razorpay.`);
      }
    }

    // 4. Handle Recurring Monthly Subscription Events
    if (subId) {
      console.log(`🔄 [SUBSCRIPTION RAZORPAY WEBHOOK] Processing sub: ${subId} (${eventType})`);

      const matchingSub = await prisma.platform_subscriptions.findFirst({
        where: { provider_subscription_id: subId },
        include: { businesses: true }
      });

      if (matchingSub) {
        const businessId = matchingSub.business_id;

        // 4A. subscription.activated or subscription.charged
        if (eventType === 'subscription.activated' || eventType === 'subscription.charged') {
          const currentPeriodStart = subscriptionEntity.current_start 
            ? new Date(subscriptionEntity.current_start * 1000) 
            : (matchingSub.current_period_start || now);
          const currentPeriodEnd = subscriptionEntity.current_end 
            ? new Date(subscriptionEntity.current_end * 1000) 
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const nextBilling = subscriptionEntity.charge_at 
            ? new Date(subscriptionEntity.charge_at * 1000) 
            : currentPeriodEnd;

          const paidAmount = paymentEntity.amount ? Number(paymentEntity.amount) / 100 : Number(matchingSub.amount);
          const paymentRef = paymentId || `RZP-SUB-${Date.now()}`;

          await prisma.$transaction(async (tx) => {
            await tx.platform_subscriptions.update({
              where: { id: matchingSub.id },
              data: {
                status: 'ACTIVE',
                mandate_status: 'ACTIVE',
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                next_billing_date: nextBilling,
                last_successful_payment: now,
                auto_renew: true
              }
            });

            await tx.businesses.update({
              where: { id: businessId },
              data: {
                subscription_status: 'ACTIVE',
                is_active: true
              }
            });

            // Prevent duplicate transaction entry
            const existingTx = await tx.payment_transactions.findFirst({
              where: {
                provider_payment_id: paymentRef,
                status: 'VERIFIED'
              }
            });

            if (!existingTx) {
              const isFirstActivation = eventType === 'subscription.activated' || matchingSub.status !== 'ACTIVE';
              const createdTx = await tx.payment_transactions.create({
                data: {
                  company_id: matchingSub.company_id,
                  business_id: businessId,
                  subscription_id: matchingSub.id,
                  payment_type: 'MONTHLY_SUBSCRIPTION',
                  payment_method: paymentEntity.method ? String(paymentEntity.method).toUpperCase() : 'ONLINE',
                  amount: paidAmount,
                  currency: 'INR',
                  status: 'VERIFIED',
                  provider: 'RAZORPAY',
                  provider_payment_id: paymentRef,
                  provider_subscription_id: subId,
                  reference_number: `RZP-${paymentRef}`,
                  transaction_type: isFirstActivation ? 'NEW_SUBSCRIPTION' : 'SUBSCRIPTION_RENEWAL',
                  verified_at: now,
                  verified_by: `Razorpay Webhook (${eventType})`,
                  notes: isFirstActivation ? 'Monthly subscription authorized and activated' : 'Monthly recurring renewal payment'
                }
              });

              await tx.payment_receipts.create({
                data: {
                  company_id: matchingSub.company_id,
                  business_id: businessId,
                  transaction_id: createdTx.id,
                  receipt_number: `RCP-SUB-${Date.now().toString().slice(-8)}`,
                  amount: paidAmount,
                  currency: 'INR',
                  customer_name: matchingSub.businesses.business_name || 'Business Owner',
                  payment_method: paymentEntity.method ? String(paymentEntity.method).toUpperCase() : 'ONLINE',
                  provider: 'RAZORPAY',
                  provider_reference: paymentRef,
                  status: 'PAID',
                  issued_at: now,
                  notes: 'Official Monthly Subscription Payment Receipt'
                }
              });

              const owner = await tx.users.findFirst({ where: { business_id: businessId, role: 'ADMIN' } });
              const emailPayload = {
                businessId,
                companyName: matchingSub.businesses.business_name,
                subscriberName: owner?.name || 'Business Owner',
                subscriberEmail: owner?.email || matchingSub.businesses.email,
                planName: PLAN_NAME,
                amount: paidAmount,
                paymentReference: paymentRef,
                startDate: currentPeriodStart,
                nextRenewalDate: nextBilling,
                mandateStatus: 'ACTIVE',
                subscriptionId: matchingSub.id
              };

              if (isFirstActivation) {
                sendNewSubscriptionSuccessEmail(emailPayload);
              } else {
                sendRenewalSuccessEmail(emailPayload);
              }
            }
          });

          console.log(`✅ [SUBSCRIPTION ACTIVE] Company ${matchingSub.company_id} updated to ACTIVE.`);
        }

        // 4B. subscription.halted / payment.failed: recurring payment failure
        else if (eventType === 'subscription.halted' || (eventType === 'payment.failed' && subId)) {
          const failureReason = paymentEntity.error_description || 'Card/UPI charge attempt declined';
          await prisma.$transaction(async (tx) => {
            await tx.platform_subscriptions.update({
              where: { id: matchingSub.id },
              data: {
                status: 'PAST_DUE',
                last_failed_payment: now
              }
            });

            await tx.businesses.update({
              where: { id: businessId },
              data: { subscription_status: 'PAST_DUE' }
            });

            await tx.payment_transactions.create({
              data: {
                company_id: matchingSub.company_id,
                business_id: businessId,
                subscription_id: matchingSub.id,
                payment_type: 'MONTHLY_SUBSCRIPTION',
                payment_method: 'ONLINE',
                amount: Number(matchingSub.amount),
                currency: 'INR',
                status: 'FAILED',
                provider: 'RAZORPAY',
                provider_payment_id: paymentId || null,
                provider_subscription_id: subId,
                reference_number: `FAIL-${Date.now()}`,
                transaction_type: 'RECURRING_CHARGE_FAILED',
                notes: `Recurring payment declined: ${failureReason}`
              }
            });
          });

          const owner = await prisma.users.findFirst({ where: { business_id: businessId, role: 'ADMIN' } });
          sendRenewalFailedEmail({
            businessId,
            companyName: matchingSub.businesses.business_name,
            subscriberName: owner?.name || 'Business Owner',
            subscriberEmail: owner?.email || matchingSub.businesses.email,
            planName: PLAN_NAME,
            amount: Number(matchingSub.amount),
            failureReason,
            subscriptionId: matchingSub.id
          });
        }

        // 4C. subscription.cancelled
        else if (eventType === 'subscription.cancelled') {
          await prisma.$transaction(async (tx) => {
            await tx.platform_subscriptions.update({
              where: { id: matchingSub.id },
              data: {
                mandate_status: 'CANCELLED',
                auto_renew: false,
                cancelled_at: now
              }
            });
          });

          const owner = await prisma.users.findFirst({ where: { business_id: businessId, role: 'ADMIN' } });
          sendSubscriptionCancellationEmail({
            businessId,
            companyName: matchingSub.businesses.business_name,
            subscriberName: owner?.name || 'Business Owner',
            subscriberEmail: owner?.email || matchingSub.businesses.email,
            planName: PLAN_NAME,
            effectiveDate: matchingSub.current_period_end || now,
            subscriptionId: matchingSub.id
          });
        }
      }
    }

    // 5. Record Webhook Event for idempotency deduplication
    await prisma.webhook_events.create({
      data: {
        event_id: String(eventId),
        event_type: String(eventType),
        provider: 'RAZORPAY',
        payload: req.body,
        status: 'PROCESSED',
        processed_at: now
      }
    }).catch((e) => console.warn('Could not record webhook event deduplication record:', e.message));

    return res.status(200).json({ success: true, message: 'Razorpay webhook processed successfully' });
  } catch (error) {
    console.error('❌ [RAZORPAY WEBHOOK ERROR]:', error);
    return res.status(500).json({ success: false, message: 'Internal server error processing webhook' });
  }
};

module.exports = {
  handlePaymentWebhook
};
