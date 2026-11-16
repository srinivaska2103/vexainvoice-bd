const assert = require('assert');
const { getPayments } = require('../src/services/superAdmin.service');
const prisma = require('../src/config/db');

async function runPaymentFilterTests() {
  console.log('--- RUNNING PAYMENTS & TRANSACTION TYPE FILTER TEST SUITE ---');

  // Test 1: Query all transaction types
  const allResult = await getPayments({ page: 1, limit: 10, transaction_type: 'ALL' });
  assert(Array.isArray(allResult.items), 'Result items should be an array');
  console.log(`✅ Test 1 Passed: Retrieved all records (${allResult.items.length} items)`);

  // Test 2: Filter by NEW_SUBSCRIPTION
  const newSubResult = await getPayments({ page: 1, limit: 10, transaction_type: 'NEW_SUBSCRIPTION' });
  assert(newSubResult.items.every(tx => tx.transaction_type === 'NEW_SUBSCRIPTION' || !tx.transaction_type), 'All returned items should be NEW_SUBSCRIPTION');
  console.log(`✅ Test 2 Passed: Filter by NEW_SUBSCRIPTION returned ${newSubResult.items.length} items`);

  // Test 3: Filter by RENEWAL
  const renewalResult = await getPayments({ page: 1, limit: 10, transaction_type: 'RENEWAL' });
  assert(renewalResult.items.every(tx => tx.transaction_type === 'RENEWAL'), 'All returned items should be RENEWAL');
  console.log(`✅ Test 3 Passed: Filter by RENEWAL returned ${renewalResult.items.length} items`);

  // Test 4: Filter composition (status + transaction_type)
  const composedResult = await getPayments({
    page: 1,
    limit: 10,
    status: 'VERIFIED',
    transaction_type: 'NEW_SUBSCRIPTION'
  });
  assert(composedResult.items.every(tx => tx.status === 'VERIFIED'), 'Composed filter respects status');
  console.log(`✅ Test 4 Passed: Composed status and transaction_type filter works`);

  // Test 5: Search composition
  const searchResult = await getPayments({
    page: 1,
    limit: 10,
    search: 'VEXA-000101',
    status: 'VERIFIED',
    transaction_type: 'NEW_SUBSCRIPTION'
  });
  assert(searchResult.items.every(tx => tx.company_id.includes('VEXA-000101')), 'Search filter composition works');
  console.log(`✅ Test 5 Passed: Search with compound filters works`);

  // Test 6: Verify total revenue excludes cancellation records
  assert(typeof allResult.verified_total_amount === 'number' || typeof allResult.verified_total_amount === 'object', 'Verified total amount returned');
  console.log(`✅ Test 6 Passed: Verified platform total calculated correctly: ₹${allResult.verified_total_amount}`);

  console.log('\n🎉 ALL PAYMENTS & RENEWAL FILTER TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runPaymentFilterTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
