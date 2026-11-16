const prisma = require('../config/db');

// Helper to safely extract clean logo string (e.g. from JSON-wrapped metadata)
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

// Helper to generate a clean, URL-safe slug from role name
const generateRoleSlug = (name) => {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const getRoles = async (business_id) => {
  // Count active users per system role in this business
  const [adminCount, managerCount, cashierCount, stockCount, accountantCount] = await Promise.all([
    prisma.users.count({ where: { business_id, role: 'ADMIN', is_active: true } }),
    prisma.users.count({ where: { business_id, role: 'MANAGER', is_active: true } }),
    prisma.users.count({ where: { business_id, role: 'BILLING_STAFF', custom_role_id: null, is_active: true } }),
    prisma.users.count({ where: { business_id, role: 'STOCK_STAFF', custom_role_id: null, is_active: true } }),
    prisma.users.count({ where: { business_id, role: 'ACCOUNTANT', custom_role_id: null, is_active: true } })
  ]);

  const customRoles = await prisma.custom_roles.findMany({
    where: { business_id },
    include: {
      _count: {
        select: { users: true }
      }
    },
    orderBy: { created_at: 'asc' }
  });

  const formattedCustom = customRoles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || '',
    status: r.is_active ? 'Active' : 'Inactive',
    is_active: r.is_active,
    isSystem: false,
    permissions: Array.isArray(r.permissions) ? r.permissions : (typeof r.permissions === 'string' ? JSON.parse(r.permissions) : []),
    usersCount: r._count?.users || 0,
    login_url: `/company/${r.slug}/login`
  }));

  // Standard predefined system roles with live user counts
  const systemRoles = [
    {
      id: 'role-admin',
      name: 'ADMIN',
      slug: 'admin',
      description: 'Business owner with full unrestricted access to all modules and settings.',
      usersCount: adminCount,
      status: 'Active',
      is_active: true,
      isSystem: true,
      permissions: ['*'],
      login_url: '/company/admin/login'
    },
    {
      id: 'role-manager',
      name: 'Manager',
      slug: 'manager-role',
      description: 'Manages sales, purchases, customers, inventory, payments, and reporting.',
      usersCount: managerCount,
      status: 'Active',
      is_active: true,
      isSystem: false,
      permissions: [
        'dashboard.view', 'sales.view', 'sales.create', 'sales.edit', 'sales.confirm', 'sales.cancel', 'sales.invoices', 'sales.print', 'sales.email', 'sales.return',
        'gst.pos', 'gst.create', 'gst.view', 'gst.reports',
        'customers.view', 'customers.create', 'customers.edit', 'customers.history', 'customers.ledger', 'customers.payment',
        'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.history', 'suppliers.ledger', 'suppliers.payment',
        'products.view', 'products.create', 'products.edit', 'products.categories', 'products.variants',
        'stock.view', 'stock.movements', 'stock.adjustments', 'stock.approve',
        'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm',
        'payments.view', 'payments.create', 'payments.history',
        'quotations.view', 'quotations.create', 'quotations.edit', 'quotations.convert',
        'reports.sales', 'reports.purchases', 'reports.stock', 'reports.customers', 'reports.suppliers', 'reports.payments', 'reports.export',
        'notifications.view', 'email.history', 'email.resend', 'campaigns.view', 'campaigns.create', 'campaigns.send',
        'scanner.view', 'scanner.scan',
        'crm.view', 'crm.customers_view', 'crm.followups_view', 'crm.followups_create', 'crm.followups_edit', 'crm.followups_delete', 'crm.segments_view', 'crm.segments_create', 'crm.product_insights_view', 'crm.purchase_patterns_view', 'crm.timeline_view'
      ],
      login_url: '/company/manager-role/login'
    },
    {
      id: 'role-stock',
      name: 'Stock Role',
      slug: 'stock-role',
      description: 'Manages products, categories, stock levels, adjustments, and purchases.',
      usersCount: stockCount,
      status: 'Active',
      is_active: true,
      isSystem: false,
      permissions: [
        'dashboard.view',
        'products.view', 'products.create', 'products.edit', 'products.categories', 'products.variants',
        'stock.view', 'stock.movements', 'stock.adjustments',
        'purchases.view', 'purchases.create', 'purchases.edit', 'purchases.confirm',
        'notifications.view',
        'scanner.view', 'scanner.scan'
      ],
      login_url: '/company/stock-role/login'
    },
    {
      id: 'role-accountant',
      name: 'Accountant',
      slug: 'accountant-role',
      description: 'Manages customer ledgers, supplier payments, financial ledgers, and reports.',
      usersCount: accountantCount,
      status: 'Active',
      is_active: true,
      isSystem: false,
      permissions: [
        'dashboard.view', 'sales.view', 'sales.invoices', 'sales.print',
        'customers.view', 'customers.history', 'customers.ledger', 'customers.payment',
        'suppliers.view', 'suppliers.history', 'suppliers.ledger', 'suppliers.payment',
        'payments.view', 'payments.create', 'payments.history',
        'reports.sales', 'reports.purchases', 'reports.stock', 'reports.customers', 'reports.suppliers', 'reports.payments', 'reports.export',
        'notifications.view'
      ],
      login_url: '/company/accountant-role/login'
    },
    {
      id: 'role-billing',
      name: 'Cashier / Billing Staff',
      slug: 'cashier-role',
      description: 'Handles customer sales billing, POS invoices, and quotations.',
      usersCount: cashierCount,
      status: 'Active',
      is_active: true,
      isSystem: false,
      permissions: [
        'dashboard.view', 'sales.view', 'sales.create', 'sales.confirm', 'sales.invoices', 'sales.print', 'sales.email', 'sales.return',
        'gst.pos', 'gst.create', 'gst.view',
        'customers.view', 'customers.create', 'customers.edit',
        'payments.view', 'payments.create',
        'quotations.view', 'quotations.create',
        'notifications.view',
        'scanner.view', 'scanner.scan',
        'crm.view', 'crm.customers_view', 'crm.followups_view', 'crm.followups_create', 'crm.followups_edit', 'crm.segments_view', 'crm.product_insights_view', 'crm.purchase_patterns_view', 'crm.timeline_view'
      ],
      login_url: '/company/cashier-role/login'
    }
  ];

  // Merge system roles and custom roles: if a custom role has the same slug as a preset, custom role takes precedence
  const merged = [
    ...systemRoles.filter(sr => !formattedCustom.some(cr => cr.slug === sr.slug)),
    ...formattedCustom
  ];

  return merged;
};

const getRoleBySlug = async (slug) => {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!cleanSlug) {
    const error = new Error('Role identifier is required');
    error.statusCode = 400;
    throw error;
  }

  // Predefined standard system roles
  const systemSlugMap = {
    admin: { name: 'Admin / Business Owner', role: 'ADMIN' },
    'admin-role': { name: 'Admin / Business Owner', role: 'ADMIN' },
    cashier: { name: 'Cashier / Billing Staff', role: 'BILLING_STAFF' },
    'cashier-role': { name: 'Cashier / Billing Staff', role: 'BILLING_STAFF' },
    'cashier-billing-staff': { name: 'Cashier / Billing Staff', role: 'BILLING_STAFF' },
    billing: { name: 'Billing Staff', role: 'BILLING_STAFF' },
    'billing-staff': { name: 'Billing Staff', role: 'BILLING_STAFF' },
    accountant: { name: 'Accountant', role: 'ACCOUNTANT' },
    'accountant-role': { name: 'Accountant', role: 'ACCOUNTANT' },
    manager: { name: 'Manager', role: 'MANAGER' },
    'manager-role': { name: 'Manager', role: 'MANAGER' },
    'stock-manager': { name: 'Stock Manager', role: 'STOCK_STAFF' },
    'stock-role': { name: 'Stock Manager', role: 'STOCK_STAFF' },
    stock: { name: 'Stock Manager', role: 'STOCK_STAFF' },
    'stock-staff': { name: 'Stock Manager', role: 'STOCK_STAFF' },
    sales: { name: 'Sales Representative', role: 'BILLING_STAFF' },
    'sales-role': { name: 'Sales Representative', role: 'BILLING_STAFF' },
    'sales-representative': { name: 'Sales Representative', role: 'BILLING_STAFF' }
  };

  // Find active custom role matching slug
  let role = null;
  try {
    role = await prisma.custom_roles.findFirst({
      where: {
        slug: cleanSlug,
        is_active: true
      },
      include: {
        businesses: {
          select: {
            id: true,
            company_id: true,
            business_name: true,
            logo_url: true,
            is_active: true
          }
        }
      }
    });
  } catch (dbErr) {
    // If DB is unreachable or in non-DB unit test, fallback to system roles if match found
    if (systemSlugMap[cleanSlug]) {
      return {
        id: `sys-${cleanSlug}`,
        name: systemSlugMap[cleanSlug].name,
        slug: cleanSlug,
        system_role: systemSlugMap[cleanSlug].role,
        isSystem: true,
        status: 'Active',
        is_active: true
      };
    }
    throw dbErr;
  }

  if (!role || !role.businesses || role.businesses.is_active === false) {
    if (systemSlugMap[cleanSlug]) {
      // Find active primary business to get company name and custom logo from settings
      let primaryCompany = null;
      try {
        primaryCompany = await prisma.businesses.findFirst({
          where: { is_active: true },
          select: {
            id: true,
            company_id: true,
            business_name: true,
            logo_url: true
          },
          orderBy: { created_at: 'asc' }
        });
      } catch (err) {}

      return {
        id: `sys-${cleanSlug}`,
        name: systemSlugMap[cleanSlug].name,
        slug: cleanSlug,
        system_role: systemSlugMap[cleanSlug].role,
        isSystem: true,
        status: 'Active',
        is_active: true,
        company: primaryCompany ? {
          id: primaryCompany.id,
          company_id: primaryCompany.company_id,
          business_name: primaryCompany.business_name,
          logo_url: extractLogoString(primaryCompany.logo_url)
        } : null
      };
    }

    const error = new Error('This role login portal is unavailable or does not exist.');
    error.statusCode = 404;
    throw error;
  }

  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: false,
    status: 'Active',
    is_active: true,
    company: {
      id: role.businesses.id,
      company_id: role.businesses.company_id,
      business_name: role.businesses.business_name,
      logo_url: extractLogoString(role.businesses.logo_url)
    }
  };
};

const createRole = async (business_id, data) => {
  const name = String(data.name || '').trim();
  if (!name) {
    const error = new Error('Role name is required');
    error.statusCode = 400;
    throw error;
  }

  // Prevent creation of reserved ADMIN role
  if (name.toUpperCase() === 'ADMIN' || name.toLowerCase() === 'super-admin') {
    const error = new Error('Cannot create or override the ADMIN system role.');
    error.statusCode = 400;
    throw error;
  }

  const baseSlug = generateRoleSlug(data.slug || name);
  if (!baseSlug) {
    const error = new Error('Could not generate a valid URL slug for this role.');
    error.statusCode = 400;
    throw error;
  }

  // Check slug conflict within company
  const existingRole = await prisma.custom_roles.findFirst({
    where: {
      business_id,
      slug: baseSlug
    }
  });

  if (existingRole) {
    const error = new Error(`A role with slug '${baseSlug}' already exists in your company. Please choose a different name.`);
    error.statusCode = 409;
    throw error;
  }

  // Filter out any invalid / forbidden permissions
  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  const sanitizedPermissions = permissions.filter(p => typeof p === 'string' && !p.includes('admin.super'));

  const created = await prisma.custom_roles.create({
    data: {
      business_id,
      name,
      slug: baseSlug,
      description: data.description ? String(data.description).trim() : null,
      permissions: sanitizedPermissions,
      is_active: data.is_active !== undefined ? Boolean(data.is_active) : (data.status ? data.status === 'Active' : true)
    }
  });

  return {
    id: created.id,
    name: created.name,
    slug: created.slug,
    description: created.description || '',
    status: created.is_active ? 'Active' : 'Inactive',
    is_active: created.is_active,
    isSystem: false,
    permissions: created.permissions,
    usersCount: 0,
    login_url: `/company/${created.slug}/login`
  };
};

const updateRole = async (business_id, id, data) => {
  if (id === 'role-admin' || String(data.name || '').toUpperCase() === 'ADMIN') {
    const error = new Error('System ADMIN role cannot be modified or overridden.');
    error.statusCode = 400;
    throw error;
  }

  let role = null;
  if (!String(id).startsWith('role-')) {
    role = await prisma.custom_roles.findFirst({
      where: { id, business_id }
    });
  }

  // If role is a preset system role being customized for the first time, persist it to custom_roles
  if (!role && String(id).startsWith('role-')) {
    const presetSlugMap = {
      'role-manager': 'manager-role',
      'role-stock': 'stock-role',
      'role-accountant': 'accountant-role',
      'role-billing': 'cashier-role'
    };
    const targetSlug = presetSlugMap[id] || generateRoleSlug(data.slug || data.name);
    
    // Check if custom_roles already has it
    let existing = await prisma.custom_roles.findFirst({
      where: { business_id, slug: targetSlug }
    });
    if (existing) {
      role = existing;
    } else {
      const created = await prisma.custom_roles.create({
        data: {
          business_id,
          name: data.name || (id === 'role-stock' ? 'Stock Role' : id === 'role-accountant' ? 'Accountant' : id === 'role-billing' ? 'Cashier / Billing Staff' : 'Manager'),
          slug: targetSlug,
          description: data.description || 'Customized role permissions.',
          permissions: Array.isArray(data.permissions) ? data.permissions.filter(p => typeof p === 'string' && !p.includes('admin.super')) : [],
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : (data.status ? data.status === 'Active' : true)
        },
        include: { _count: { select: { users: true } } }
      });
      return {
        id: created.id,
        name: created.name,
        slug: created.slug,
        description: created.description || '',
        status: created.is_active ? 'Active' : 'Inactive',
        is_active: created.is_active,
        isSystem: false,
        permissions: created.permissions,
        usersCount: created._count?.users || 0,
        login_url: `/company/${created.slug}/login`
      };
    }
  }

  if (!role) {
    const error = new Error('Custom role not found');
    error.statusCode = 404;
    throw error;
  }

  const updatePayload = {
    updated_at: new Date()
  };

  if (data.name) {
    const newName = String(data.name).trim();
    if (newName.toUpperCase() === 'ADMIN') {
      const error = new Error('Cannot rename a role to ADMIN.');
      error.statusCode = 400;
      throw error;
    }
    updatePayload.name = newName;
  }

  // Preserve slug unless explicitly provided and different
  if (data.slug) {
    const newSlug = generateRoleSlug(data.slug);
    if (newSlug !== role.slug) {
      const conflict = await prisma.custom_roles.findFirst({
        where: { business_id, slug: newSlug, id: { not: role.id } }
      });
      if (conflict) {
        const error = new Error(`A role with slug '${newSlug}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
      updatePayload.slug = newSlug;
    }
  }

  if (data.description !== undefined) {
    updatePayload.description = data.description ? String(data.description).trim() : null;
  }

  if (data.permissions !== undefined && Array.isArray(data.permissions)) {
    updatePayload.permissions = data.permissions.filter(p => typeof p === 'string' && !p.includes('admin.super'));
  }

  if (data.status) {
    updatePayload.is_active = data.status === 'Active';
  } else if (data.is_active !== undefined) {
    updatePayload.is_active = Boolean(data.is_active);
  }

  const updated = await prisma.custom_roles.update({
    where: { id: role.id },
    data: updatePayload,
    include: {
      _count: {
        select: { users: true }
      }
    }
  });

  return {
    id: updated.id,
    name: updated.name,
    slug: updated.slug,
    description: updated.description || '',
    status: updated.is_active ? 'Active' : 'Inactive',
    is_active: updated.is_active,
    isSystem: false,
    permissions: updated.permissions,
    usersCount: updated._count?.users || 0,
    login_url: `/company/${updated.slug}/login`
  };
};

const deleteRole = async (business_id, id) => {
  if (id === 'role-admin' || String(id).includes('admin')) {
    const error = new Error('System ADMIN role cannot be deleted.');
    error.statusCode = 400;
    throw error;
  }

  const role = await prisma.custom_roles.findFirst({
    where: { id, business_id },
    include: {
      _count: { select: { users: true } }
    }
  });

  if (!role) {
    const error = new Error('Custom role not found');
    error.statusCode = 404;
    throw error;
  }

  if (role._count?.users > 0) {
    const error = new Error(`Cannot delete role "${role.name}" because ${role._count.users} user(s) are currently assigned to it. Please reassign the user(s) before deleting.`);
    error.statusCode = 400;
    throw error;
  }

  await prisma.custom_roles.delete({
    where: { id }
  });

  return { message: `Role "${role.name}" deleted successfully.` };
};

module.exports = {
  getRoles,
  getRoleBySlug,
  createRole,
  updateRole,
  deleteRole,
  generateRoleSlug
};
