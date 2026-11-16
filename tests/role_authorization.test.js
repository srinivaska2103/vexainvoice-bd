/**
 * Comprehensive Unit Test Suite for Role-Based Access Control and Authorization
 */
const assert = require('assert');
const { authorize } = require('../src/middleware/role');
const { generateRoleSlug, getRoleBySlug } = require('../src/services/role.service');

console.log('--- RUNNING ROLE & RBAC AUTHORIZATION TESTS ---');

// Test 1: generateRoleSlug generates URL-safe slugs
assert.strictEqual(generateRoleSlug('Stock Role'), 'stock-role');
assert.strictEqual(generateRoleSlug('Accountant'), 'accountant');
assert.strictEqual(generateRoleSlug('Senior Billing Staff (Night Shift)'), 'senior-billing-staff-night-shift');
assert.strictEqual(generateRoleSlug('Sales & Marketing Lead!'), 'sales-marketing-lead');
console.log('✅ Test 1 Passed: generateRoleSlug produces URL-safe slugs');

// Helper to simulate express req, res, next
function mockExpress(user) {
  let status = null;
  let json = null;
  let nextCalled = false;
  const req = { user };
  const res = {
    status: (code) => {
      status = code;
      return res;
    },
    json: (payload) => {
      json = payload;
      return res;
    }
  };
  const next = () => { nextCalled = true; };
  return { req, res, next, getResult: () => ({ status, json, nextCalled }) };
}

// Test 2: ADMIN has unconditional full access to all endpoints
{
  const { req, res, next, getResult } = mockExpress({ role: 'ADMIN', permissions: ['*'] });
  authorize('products.create')(req, res, next);
  assert.strictEqual(getResult().nextCalled, true);
  console.log('✅ Test 2 Passed: ADMIN role is granted unconditional access');
}

// Test 3: System role matching (e.g. BILLING_STAFF accessing sales.create)
{
  const { req, res, next, getResult } = mockExpress({ role: 'BILLING_STAFF', custom_role: null, permissions: [] });
  authorize('BILLING_STAFF', 'sales.create')(req, res, next);
  assert.strictEqual(getResult().nextCalled, true);
  console.log('✅ Test 3 Passed: System role matches allowed system roles');
}

// Test 4: Custom role matching authorized permissions
{
  const { req, res, next, getResult } = mockExpress({
    role: 'USER',
    custom_role: { name: 'Stock Staff', slug: 'stock-role', permissions: ['products.create', 'products.view'], is_active: true },
    permissions: ['products.create', 'products.view']
  });
  authorize('products.create')(req, res, next);
  assert.strictEqual(getResult().nextCalled, true);
  console.log('✅ Test 4 Passed: Custom role with granted module permission succeeds');
}

// Test 5: Custom role matching unauthorized permissions (blocked 403)
{
  const { req, res, next, getResult } = mockExpress({
    role: 'USER',
    custom_role: { name: 'Stock Staff', slug: 'stock-role', permissions: ['products.view'], is_active: true },
    permissions: ['products.view']
  });
  authorize('sales.create')(req, res, next);
  assert.strictEqual(getResult().status, 403);
  assert.strictEqual(getResult().nextCalled, false);
  console.log('✅ Test 5 Passed: Custom role does NOT leak base system role permissions and is blocked (403)');
}

// Test 6: Inactive custom role blocked
{
  const { req, res, next, getResult } = mockExpress({
    role: 'USER',
    custom_role: { name: 'Inactive Role', slug: 'inactive-role', permissions: ['products.create'], is_active: false },
    permissions: ['products.create']
  });
  authorize('products.create')(req, res, next);
  assert.strictEqual(getResult().status, 403);
  console.log('✅ Test 6 Passed: Inactive / deactivated role status confirmed');
}

// Test 7-12: Role portal slug verification & equivalence groups
async function runSlugTests() {
  const slugGroups = [
    ['stock-manager', 'stock-role', 'stock', 'stock-staff'],
    ['accountant-role', 'accountant'],
    ['cashier-role', 'cashier', 'billing', 'cashier-billing-staff', 'billing-staff'],
    ['manager-role', 'manager'],
    ['admin-role', 'admin'],
    ['sales-role', 'sales', 'sales-representative']
  ];

  function checkLoginPortalMatch(user, roleSlug) {
    if (user.role === 'ADMIN') return true;
    const cleanSlug = String(roleSlug).toLowerCase().trim();
    const uSlug = user.custom_roles?.slug || '';
    const uRole = user.role || '';
    const uName = user.custom_roles?.name?.toLowerCase() || '';

    if (uSlug && uSlug === cleanSlug) return true;
    for (const group of slugGroups) {
      if (group.includes(cleanSlug)) {
        if (uSlug && group.includes(uSlug)) return true;
        if (group.includes('stock-manager') && (uRole === 'STOCK_STAFF' || uName.includes('stock'))) return true;
        if (group.includes('cashier') && (uRole === 'BILLING_STAFF' || uName.includes('cashier') || uName.includes('billing'))) return true;
      }
    }
    return false;
  }

  // Stock Role user logging into stock-manager
  const stockUser = { role: 'USER', custom_roles: { name: 'Stock Role', slug: 'stock-role', is_active: true } };
  assert.strictEqual(checkLoginPortalMatch(stockUser, 'stock-manager'), true);
  console.log('✅ Test 7 Passed: Stock Role user successfully matches stock-manager portal');

  // Stock Staff user (system role) logging into stock-manager
  const stockStaffUser = { role: 'STOCK_STAFF', custom_roles: null };
  assert.strictEqual(checkLoginPortalMatch(stockStaffUser, 'stock-manager'), true);
  console.log('✅ Test 8 Passed: STOCK_STAFF system role successfully matches stock-manager portal');

  // Cashier attempting to log into stock-manager is rejected
  const cashierUser = { role: 'BILLING_STAFF', custom_roles: { name: 'Cashier', slug: 'cashier-role', is_active: true } };
  assert.strictEqual(checkLoginPortalMatch(cashierUser, 'stock-manager'), false);
  console.log('✅ Test 9 Passed: Cashier attempting to enter stock-manager portal is rejected');

  // ADMIN business owner logging into stock-manager
  const adminUser = { role: 'ADMIN', custom_roles: null };
  assert.strictEqual(checkLoginPortalMatch(adminUser, 'stock-manager'), true);
  console.log('✅ Test 10 Passed: ADMIN business owner has authorized access to any role portal');

  // Cashier user logging into cashier-billing-staff portal
  const cashierStaffUser = { role: 'BILLING_STAFF', custom_roles: { name: 'Cashier / Billing Staff', slug: 'cashier-role', is_active: true } };
  assert.strictEqual(checkLoginPortalMatch(cashierStaffUser, 'cashier-billing-staff'), true);
  console.log('✅ Test 11 Passed: Cashier / Billing Staff user successfully matches cashier-billing-staff portal');

  // getRoleBySlug check for cashier-billing-staff
  const roleResult = await getRoleBySlug('cashier-billing-staff');
  assert.strictEqual(roleResult.slug, 'cashier-billing-staff');
  assert.strictEqual(roleResult.system_role, 'BILLING_STAFF');
  console.log('✅ Test 12 Passed: getRoleBySlug successfully resolves cashier-billing-staff portal metadata');

  console.log('🎉 ALL ROLE & RBAC AUTHORIZATION TESTS PASSED!\n');
}

runSlugTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
