const assert = require('assert');
const prisma = require('../src/config/db');
const roleService = require('../src/services/role.service');
const userService = require('../src/services/user.service');
const authService = require('../src/services/auth.service');
const bcrypt = require('bcryptjs');

async function runRoleAndDynamicLoginTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING DYNAMIC ROLE & DYNAMIC LOGIN URLs TEST SUITE');
  console.log('======================================================');

  // Find or create test company
  let business = await prisma.businesses.findFirst({
    where: { is_active: true }
  });

  assert(business, 'Active business must exist for test');
  const businessId = business.id;

  // 1. Test: Generate URL-safe role slug
  console.log('\n▶️ Test 1: Generate clean, URL-safe role slug');
  const slug1 = roleService.generateRoleSlug('Branch Supervisor');
  assert.strictEqual(slug1, 'branch-supervisor', 'Slug should be branch-supervisor');
  const slug2 = roleService.generateRoleSlug('Senior Cashier & Billing 2026!');
  assert.strictEqual(slug2, 'senior-cashier-billing-2026', 'Slug should filter special chars and be hyphenated');
  console.log('✅ Test 1 Passed: Slugs generated safely and cleanly');

  // 2. Test: Prevent creating custom role named ADMIN
  console.log('\n▶️ Test 2: Prevent creating custom role named ADMIN');
  try {
    await roleService.createRole(businessId, { name: 'ADMIN', permissions: ['dashboard.view'] });
    assert.fail('Should have failed to create custom ADMIN role');
  } catch (err) {
    assert(err.message.includes('Cannot create or override the ADMIN system role'), 'Should forbid ADMIN name');
  }
  console.log('✅ Test 2 Passed: Custom ADMIN role creation successfully forbidden');

  // 3. Test: Create unique custom role with permitted modules & slug
  console.log('\n▶️ Test 3: Create custom role with permissions');
  const testRoleName = `Supervisor ${Date.now()}`;
  const createdRole = await roleService.createRole(businessId, {
    name: testRoleName,
    description: 'Floor and branch operations supervisor',
    permissions: ['dashboard.view', 'sales.view', 'sales.create', 'stock.view']
  });

  assert(createdRole.id, 'Role should have ID');
  assert(createdRole.slug, 'Role should have slug');
  assert(createdRole.login_url.startsWith('/company/'), 'Login URL should follow /company/[slug]/login');
  assert.strictEqual(createdRole.permissions.length, 4, 'Should save 4 permissions');
  console.log(`✅ Test 3 Passed: Role created with login URL: ${createdRole.login_url}`);

  // 4. Test: Prevent duplicate role slug in same company
  console.log('\n▶️ Test 4: Prevent duplicate role slug within company');
  try {
    await roleService.createRole(businessId, {
      name: testRoleName,
      permissions: ['dashboard.view']
    });
    assert.fail('Should have blocked duplicate role slug');
  } catch (err) {
    assert(err.statusCode === 409, 'Duplicate slug should throw 409');
  }
  console.log('✅ Test 4 Passed: Duplicate role slug blocked within company');

  // 5. Test: Public slug resolution
  console.log('\n▶️ Test 5: Resolve role by slug via public endpoint');
  const resolved = await roleService.getRoleBySlug(createdRole.slug);
  assert.strictEqual(resolved.name, testRoleName);
  assert.strictEqual(resolved.company.id, businessId);

  // System role slug resolution
  const resolvedCashier = await roleService.getRoleBySlug('cashier');
  assert.strictEqual(resolvedCashier.slug, 'cashier');
  assert.strictEqual(resolvedCashier.system_role, 'BILLING_STAFF');
  console.log('✅ Test 5 Passed: Role slugs resolved dynamically without code changes');

  // 6. Test: Unknown or inactive role slug throws 404
  console.log('\n▶️ Test 6: Unknown or inactive role slug throws 404');
  try {
    await roleService.getRoleBySlug('unknown-fake-role-slug-999');
    assert.fail('Should fail on unknown slug');
  } catch (err) {
    assert.strictEqual(err.statusCode, 404);
  }
  console.log('✅ Test 6 Passed: Unknown role slug correctly rejected with 404');

  // 7. Test: Create employee and assign custom role
  console.log('\n▶️ Test 7: Create employee assigned to custom role');
  const empEmail = `emp_${Date.now()}@testcompany.com`;
  const empPassword = 'Password@123';
  const newEmp = await userService.createUser(businessId, {
    name: 'Test Supervisor Employee',
    email: empEmail,
    password: empPassword,
    role: 'BILLING_STAFF',
    custom_role_id: createdRole.id
  });

  assert.strictEqual(newEmp.custom_role_id, createdRole.id);
  assert.strictEqual(newEmp.custom_role?.slug, createdRole.slug);
  console.log('✅ Test 7 Passed: Employee assigned to custom role successfully');

  // 8. Test: Login through matching role slug succeeds
  console.log('\n▶️ Test 8: Login through matching role slug succeeds');
  const loginRes = await authService.loginUser(empEmail, empPassword, createdRole.slug);
  assert(loginRes.token, 'Token should be issued');
  assert.strictEqual(loginRes.user.custom_role?.slug, createdRole.slug);
  assert.strictEqual(loginRes.user.permissions.length, 4);
  console.log('✅ Test 8 Passed: User successfully authenticated through role portal');

  // 9. Test: Login through MISMATCHED role slug fails with 403
  console.log('\n▶️ Test 9: Login through mismatched role slug is blocked with 403');
  try {
    await authService.loginUser(empEmail, empPassword, 'accountant');
    assert.fail('Should have failed login with wrong role slug');
  } catch (err) {
    assert.strictEqual(err.statusCode, 403);
    assert(err.message.includes('Access Denied'), 'Should reject with role mismatch message');
  }
  console.log('✅ Test 9 Passed: Mismatched role portal login blocked on backend');

  // 10. Test: Deactivating role prevents login through its URL
  console.log('\n▶️ Test 10: Deactivating role disables login URL');
  await roleService.updateRole(businessId, createdRole.id, { is_active: false });
  try {
    await roleService.getRoleBySlug(createdRole.slug);
    assert.fail('Inactive role slug should not resolve');
  } catch (err) {
    assert.strictEqual(err.statusCode, 404);
  }

  // Cleanup test user and role
  await prisma.users.delete({ where: { id: newEmp.id } });
  await prisma.custom_roles.delete({ where: { id: createdRole.id } });

  console.log('✅ Test 10 Passed: Inactive role login URL safely disabled');

  console.log('\n🎉 ALL DYNAMIC ROLE & DYNAMIC LOGIN URLs TESTS PASSED SUCCESSFULLY!\n');
}

runRoleAndDynamicLoginTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
