const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const env = require('../config/env');
const { logAudit } = require('./audit.service');
const { sendOtpEmail } = require('../utils/email.util');
const { sendTrialStartedEmail } = require('./subscriptionEmail.service');

const { evaluateSubscriptionAccess } = require('../utils/subscriptionPolicy');

// Secure pending registrations map: email -> { otp, expiresAt, attempts, registrationData }
const pendingRegistrationStore = new Map();

const extractLogoString = (logoUrl) => {
  if (!logoUrl) return '/logo.png';
  const raw = String(logoUrl).trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed.logo || parsed.logo_url || '/logo.png';
    } catch (e) {}
  }
  return raw || '/logo.png';
};

const extractInvoiceTemplate = (logoUrl) => {
  if (!logoUrl) return 'DEFAULT_A4';
  const raw = String(logoUrl).trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed.invoice_template || 'DEFAULT_A4';
    } catch (e) {}
  }
  return 'DEFAULT_A4';
};

/**
 * Register a new company and its initial ADMIN owner.
 * Atomically generates a unique Company ID, creates initial subscription record, and issues auth session.
 */
const registerBusinessAndAdmin = async (data) => {
  const cleanEmail = (data.email || '').trim().toLowerCase();

  const existingUser = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } }
  });

  if (existingUser) {
    const error = new Error('An account with this email address already exists. Please sign in.');
    error.statusCode = 409;
    throw error;
  }

  // Also check if phone is already registered to avoid duplicates
  if (data.phone) {
    const existingPhone = await prisma.users.findFirst({
      where: { phone: data.phone.trim() }
    });
    if (existingPhone) {
      const error = new Error('An account with this phone number already exists.');
      error.statusCode = 409;
      throw error;
    }
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

  return await prisma.$transaction(async (tx) => {
    const { generateCompanyId } = require('../utils/companyId.util');
    const companyId = await generateCompanyId(tx);

    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Create Company / Business with TRIALING subscription status (7-Day Free Trial)
    const company = await tx.businesses.create({
      data: {
        company_id: companyId,
        business_name: data.business_name.trim(),
        business_type: data.business_type || 'GARMENT_TEXTILE',
        owner_name: (data.owner_name || data.admin_name || '').trim(),
        phone: (data.phone || '').trim(),
        email: cleanEmail,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        gst_number: data.gst_number || null,
        pan_number: data.pan_number || null,
        invoice_prefix: data.invoice_prefix || 'INV',
        subscription_status: 'TRIALING',
        license_status: 'ACTIVE',
        trial_start_at: trialStartDate,
        trial_end_at: trialEndDate,
        has_used_trial: true,
        is_active: true
      }
    });

    // 2. Create Initial ADMIN Owner User
    const user = await tx.users.create({
      data: {
        business_id: company.id,
        name: data.admin_name.trim(),
        email: cleanEmail,
        phone: (data.phone || '0000000000').trim(),
        password_hash: hashedPassword,
        role: 'ADMIN',
        is_active: true
      }
    });

    // 3. Create initial company platform_subscriptions record in TRIALING state
    const defaultPlan = await tx.subscription_plans.findFirst({
      where: { plan_name: 'VEXA Invoice Monthly', is_active: true }
    });

    const timestamp = Date.now();
    const initialSubId = `vexa_trial_${company.company_id || company.id.slice(0, 8)}_${timestamp}`;

    const createdSub = await tx.platform_subscriptions.create({
      data: {
        company_id: companyId,
        business_id: company.id,
        plan_id: defaultPlan ? defaultPlan.id : null,
        provider: 'RAZORPAY',
        provider_subscription_id: initialSubId,
        status: 'TRIALING',
        amount: defaultPlan ? defaultPlan.price : 599.00,
        currency: 'INR',
        billing_interval: 'MONTHLY',
        current_period_start: trialStartDate,
        current_period_end: trialEndDate,
        trial_start_at: trialStartDate,
        trial_end_at: trialEndDate,
        mandate_status: 'TRIAL',
        auto_renew: true
      }
    });

    // Send Trial Started Notification Email asynchronously
    sendTrialStartedEmail({
      businessId: company.id,
      companyName: company.business_name,
      companyId: company.company_id,
      subscriberName: user.name,
      subscriberEmail: user.email,
      trialStartDate,
      trialEndDate,
      subscriptionId: createdSub.id
    });

    await logAudit({
      business_id: company.id,
      user_id: user.id,
      action: 'BUSINESS_REGISTERED',
      module: 'AUTH',
      reference_id: company.id,
      new_data: {
        company_id: company.company_id,
        business_name: company.business_name,
        email: user.email,
        role: user.role
      }
    }, tx);

    const token = jwt.sign(
      { id: user.id, business_id: company.id, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN, algorithm: env.JWT_ALGORITHM || 'HS256' }
    );

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        business_id: user.business_id
      },
      business: {
        id: company.id,
        company_id: company.company_id,
        business_name: company.business_name,
        business_type: company.business_type,
        subscription_status: company.subscription_status,
        license_status: company.license_status,
        invoice_prefix: company.invoice_prefix
      },
      token
    };
  });
};

const loginUser = async (email, password, roleSlug = null) => {
  const cleanEmail = (email || '').trim();
  const user = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    include: {
      businesses: true,
      custom_roles: true
    }
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (user.is_active === false) {
    const error = new Error('Your account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  if (!user.businesses || user.businesses.is_active === false) {
    const error = new Error('Company account is deactivated');
    error.statusCode = 403;
    throw error;
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // If logging in via the main/default portal (/login with no roleSlug), only ADMIN accounts are permitted
  if (!roleSlug) {
    if (user.role !== 'ADMIN') {
      const error = new Error('Access Denied: You do not have permission to access this login portal.');
      error.statusCode = 403;
      throw error;
    }
  } else {
    // If logging in via a role-specific URL (/company/:roleSlug/login), verify the user is actually assigned to that role
    const cleanSlug = String(roleSlug).trim().toLowerCase();

    // System ADMIN has unconditional owner access to all company role portals
    if (user.role === 'ADMIN') {
      // Authorized owner access
    } else {
      let matchesRole = false;

      // Equivalent slug groups
      const slugGroups = [
        ['stock-manager', 'stock-role', 'stock', 'stock-staff'],
        ['accountant-role', 'accountant'],
        ['cashier-role', 'cashier', 'billing', 'cashier-billing-staff', 'billing-staff'],
        ['manager-role', 'manager'],
        ['admin-role', 'admin'],
        ['sales-role', 'sales', 'sales-representative']
      ];

      const uSlug = user.custom_roles?.slug ? String(user.custom_roles.slug).toLowerCase().trim() : '';
      const uRole = user.role ? String(user.role).toUpperCase().trim() : '';
      const uName = user.custom_roles?.name ? String(user.custom_roles.name).toLowerCase().trim() : '';

      // Check if custom role is active
      if (user.custom_roles && user.custom_roles.is_active === false) {
        const error = new Error('Access Denied: Your assigned custom role is currently deactivated. Please contact your company administrator.');
        error.statusCode = 403;
        throw error;
      }

      // 1. Direct slug match
      if (uSlug && uSlug === cleanSlug) {
        matchesRole = true;
      }

      // 2. Equivalent slug group match (e.g. stock-manager vs stock-role vs stock)
      if (!matchesRole) {
        for (const group of slugGroups) {
          if (group.includes(cleanSlug)) {
            if (uSlug && group.includes(uSlug)) matchesRole = true;
            if (group.includes('stock-manager') && (uRole === 'STOCK_STAFF' || uName.includes('stock'))) matchesRole = true;
            if (group.includes('accountant') && (uRole === 'ACCOUNTANT' || uName.includes('accountant'))) matchesRole = true;
            if (group.includes('cashier') && (uRole === 'BILLING_STAFF' || uName.includes('cashier') || uName.includes('billing'))) matchesRole = true;
            if (group.includes('manager') && (uRole === 'MANAGER' || uName.includes('manager'))) matchesRole = true;
            if (group.includes('sales') && (uName.includes('sales') || (uRole === 'BILLING_STAFF' && !uSlug))) matchesRole = true;
            break;
          }
        }
      }

      // 3. System role match if user has no custom role
      if (!matchesRole && !user.custom_roles) {
        const systemSlugMap = {
          'stock-manager': 'STOCK_STAFF',
          'stock-role': 'STOCK_STAFF',
          'stock': 'STOCK_STAFF',
          'stock-staff': 'STOCK_STAFF',
          'accountant': 'ACCOUNTANT',
          'accountant-role': 'ACCOUNTANT',
          'cashier': 'BILLING_STAFF',
          'cashier-role': 'BILLING_STAFF',
          'cashier-billing-staff': 'BILLING_STAFF',
          'billing': 'BILLING_STAFF',
          'billing-staff': 'BILLING_STAFF',
          'manager': 'MANAGER',
          'manager-role': 'MANAGER',
          'sales': 'BILLING_STAFF',
          'sales-role': 'BILLING_STAFF',
          'sales-representative': 'BILLING_STAFF'
        };
        if (systemSlugMap[cleanSlug] && uRole === systemSlugMap[cleanSlug]) {
          matchesRole = true;
        }
      }

      // 4. Role name slugified match
      if (!matchesRole && uName) {
        const nameSlug = uName.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        if (nameSlug === cleanSlug) {
          matchesRole = true;
        }
      }

      if (!matchesRole) {
        const error = new Error('Access Denied: You do not have permission to access this login portal.');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  // Load effective permissions
  let permissions = [];
  if (user.role === 'ADMIN') {
    permissions = ['*']; // Full unconditional access
  } else if (user.custom_roles && Array.isArray(user.custom_roles.permissions)) {
    permissions = user.custom_roles.permissions;
  }

  const token = jwt.sign(
    {
      id: user.id,
      business_id: user.business_id,
      role: user.role,
      custom_role_id: user.custom_role_id,
      role_slug: user.custom_roles?.slug || null
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN, algorithm: env.JWT_ALGORITHM || 'HS256' }
  );

  const roleSlugMapping = {
    BILLING_STAFF: 'cashier-role',
    ACCOUNTANT: 'accountant-role',
    MANAGER: 'manager-role',
    STOCK_STAFF: 'stock-role',
    ADMIN: 'admin'
  };
  const effectiveRoleSlug = user.custom_roles?.slug || roleSlugMapping[user.role] || null;

  // Authoritatively evaluate current subscription & feature access policy on login
  let loginLatestSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id: user.business_id,
      status: { in: ['ACTIVE', 'TRIALING'] }
    },
    orderBy: { created_at: 'desc' },
    include: { subscription_plans: true }
  });

  if (!loginLatestSub) {
    loginLatestSub = await prisma.platform_subscriptions.findFirst({
      where: { business_id: user.business_id },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true }
    });
  }

  const loginLifetimeLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id: user.business_id,
      license_type: 'ONE_TIME_LICENSE',
      status: 'ACTIVE'
    }
  });

  const loginAccessEval = evaluateSubscriptionAccess(loginLatestSub, user.businesses, loginLifetimeLicense);
  const loginIsGrowthOrLifetime = loginAccessEval.tier === 'GROWTH' || loginAccessEval.tier === 'LIFETIME' || !!loginLifetimeLicense;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      role_slug: effectiveRoleSlug,
      custom_role_id: user.custom_role_id || null,
      custom_role: user.custom_roles ? {
        id: user.custom_roles.id,
        name: user.custom_roles.name,
        slug: user.custom_roles.slug,
        permissions: user.custom_roles.permissions
      } : null,
      display_role: user.custom_roles ? user.custom_roles.name : user.role,
      permissions,
      business_id: user.business_id
    },
    business: {
      id: user.businesses.id,
      company_id: user.businesses.company_id,
      business_name: user.businesses.business_name,
      business_type: user.businesses.business_type,
      phone: user.businesses.phone,
      address: user.businesses.address,
      gstin: user.businesses.gst_number,
      subscription_status: loginAccessEval.status || user.businesses.subscription_status || 'PENDING',
      license_status: loginLifetimeLicense ? 'ACTIVE' : (loginAccessEval.effectiveLicenseStatus || user.businesses.license_status || 'PENDING_ACTIVATION'),
      self_shopping_status: loginLifetimeLicense ? 'LIFETIME_ACTIVE' : (loginIsGrowthOrLifetime ? 'GROWTH_ACTIVE' : user.businesses.self_shopping_status || null),
      subscription_tier: loginAccessEval.tier || 'STARTER',
      subscription_allowed: Boolean(loginAccessEval.allowed),
      days_remaining: loginAccessEval.daysRemaining !== undefined ? loginAccessEval.daysRemaining : null,
      logo: extractLogoString(user.businesses.logo_url),
      invoice_template: extractInvoiceTemplate(user.businesses.logo_url),
      invoice_prefix: user.businesses.invoice_prefix
    },
    token
  };
};

// General OTP store for password reset: email -> { otp, expiresAt, attempts }
const otpStore = new Map();

/**
 * Stage 1 of Registration: Validate input, create pending registration, and dispatch OTP.
 * Does NOT create business or user records yet.
 */
const sendRegistrationOtp = async (registrationData) => {
  const email = (registrationData.email || '').trim().toLowerCase();
  const name = (registrationData.admin_name || registrationData.name || 'User').trim();
  const phone = (registrationData.phone || '').trim();

  // Check duplicate email
  const existingUser = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });

  if (existingUser) {
    const error = new Error('An account with this email address already exists. Please sign in.');
    error.statusCode = 409;
    throw error;
  }

  // Check duplicate phone
  if (phone) {
    const existingPhone = await prisma.users.findFirst({
      where: { phone }
    });
    if (existingPhone) {
      const error = new Error('An account with this phone number already exists.');
      error.statusCode = 409;
      throw error;
    }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000;
  // Generate a secure registration ID so email is not exposed in browser address/search bar
  const regId = `reg_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

  const pendingEntry = {
    id: regId,
    otp,
    expiresAt,
    attempts: 0,
    registrationData: {
      ...registrationData,
      email,
      admin_name: name,
      phone
    }
  };

  // Store indexed by both id and email
  pendingRegistrationStore.set(regId, pendingEntry);
  pendingRegistrationStore.set(email, pendingEntry);

  console.log(`\n======================================================`);
  console.log(`🔑 [REGISTRATION OTP DISPATCH] ID: ${regId} | Email: ${email} | Code: ${otp}`);
  console.log(`======================================================\n`);

  await sendOtpEmail(email, otp, name);
  return { id: regId, email, expiresAt };
};

/**
 * Stage 2 of Registration: Validate OTP, check expiration and attempt limits,
 * then atomically create the Company, initial ADMIN owner, and subscription record.
 */
const verifyRegistrationOtp = async (params, legacyOtp = null, legacyClientData = null) => {
  // Support both object signature { id, email, otp, registrationData } and legacy (email, otp, clientRegistrationData)
  let id, email, otp, clientRegistrationData;
  if (typeof params === 'object' && params !== null && (params.otp || params.id || params.email)) {
    id = params.id;
    email = params.email;
    otp = params.otp;
    clientRegistrationData = params.registrationData;
  } else {
    email = params;
    otp = legacyOtp;
    clientRegistrationData = legacyClientData;
  }

  const cleanId = id ? String(id).trim() : null;
  const cleanEmail = email ? String(email).trim().toLowerCase() : null;

  // Lookup pending registration by ID or Email
  let pending = null;
  if (cleanId && pendingRegistrationStore.has(cleanId)) {
    pending = pendingRegistrationStore.get(cleanId);
  } else if (cleanEmail && pendingRegistrationStore.has(cleanEmail)) {
    pending = pendingRegistrationStore.get(cleanEmail);
  }

  if (!pending) {
    const error = new Error('No pending registration found. Please click resend or re-enter details.');
    error.statusCode = 400;
    throw error;
  }

  const targetEmail = pending.registrationData?.email || cleanEmail;
  const targetId = pending.id || cleanId;

  if (Date.now() > pending.expiresAt) {
    if (targetEmail) pendingRegistrationStore.delete(targetEmail);
    if (targetId) pendingRegistrationStore.delete(targetId);
    const error = new Error('Verification OTP code has expired. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  if (pending.attempts >= 5) {
    if (targetEmail) pendingRegistrationStore.delete(targetEmail);
    if (targetId) pendingRegistrationStore.delete(targetId);
    const error = new Error('Too many invalid OTP attempts. Please restart the registration process.');
    error.statusCode = 429;
    throw error;
  }

  if (pending.otp !== String(otp).trim()) {
    pending.attempts += 1;
    const error = new Error(`Invalid OTP code. Please check and try again. (${5 - pending.attempts} attempts remaining)`);
    error.statusCode = 400;
    throw error;
  }

  // Determine complete registration data (merge server pending data with client fallback if password was omitted during simple dispatch)
  const registrationPayload = {
    ...(clientRegistrationData || {}),
    ...(pending.registrationData || {})
  };

  if (!registrationPayload.password && clientRegistrationData?.password) {
    registrationPayload.password = clientRegistrationData.password;
  }

  if (!registrationPayload.business_name && clientRegistrationData?.business_name) {
    registrationPayload.business_name = clientRegistrationData.business_name;
  }

  if (!registrationPayload.password) {
    const error = new Error('Registration details expired. Please click "Back to Signup" to re-enter password.');
    error.statusCode = 400;
    throw error;
  }

  // OTP verified successfully: Consume pending registration immediately to prevent duplicate submissions
  if (targetEmail) pendingRegistrationStore.delete(targetEmail);
  if (targetId) pendingRegistrationStore.delete(targetId);

  // Atomically create Company, ADMIN user, and initial Subscription record
  const result = await registerBusinessAndAdmin(registrationPayload);
  return result;
};

const sendForgotPasswordOtp = async (email) => {
  const user = await prisma.users.findFirst({
    where: { email }
  });

  if (!user) {
    const error = new Error('No registered account found with this email address.');
    error.statusCode = 404;
    throw error;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000;

  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  console.log(`\n======================================================`);
  console.log(`🔑 [FORGOT PASSWORD OTP DISPATCH] Email: ${email} | Code: ${otp}`);
  console.log(`======================================================\n`);

  await sendOtpEmail(email, otp, user.name || 'User');
  return { email, expiresAt };
};

const resetPasswordWithOtp = async (email, otp, newPassword) => {
  const storedData = otpStore.get(email.toLowerCase());

  if (!storedData) {
    const error = new Error('No password reset OTP request found for this email.');
    error.statusCode = 400;
    throw error;
  }

  if (Date.now() > storedData.expiresAt) {
    otpStore.delete(email.toLowerCase());
    const error = new Error('OTP code has expired. Please request a new code.');
    error.statusCode = 400;
    throw error;
  }

  if (storedData.otp !== otp.trim()) {
    const error = new Error('Invalid OTP code. Please try again.');
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.users.updateMany({
    where: { email },
    data: { password_hash: hashedPassword }
  });

  otpStore.delete(email.toLowerCase());
  return { success: true };
};

const getUserProfile = async (userId) => {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      businesses: true,
      custom_roles: true
    }
  });
  if (!user || user.is_active === false) {
    const error = new Error('User account is inactive or no longer exists');
    error.statusCode = 401;
    throw error;
  }

  if (!user.businesses || user.businesses.is_active === false) {
    const error = new Error('Associated business account is inactive');
    error.statusCode = 403;
    throw error;
  }

  if (user.custom_roles && user.custom_roles.is_active === false) {
    const error = new Error('Your assigned custom role is currently deactivated. Please contact your company administrator.');
    error.statusCode = 403;
    throw error;
  }

  let permissions = [];
  if (user.role === 'ADMIN') {
    permissions = ['*'];
  } else if (user.custom_roles && Array.isArray(user.custom_roles.permissions)) {
    permissions = user.custom_roles.permissions;
  }

  const roleSlugMapping = {
    BILLING_STAFF: 'cashier-role',
    ACCOUNTANT: 'accountant-role',
    MANAGER: 'manager-role',
    STOCK_STAFF: 'stock-role',
    ADMIN: 'admin'
  };
  const effectiveRoleSlug = user.custom_roles?.slug || roleSlugMapping[user.role] || null;

  // Authoritatively evaluate current subscription & feature access policy
  let latestSub = await prisma.platform_subscriptions.findFirst({
    where: {
      business_id: user.business_id,
      status: { in: ['ACTIVE', 'TRIALING'] }
    },
    orderBy: { created_at: 'desc' },
    include: { subscription_plans: true }
  });

  if (!latestSub) {
    latestSub = await prisma.platform_subscriptions.findFirst({
      where: { business_id: user.business_id },
      orderBy: { created_at: 'desc' },
      include: { subscription_plans: true }
    });
  }

  const lifetimeLicense = await prisma.platform_licenses.findFirst({
    where: {
      business_id: user.business_id,
      license_type: 'ONE_TIME_LICENSE',
      status: 'ACTIVE'
    }
  });

  const accessEval = evaluateSubscriptionAccess(latestSub, user.businesses, lifetimeLicense);
  const isGrowthOrLifetime = accessEval.tier === 'GROWTH' || accessEval.tier === 'LIFETIME' || !!lifetimeLicense;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      role_slug: effectiveRoleSlug,
      custom_role_id: user.custom_role_id || null,
      custom_role: user.custom_roles ? {
        id: user.custom_roles.id,
        name: user.custom_roles.name,
        slug: user.custom_roles.slug,
        permissions: user.custom_roles.permissions
      } : null,
      display_role: user.custom_roles ? user.custom_roles.name : user.role,
      permissions,
      business_id: user.business_id
    },
    business: {
      id: user.businesses.id,
      company_id: user.businesses.company_id,
      business_name: user.businesses.business_name,
      business_type: user.businesses.business_type,
      phone: user.businesses.phone,
      email: user.businesses.email,
      address: user.businesses.address,
      city: user.businesses.city,
      state: user.businesses.state,
      pincode: user.businesses.pincode,
      gstin: user.businesses.gst_number,
      subscription_status: accessEval.status || user.businesses.subscription_status || 'PENDING',
      license_status: lifetimeLicense ? 'ACTIVE' : (accessEval.effectiveLicenseStatus || user.businesses.license_status || 'PENDING_ACTIVATION'),
      self_shopping_status: lifetimeLicense ? 'LIFETIME_ACTIVE' : (isGrowthOrLifetime ? 'GROWTH_ACTIVE' : user.businesses.self_shopping_status || null),
      subscription_tier: accessEval.tier || 'STARTER',
      subscription_allowed: Boolean(accessEval.allowed),
      days_remaining: accessEval.daysRemaining !== undefined ? accessEval.daysRemaining : null,
      logo: extractLogoString(user.businesses.logo_url),
      invoice_template: extractInvoiceTemplate(user.businesses.logo_url),
      invoice_prefix: user.businesses.invoice_prefix
    }
  };
};

const updateUserProfile = async (userId, data) => {
  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const updateData = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;

  if (data.new_password) {
    if (data.current_password) {
      const isValid = await bcrypt.compare(data.current_password, user.password_hash);
      if (!isValid) {
        const error = new Error('Current password is incorrect');
        error.statusCode = 400;
        throw error;
      }
    }
    updateData.password_hash = await bcrypt.hash(data.new_password, 10);
  }

  const updatedUser = await prisma.users.update({
    where: { id: userId },
    data: updateData
  });

  return {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role
  };
};

const updateBusinessDetails = async (businessId, data) => {
  const updateData = {};
  if (data.business_name) updateData.business_name = data.business_name;
  if (data.phone) updateData.phone = data.phone;
  if (data.address) updateData.address = data.address;
  if (data.gst_number) updateData.gst_number = data.gst_number;
  if (data.logo_url !== undefined || data.invoice_template !== undefined) {
    const biz = await prisma.businesses.findUnique({ where: { id: businessId } });
    let currentMeta = {};
    if (biz?.logo_url && biz.logo_url.startsWith('{')) {
      try { currentMeta = JSON.parse(biz.logo_url); } catch (e) {}
    }
    if (data.logo_url !== undefined) {
      currentMeta.logo = data.logo_url;
    }
    if (data.invoice_template !== undefined) {
      currentMeta.invoice_template = data.invoice_template;
    }
    updateData.logo_url = JSON.stringify(currentMeta);
  }

  const updatedBusiness = await prisma.businesses.update({
    where: { id: businessId },
    data: updateData
  });

  return {
    id: updatedBusiness.id,
    business_name: updatedBusiness.business_name,
    phone: updatedBusiness.phone,
    address: updatedBusiness.address,
    gstin: updatedBusiness.gst_number,
    logo: extractLogoString(updatedBusiness.logo_url),
    invoice_template: extractInvoiceTemplate(updatedBusiness.logo_url),
    business_type: updatedBusiness.business_type
  };
};

module.exports = {
  registerBusinessAndAdmin,
  loginUser,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  sendForgotPasswordOtp,
  resetPasswordWithOtp,
  getUserProfile,
  updateUserProfile,
  updateBusinessDetails
};
