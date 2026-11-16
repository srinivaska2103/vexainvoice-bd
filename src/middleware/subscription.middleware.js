const prisma = require('../config/db');
const { sendError } = require('../utils/response.util');
const { evaluateSubscriptionAccess } = require('../utils/subscriptionPolicy');

/**
 * Middleware to enforce active company subscription on restricted business API routes.
 *
 * Requirements:
 * - Allow access to subscription, auth, and profile endpoints.
 * - For companies without active subscription, block access with 402 Payment Required.
 * - Distinguish grace periods and provide detailed status without terminating data access.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.user || !req.user.business_id) {
      return sendError(res, 'Authentication required to verify subscription', 401);
    }

    const businessId = req.user.business_id;

    // Fetch company and its effective platform subscription
    // If a company has an active or trialing subscription, an uncompleted 'PENDING'
    // checkout attempt must NOT invalidate their active trial or ongoing paid access.
    const company = await prisma.businesses.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        company_id: true,
        business_name: true,
        subscription_status: true,
        license_status: true,
        is_active: true
      }
    });

    if (!company) {
      return sendError(res, 'Company account not found', 404);
    }

    let effectiveSubscription = await prisma.platform_subscriptions.findFirst({
      where: {
        business_id: businessId,
        status: { in: ['ACTIVE', 'TRIALING'] }
      },
      orderBy: { created_at: 'desc' },
      include: {
        subscription_plans: true
      }
    });

    if (!effectiveSubscription) {
      effectiveSubscription = await prisma.platform_subscriptions.findFirst({
        where: { business_id: businessId },
        orderBy: { created_at: 'desc' },
        include: {
          subscription_plans: true
        }
      });
    }

    const evaluation = evaluateSubscriptionAccess(effectiveSubscription, company);

    // Attach evaluated subscription state to request for controllers if needed
    req.subscriptionStatus = evaluation;

    if (!evaluation.allowed) {
      return res.status(402).json({
        success: false,
        error_code: 'SUBSCRIPTION_REQUIRED',
        message: evaluation.reason || 'Active subscription required to access this resource.',
        data: {
          subscription_status: evaluation.status,
          plan: 'VEXA Invoice Monthly',
          price: 599.00,
          currency: 'INR',
          days_remaining: evaluation.daysRemaining || 0,
          grace_period_active: evaluation.gracePeriodActive || false
        }
      });
    }

    next();
  } catch (error) {
    console.error('Subscription verification middleware error:', error);
    next(error);
  }
};

module.exports = { requireActiveSubscription };
