const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const env = require('../config/env');
const { logPlatformAudit } = require('./platformAudit.service');

const sanitizeEmail = (email) => {
  return (email || '')
    .trim()
    .toLowerCase()
    .replace(/[\\/]/g, '')
    .trim();
};

/**
 * Super Admin Authentication
 */
const { sendOtpEmail } = require('../utils/email.util');

const ALLOWED_SUPER_ADMIN_EMAIL = 'vexatech.connect@gmail.com';
const superAdminOtpStore = new Map();

/**
 * Super Admin Login - Step 1: Validate email & password, ensure allowed email, dispatch OTP
 */
const sendSuperAdminOtp = async (email, password) => {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }

  // Strictly enforce platform Super Admin email
  if (cleanEmail !== ALLOWED_SUPER_ADMIN_EMAIL) {
    const error = new Error('Access Denied: Only authorized platform Super Admin email is permitted.');
    error.statusCode = 403;
    throw error;
  }

  const admin = await prisma.admin_users.findFirst({
    where: {
      email: { equals: cleanEmail, mode: 'insensitive' }
    }
  });

  if (!admin || !admin.is_active) {
    const error = new Error('Invalid Super Admin credentials');
    error.statusCode = 401;
    throw error;
  }

  // If password provided, verify it
  if (password) {
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Invalid Super Admin credentials');
      error.statusCode = 401;
      throw error;
    }
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + (env.OTP_EXPIRY_MINUTES || 5) * 60 * 1000;

  superAdminOtpStore.set(cleanEmail, {
    otp,
    expiresAt,
    adminId: admin.id,
    attempts: 0
  });

  console.log(`\n======================================================`);
  console.log(`🛡️  [SUPER ADMIN OTP DISPATCH] Email: ${cleanEmail} | Code: ${otp}`);
  console.log(`======================================================\n`);

  // Dispatch email in background with timeout protection so HTTP response returns immediately (<300ms)
  sendOtpEmail(cleanEmail, otp, admin.name || 'Super Admin').catch(err => {
    console.error('Background Super Admin OTP email error:', err.message);
  });

  return {
    email: cleanEmail,
    expiresAt,
    message: 'Verification OTP has been sent to vexatech.connect@gmail.com'
  };
};

/**
 * Super Admin Login - Step 2: Verify OTP and issue JWT session token
 */
const verifySuperAdminOtp = async (email, otp) => {
  const cleanEmail = sanitizeEmail(email);
  const cleanOtp = (otp || '').toString().trim().replace(/\D/g, '');

  if (!cleanEmail || !cleanOtp) {
    const error = new Error('Email and OTP code are required');
    error.statusCode = 400;
    throw error;
  }

  if (cleanEmail !== ALLOWED_SUPER_ADMIN_EMAIL) {
    const error = new Error('Access Denied: Only authorized platform Super Admin email is permitted.');
    error.statusCode = 403;
    throw error;
  }

  const stored = superAdminOtpStore.get(cleanEmail);
  if (!stored) {
    const error = new Error('OTP expired or not requested. Please request a new OTP.');
    error.statusCode = 400;
    throw error;
  }

  if (Date.now() > stored.expiresAt) {
    superAdminOtpStore.delete(cleanEmail);
    const error = new Error('OTP has expired. Please request a new verification code.');
    error.statusCode = 400;
    throw error;
  }

  if (stored.attempts >= 5) {
    superAdminOtpStore.delete(cleanEmail);
    const error = new Error('Too many invalid attempts. Please request a new OTP.');
    error.statusCode = 429;
    throw error;
  }

  if (stored.otp !== cleanOtp) {
    stored.attempts += 1;
    const error = new Error('Invalid OTP code. Please enter the correct 6-digit code.');
    error.statusCode = 400;
    throw error;
  }

  // Clear OTP once verified
  superAdminOtpStore.delete(cleanEmail);

  const admin = await prisma.admin_users.findUnique({
    where: { id: stored.adminId }
  });

  if (!admin || !admin.is_active) {
    const error = new Error('Super Admin account is inactive or revoked');
    error.statusCode = 403;
    throw error;
  }

  // Update last login
  await prisma.admin_users.update({
    where: { id: admin.id },
    data: { last_login_at: new Date() }
  });

  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      is_super_admin: true
    },
    env.JWT_SECRET,
    { expiresIn: '24h', algorithm: env.JWT_ALGORITHM || 'HS256' }
  );

  await logPlatformAudit({
    admin_id: admin.id,
    admin_email: admin.email,
    action: 'OTP_LOGIN',
    target_type: 'SUPER_ADMIN',
    target_id: admin.id,
    details: { email: admin.email, verified_at: new Date().toISOString() }
  });

  return {
    token,
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      is_super_admin: true,
      last_login_at: new Date()
    }
  };
};

/**
 * Platform Dashboard Metrics Overview
 */
const getDashboardMetrics = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Company counts
  const totalCompanies = await prisma.businesses.count();
  const activeCompanies = await prisma.businesses.count({ where: { is_active: true } });
  const suspendedCompanies = await prisma.businesses.count({ where: { is_active: false } });

  // 2. User counts across the entire platform
  const totalUsers = await prisma.users.count();
  const adminUsersCount = await prisma.users.count({ where: { role: 'ADMIN' } });
  const employeeUsersCount = await prisma.users.count({ where: { role: { not: 'ADMIN' } } });

  // 3. Platform subscriptions breakdown
  const subStatusCounts = await prisma.platform_subscriptions.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  const statusMap = {};
  subStatusCounts.forEach(s => {
    statusMap[s.status] = s._count.id;
  });

  const trialingSubs = statusMap['TRIALING'] || 0;
  const activePaidSubs = statusMap['ACTIVE'] || 0;
  const pendingSubs = (statusMap['PENDING'] || 0) + (statusMap['PAYMENT_PENDING'] || 0);
  const pastDueSubs = (statusMap['PAST_DUE'] || 0) + (statusMap['PAYMENT_FAILED'] || 0);
  const cancelledSubs = statusMap['CANCELLED'] || 0;
  const expiredSubs = (statusMap['EXPIRED'] || 0) + (statusMap['SUSPENDED'] || 0);

  // 4. Verified Revenue Calculations
  // Verified transactions: status = 'VERIFIED' or 'CLEARED'
  const verifiedPayments = await prisma.payment_transactions.aggregate({
    where: {
      status: { in: ['VERIFIED', 'CLEARED'] }
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const refundedPayments = await prisma.payment_transactions.aggregate({
    where: {
      status: 'REFUNDED'
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const totalGrossRevenue = Number(verifiedPayments._sum.amount || 0);
  const totalRefunded = Number(refundedPayments._sum.amount || 0);
  const totalNetRevenue = Math.max(0, totalGrossRevenue - totalRefunded);

  // Month-to-date revenue
  const mtdVerifiedPayments = await prisma.payment_transactions.aggregate({
    where: {
      status: { in: ['VERIFIED', 'CLEARED'] },
      created_at: { gte: startOfMonth }
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const mtdRefundedPayments = await prisma.payment_transactions.aggregate({
    where: {
      status: 'REFUNDED',
      created_at: { gte: startOfMonth }
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const mtdGross = Number(mtdVerifiedPayments._sum.amount || 0);
  const mtdRefund = Number(mtdRefundedPayments._sum.amount || 0);
  const mtdNetRevenue = Math.max(0, mtdGross - mtdRefund);

  // 4B. Verified Lifetime Add-on Revenue (₹59,999 One-Time)
  const lifetimeVerifiedPayments = await prisma.payment_transactions.aggregate({
    where: {
      payment_type: 'ONE_TIME_LICENSE',
      status: { in: ['VERIFIED', 'CLEARED'] }
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const lifetimeRefundedPayments = await prisma.payment_transactions.aggregate({
    where: {
      payment_type: 'ONE_TIME_LICENSE',
      status: 'REFUNDED'
    },
    _sum: { amount: true },
    _count: { id: true }
  });

  const lifetimeGrossRevenue = Number(lifetimeVerifiedPayments._sum.amount || 0);
  const lifetimeRefunded = Number(lifetimeRefundedPayments._sum.amount || 0);
  const lifetimeNetRevenue = Math.max(0, lifetimeGrossRevenue - lifetimeRefunded);

  // Lifetime Purchases Count & Pending / Failed
  const lifetimePurchasesCount = await prisma.platform_licenses.count({
    where: { license_type: 'ONE_TIME_LICENSE', status: 'ACTIVE' }
  });
  const lifetimePendingCount = await prisma.businesses.count({
    where: { self_shopping_status: 'PAYMENT_PENDING' }
  });
  const lifetimeFailedCount = await prisma.businesses.count({
    where: { self_shopping_status: 'PAYMENT_FAILED' }
  });

  // Self-Shopping 7-Day Trial Companies
  const selfShoppingTrialingCount = await prisma.businesses.count({
    where: {
      self_shopping_status: 'TRIALING',
      self_shopping_trial_end_at: { gte: now }
    }
  });
  const selfShoppingExpiredCount = await prisma.businesses.count({
    where: {
      OR: [
        { self_shopping_status: 'EXPIRED' },
        { self_shopping_status: 'TRIALING', self_shopping_trial_end_at: { lt: now } }
      ]
    }
  });

  // 5. Monthly Recurring Revenue (MRR)
  // MRR = Sum of normalized monthly amounts for all valid ACTIVE recurring subscriptions with auto_renew=true and cancel_at_period_end=false
  const activeRecurringSubs = await prisma.platform_subscriptions.findMany({
    where: {
      status: 'ACTIVE',
      auto_renew: true,
      cancel_at_period_end: false
    },
    select: {
      amount: true,
      billing_interval: true
    }
  });

  const calculatedMRR = activeRecurringSubs.reduce((acc, sub) => {
    const amt = Number(sub.amount || 0);
    if (sub.billing_interval === 'MONTHLY') return acc + amt;
    if (sub.billing_interval === 'YEARLY') return acc + (amt / 12);
    return acc + amt;
  }, 0);

  // 6. Upcoming Renewals and Trials Expiring Soon (Next 7 days)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const trialsExpiringSoon = await prisma.platform_subscriptions.findMany({
    where: {
      status: 'TRIALING',
      trial_end_at: {
        gte: now,
        lte: sevenDaysFromNow
      }
    },
    include: {
      businesses: {
        select: { id: true, business_name: true, company_id: true, owner_name: true, email: true, phone: true }
      }
    },
    take: 10,
    orderBy: { trial_end_at: 'asc' }
  });

  const renewalsExpiringSoon = await prisma.platform_subscriptions.findMany({
    where: {
      status: 'ACTIVE',
      current_period_end: {
        gte: now,
        lte: sevenDaysFromNow
      }
    },
    include: {
      businesses: {
        select: { id: true, business_name: true, company_id: true, owner_name: true, email: true, phone: true }
      }
    },
    take: 10,
    orderBy: { current_period_end: 'asc' }
  });

  // Recent 5 registered companies
  const recentCompanies = await prisma.businesses.findMany({
    take: 5,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      company_id: true,
      business_name: true,
      owner_name: true,
      email: true,
      phone: true,
      subscription_status: true,
      is_active: true,
      created_at: true
    }
  });

  return {
    companies: {
      total: totalCompanies,
      active: activeCompanies,
      suspended: suspendedCompanies
    },
    users: {
      total: totalUsers,
      admins: adminUsersCount,
      employees: employeeUsersCount
    },
    subscriptions: {
      trialing: trialingSubs,
      active_paid: activePaidSubs,
      pending: pendingSubs,
      past_due: pastDueSubs,
      cancelled: cancelledSubs,
      expired: expiredSubs
    },
    revenue: {
      total_gross: totalGrossRevenue,
      total_refunded: totalRefunded,
      total_net: totalNetRevenue,
      mtd_gross: mtdGross,
      mtd_refunded: mtdRefund,
      mtd_net: mtdNetRevenue,
      mrr: calculatedMRR,
      verified_transactions_count: verifiedPayments._count.id,
      lifetime_gross: lifetimeGrossRevenue,
      lifetime_refunded: lifetimeRefunded,
      lifetime_net: lifetimeNetRevenue
    },
    lifetime_addon: {
      purchases_count: lifetimePurchasesCount,
      pending_count: lifetimePendingCount,
      failed_count: lifetimeFailedCount,
      verified_revenue: lifetimeNetRevenue
    },
    self_shopping_trial: {
      active_trialing_companies: selfShoppingTrialingCount,
      expired_companies: selfShoppingExpiredCount
    },
    expiring_soon: {
      trials: trialsExpiringSoon,
      renewals: renewalsExpiringSoon
    },
    recent_companies: recentCompanies
  };
};

/**
 * Search and Filter Companies
 */
const getCompanies = async ({ page = 1, limit = 10, search = '', status = '', subscription_status = '' }) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { business_name: { contains: q, mode: 'insensitive' } },
      { company_id: { contains: q, mode: 'insensitive' } },
      { owner_name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } }
    ];
  }

  if (status === 'ACTIVE') {
    where.is_active = true;
  } else if (status === 'SUSPENDED') {
    where.is_active = false;
  }

  if (subscription_status && subscription_status !== 'ALL') {
    where.subscription_status = subscription_status;
  }

  const [total, items] = await Promise.all([
    prisma.businesses.count({ where }),
    prisma.businesses.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        company_id: true,
        business_name: true,
        business_type: true,
        owner_name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        gst_number: true,
        subscription_status: true,
        license_status: true,
        trial_start_at: true,
        trial_end_at: true,
        has_used_trial: true,
        is_active: true,
        created_at: true,
        _count: {
          select: {
            users: true,
            sales: true
          }
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            is_active: true,
            created_at: true,
            custom_roles: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            }
          },
          orderBy: [
            { role: 'asc' }, // 'ADMIN' comes first alphabetically among uppercase roles
            { created_at: 'asc' }
          ]
        },
        platform_subscriptions: {
          take: 1,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            company_id: true,
            plan_id: true,
            status: true,
            amount: true,
            billing_interval: true,
            mandate_status: true,
            current_period_start: true,
            current_period_end: true,
            trial_start_at: true,
            trial_end_at: true,
            next_billing_date: true,
            auto_renew: true,
            cancel_at_period_end: true,
            provider_subscription_id: true,
            subscription_plans: {
              select: {
                id: true,
                plan_name: true,
                price: true,
                billing_type: true
              }
            },
            payment_transactions: {
              take: 5,
              orderBy: { created_at: 'desc' },
              select: {
                id: true,
                amount: true,
                status: true,
                reference_number: true,
                provider: true,
                created_at: true
              }
            }
          }
        }
      }
    })
  ]);

  return {
    items: items.map(c => {
      const allUsers = c.users || [];
      const adminUsers = allUsers.filter(u => u.role === 'ADMIN');
      const employeeUsers = allUsers.filter(u => u.role !== 'ADMIN');
      // If multiple ADMINs exist, prefer one matching business owner_name / email, else first
      const primaryAdmin = adminUsers.find(u => 
        (c.email && u.email && u.email.toLowerCase() === c.email.toLowerCase()) ||
        (c.owner_name && u.name && u.name.toLowerCase() === c.owner_name.toLowerCase())
      ) || adminUsers[0] || null;

      return {
        ...c,
        user_count: c._count.users || allUsers.length,
        admin_count: adminUsers.length,
        employee_count: employeeUsers.length,
        sales_count: c._count.sales || 0,
        admin_user: primaryAdmin,
        admin_users: adminUsers,
        employees: employeeUsers,
        current_subscription: c.platform_subscriptions[0] || null
      };
    }),
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l)
    }
  };
};

/**
 * Company Details View
 */
const getCompanyById = async (id) => {
  const company = await prisma.businesses.findFirst({
    where: {
      OR: [{ id: id }, { company_id: id }]
    },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          is_active: true,
          created_at: true
        },
        orderBy: { created_at: 'desc' }
      },
      platform_subscriptions: {
        orderBy: { created_at: 'desc' },
        include: {
          subscription_plans: true
        }
      },
      payment_transactions: {
        orderBy: { created_at: 'desc' },
        take: 20
      },
      platform_licenses: {
        orderBy: { created_at: 'desc' }
      },
      _count: {
        select: {
          sales: true,
          purchases: true,
          products: true,
          customers: true
        }
      }
    }
  });

  if (!company) {
    const error = new Error('Company not found');
    error.statusCode = 404;
    throw error;
  }

  return company;
};

/**
 * Suspend or Reactivate Company (requires admin authorization, confirmation & audit log)
 */
const toggleCompanyStatus = async (id, isActive, reason, adminUser) => {
  const company = await prisma.businesses.findFirst({
    where: { OR: [{ id }, { company_id: id }] }
  });

  if (!company) {
    const error = new Error('Company not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.businesses.update({
    where: { id: company.id },
    data: {
      is_active: isActive,
      subscription_status: isActive ? company.subscription_status : 'SUSPENDED'
    }
  });

  await logPlatformAudit({
    admin_id: adminUser.id,
    admin_email: adminUser.email,
    action: isActive ? 'REACTIVATE_COMPANY' : 'SUSPEND_COMPANY',
    target_type: 'COMPANY',
    target_id: company.id,
    company_id: company.id,
    details: {
      business_name: company.business_name,
      previous_status: company.is_active,
      new_status: isActive,
      reason: reason || 'Administrative action'
    }
  });

  return updated;
};

/**
 * Search and Filter Users Across Platform
 */
const getUsers = async ({ page = 1, limit = 10, search = '', role = '', company_id = '', status = '' }) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } }
    ];
  }

  if (role && role !== 'ALL') {
    where.role = role;
  }

  if (company_id && company_id !== 'ALL') {
    where.businesses = {
      OR: [
        { id: company_id },
        { company_id: company_id }
      ]
    };
  }

  if (status === 'ACTIVE') {
    where.is_active = true;
  } else if (status === 'INACTIVE') {
    where.is_active = false;
  }

  const [total, items] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        businesses: {
          select: {
            id: true,
            company_id: true,
            business_name: true,
            is_active: true,
            subscription_status: true
          }
        },
        custom_roles: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })
  ]);

  return {
    items,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l)
    }
  };
};

/**
 * Toggle User Active Status
 */
const toggleUserStatus = async (userId, isActive, reason, adminUser) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { businesses: true }
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.users.update({
    where: { id: userId },
    data: { is_active: isActive }
  });

  await logPlatformAudit({
    admin_id: adminUser.id,
    admin_email: adminUser.email,
    action: isActive ? 'REACTIVATE_USER' : 'DEACTIVATE_USER',
    target_type: 'USER',
    target_id: user.id,
    company_id: user.business_id,
    details: {
      user_name: user.name,
      user_email: user.email,
      company_name: user.businesses?.business_name,
      reason: reason || 'Administrative action'
    }
  });

  return updated;
};

/**
 * Search and Filter Platform Subscriptions
 */
const getSubscriptions = async ({ page = 1, limit = 10, search = '', status = '', plan_id = '' }) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { company_id: { contains: q, mode: 'insensitive' } },
      { provider_subscription_id: { contains: q, mode: 'insensitive' } },
      { businesses: { business_name: { contains: q, mode: 'insensitive' } } },
      { businesses: { owner_name: { contains: q, mode: 'insensitive' } } },
      { businesses: { email: { contains: q, mode: 'insensitive' } } }
    ];
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (plan_id && plan_id !== 'ALL') {
    where.plan_id = plan_id;
  }

  const [total, items] = await Promise.all([
    prisma.platform_subscriptions.count({ where }),
    prisma.platform_subscriptions.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: 'desc' },
      include: {
        businesses: {
          select: {
            id: true,
            company_id: true,
            business_name: true,
            owner_name: true,
            email: true,
            phone: true,
            is_active: true,
            self_shopping_status: true,
            self_shopping_trial_start_at: true,
            self_shopping_trial_end_at: true,
            has_used_self_shopping_trial: true,
            platform_licenses: {
              where: { license_type: 'ONE_TIME_LICENSE' },
              select: { id: true, license_key: true, status: true, activated_at: true }
            },
            users: {
              where: { role: 'ADMIN' },
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                is_active: true
              },
              take: 5
            }
          }
        },
        subscription_plans: {
          select: {
            id: true,
            plan_name: true,
            price: true,
            billing_type: true
          }
        },
        payment_transactions: {
          take: 3,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            created_at: true,
            reference_number: true
          }
        }
      }
    })
  ]);

  return {
    items: items.map(sub => {
      const adminUsers = sub.businesses?.users || [];
      const primaryAdmin = adminUsers.find(u => 
        (sub.businesses?.email && u.email && u.email.toLowerCase() === sub.businesses.email.toLowerCase()) ||
        (sub.businesses?.owner_name && u.name && u.name.toLowerCase() === sub.businesses.owner_name.toLowerCase())
      ) || adminUsers[0] || null;

      return {
        ...sub,
        admin_user: primaryAdmin,
        admin_id: primaryAdmin?.id || null
      };
    }),
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l)
    }
  };
};

/**
 * Subscription Details View
 */
const getSubscriptionById = async (id) => {
  const sub = await prisma.platform_subscriptions.findUnique({
    where: { id },
    include: {
      businesses: true,
      subscription_plans: true,
      payment_transactions: {
        orderBy: { created_at: 'desc' }
      }
    }
  });

  if (!sub) {
    const error = new Error('Subscription not found');
    error.statusCode = 404;
    throw error;
  }

  return sub;
};

/**
 * Search and Filter Payments & Transactions
 */
const getPayments = async ({ page = 1, limit = 10, search = '', status = '', payment_type = '', transaction_type = '' }) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { reference_number: { contains: q, mode: 'insensitive' } },
      { provider_subscription_id: { contains: q, mode: 'insensitive' } },
      { provider_payment_id: { contains: q, mode: 'insensitive' } },
      { company_id: { contains: q, mode: 'insensitive' } },
      { businesses: { business_name: { contains: q, mode: 'insensitive' } } }
    ];
  }

  if (status && status !== 'ALL') {
    where.status = status;
  }

  if (payment_type && payment_type !== 'ALL') {
    where.payment_type = payment_type;
  }

  if (transaction_type && transaction_type !== 'ALL') {
    where.transaction_type = transaction_type;
  }

  const [total, items, stats] = await Promise.all([
    prisma.payment_transactions.count({ where }),
    prisma.payment_transactions.findMany({
      where,
      skip,
      take: l,
      orderBy: { created_at: 'desc' },
      include: {
        businesses: {
          select: {
            id: true,
            company_id: true,
            business_name: true,
            email: true,
            phone: true
          }
        },
        platform_subscriptions: {
          select: {
            id: true,
            status: true,
            mandate_status: true,
            provider_subscription_id: true,
            current_period_start: true,
            current_period_end: true,
            next_billing_date: true,
            subscription_plans: {
              select: {
                id: true,
                plan_name: true,
                price: true,
                billing_cycle: true
              }
            }
          }
        }
      }
    }),
    prisma.payment_transactions.aggregate({
      where: {
        status: { in: ['VERIFIED', 'CLEARED'] },
        // Cancellation records (amount 0) and refunds should not artificially inflate verified total
        transaction_type: { notIn: ['CANCELLATION', 'REFUND'] }
      },
      _sum: { amount: true }
    })
  ]);

  return {
    items,
    verified_total_amount: stats._sum.amount || 0,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l)
    }
  };
};

/**
 * Analytics and Historical Time-Series
 */
const getAnalytics = async (days = 30) => {
  const dayCount = Math.min(180, Math.max(7, parseInt(days, 10) || 30));
  const cutoffDate = new Date(Date.now() - dayCount * 24 * 60 * 60 * 1000);

  // 1. Fetch businesses created since cutoff
  const businesses = await prisma.businesses.findMany({
    where: { created_at: { gte: cutoffDate } },
    select: { id: true, created_at: true, subscription_status: true }
  });

  // 2. Fetch users created since cutoff
  const users = await prisma.users.findMany({
    where: { created_at: { gte: cutoffDate } },
    select: { id: true, created_at: true, role: true }
  });

  // 3. Fetch payment transactions created since cutoff
  const payments = await prisma.payment_transactions.findMany({
    where: { created_at: { gte: cutoffDate }, status: { in: ['VERIFIED', 'CLEARED'] } },
    select: { id: true, amount: true, created_at: true }
  });

  // 4. Fetch subscriptions lifecycle events since cutoff
  const subscriptions = await prisma.platform_subscriptions.findMany({
    where: { created_at: { gte: cutoffDate } },
    select: { id: true, created_at: true, status: true, amount: true }
  });

  // Group by date (YYYY-MM-DD)
  const dateMap = {};
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    dateMap[dateStr] = {
      date: dateStr,
      companies: 0,
      users: 0,
      revenue: 0,
      subscriptions: 0
    };
  }

  businesses.forEach(b => {
    if (b.created_at) {
      const d = b.created_at.toISOString().split('T')[0];
      if (dateMap[d]) dateMap[d].companies += 1;
    }
  });

  users.forEach(u => {
    if (u.created_at) {
      const d = u.created_at.toISOString().split('T')[0];
      if (dateMap[d]) dateMap[d].users += 1;
    }
  });

  payments.forEach(p => {
    if (p.created_at) {
      const d = p.created_at.toISOString().split('T')[0];
      if (dateMap[d]) dateMap[d].revenue += Number(p.amount || 0);
    }
  });

  subscriptions.forEach(s => {
    if (s.created_at) {
      const d = s.created_at.toISOString().split('T')[0];
      if (dateMap[d]) dateMap[d].subscriptions += 1;
    }
  });

  // Calculate Conversion Rate: Total active subscriptions vs Total trialed companies
  const totalTrialedEver = await prisma.businesses.count({
    where: { has_used_trial: true }
  });
  const totalPaidEver = await prisma.platform_subscriptions.count({
    where: { status: 'ACTIVE' }
  });

  const conversionRate = totalTrialedEver > 0 ? ((totalPaidEver / totalTrialedEver) * 100).toFixed(1) : 0;

  return {
    time_series: Object.values(dateMap),
    summary: {
      days_analyzed: dayCount,
      total_new_companies: businesses.length,
      total_new_users: users.length,
      total_revenue_period: payments.reduce((acc, p) => acc + Number(p.amount || 0), 0),
      conversion_rate_percentage: Number(conversionRate)
    }
  };
};

/**
 * Notifications and Audit Logs
 */
const getPlatformNotificationsAndLogs = async ({ page = 1, limit = 20 }) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  const skip = (p - 1) * l;

  // Retrieve platform audit logs & webhook events
  const [totalLogs, auditLogs, recentWebhooks] = await Promise.all([
    prisma.audit_logs.count({
      where: { module: 'PLATFORM_SUPER_ADMIN' }
    }),
    prisma.audit_logs.findMany({
      where: { module: 'PLATFORM_SUPER_ADMIN' },
      skip,
      take: l,
      orderBy: { created_at: 'desc' },
      include: {
        businesses: {
          select: { id: true, company_id: true, business_name: true }
        }
      }
    }),
    prisma.webhook_events.findMany({
      take: 15,
      orderBy: { created_at: 'desc' }
    })
  ]);

  return {
    audit_logs: auditLogs,
    recent_events: recentWebhooks,
    pagination: {
      page: p,
      limit: l,
      total: totalLogs,
      pages: Math.ceil(totalLogs / l)
    }
  };
};

/**
 * Platform Settings (View Plans, Razorpay Status, Email Config)
 */
const getPlatformSettings = async () => {
  const [plans, totalCompanies, totalUsers, totalSubscriptions, totalTransactions] = await Promise.all([
    prisma.subscription_plans.findMany({
      orderBy: { price: 'asc' }
    }),
    prisma.businesses.count(),
    prisma.users.count(),
    prisma.platform_subscriptions.count(),
    prisma.payment_transactions.count()
  ]);

  const razorpayConfigured = Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
  const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

  return {
    plans,
    system_config: {
      razorpay: {
        gateway: 'Razorpay',
        configured: razorpayConfigured,
        key_id_masked: env.RAZORPAY_KEY_ID ? `${env.RAZORPAY_KEY_ID.substring(0, 6)}••••••••` : 'Not Set',
        webhook_status: env.RAZORPAY_WEBHOOK_SECRET ? 'VERIFIED (Signature Check Active)' : 'CONFIGURED',
        auto_renewal_supported: true
      },
      smtp: {
        configured: smtpConfigured,
        host: env.SMTP_HOST || 'smtpout.secureserver.net',
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE ? 'TLS / SSL' : 'STARTTLS',
        from_email: env.SMTP_FROM || 'Vexatech Support <noreply@vexatech.in>',
        admin_notification_email: env.SUBSCRIPTION_ADMIN_EMAIL || 'vexatech.connect@gmail.com'
      },
      trial_policy: {
        duration_days: 7,
        standard_plan_price: 599.00,
        currency: 'INR',
        grace_period_days: 3,
        auto_deactivation: true,
        enforcement_model: 'Strict Backend Middleware Guard'
      },
      security_and_auth: {
        token_algorithm: 'HS256',
        token_expiry: env.JWT_EXPIRES_IN || '7d',
        otp_expiry_minutes: env.OTP_EXPIRY_MINUTES || 5,
        super_admin_auth: 'Email OTP Verification (Zero Public Registration)',
        data_isolation: 'Multi-Tenant Company Scoped (RLS/Middleware)'
      },
      system_telemetry: {
        node_env: env.NODE_ENV || 'development',
        database_engine: 'PostgreSQL 16 via Prisma ORM',
        total_companies_registered: totalCompanies,
        total_platform_users: totalUsers,
        total_subscriptions: totalSubscriptions,
        total_transactions: totalTransactions
      }
    }
  };
};

module.exports = {
  sendSuperAdminOtp,
  verifySuperAdminOtp,
  getDashboardMetrics,
  getCompanies,
  getCompanyById,
  toggleCompanyStatus,
  getUsers,
  toggleUserStatus,
  getSubscriptions,
  getSubscriptionById,
  getPayments,
  getAnalytics,
  getPlatformNotificationsAndLogs,
  getPlatformSettings
};
