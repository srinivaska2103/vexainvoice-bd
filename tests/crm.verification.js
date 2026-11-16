const prisma = require('../src/config/db');
const crmService = require('../src/services/crm.service');

async function testCrmEngine() {
  console.log('--- STARTING CRM VERIFICATION TEST ---');

  // 1. Fetch first business
  const business = await prisma.businesses.findFirst();
  if (!business) {
    console.log('❌ No business found in DB');
    process.exit(1);
  }
  const businessId = business.id;
  console.log(`✅ Business found: ${business.business_name} (${businessId})`);

  // 2. Test Dashboard Metrics
  const dashboard = await crmService.getDashboardMetrics(businessId);
  console.log('✅ CRM Dashboard Metrics calculated successfully:');
  console.log(`   - Total Customers: ${dashboard.totalCustomers}`);
  console.log(`   - New Customers (30d): ${dashboard.newCustomers}`);
  console.log(`   - Repeat Customers: ${dashboard.repeatCustomers}`);
  console.log(`   - Inactive Customers: ${dashboard.inactiveCustomers}`);
  console.log(`   - High Value Customers: ${dashboard.highValueCustomers}`);
  console.log(`   - With Outstanding: ${dashboard.customersWithOutstanding}`);
  console.log(`   - Today's Follow-ups: ${dashboard.todayFollowups}`);
  console.log(`   - Overdue Follow-ups: ${dashboard.overdueFollowups}`);

  // 3. Test CRM Customers List
  const customersRes = await crmService.getCrmCustomers(businessId, { limit: 5 });
  console.log(`✅ CRM Customers List fetched (${customersRes.customers.length} items)`);

  // 4. Test Customer 360 if customer exists
  if (customersRes.customers.length > 0) {
    const cust = customersRes.customers[0];
    const c360 = await crmService.getCustomer360(businessId, cust.id);
    console.log(`✅ Customer 360 fetched for ${c360.customer.name}:`);
    console.log(`   - Total Purchases: ₹${c360.summary.totalPurchases}`);
    console.log(`   - Total Paid: ₹${c360.summary.totalPaid}`);
    console.log(`   - Outstanding: ₹${c360.summary.outstanding}`);
    console.log(`   - Orders Count: ${c360.summary.totalOrders}`);
    console.log(`   - Has Purchase Pattern: ${c360.purchasePattern.hasEnoughData}`);
    if (c360.purchasePattern.hasEnoughData) {
      console.log(`   - Avg Interval: ${c360.purchasePattern.avgIntervalDays} days`);
      console.log(`   - Opportunity: ${c360.purchasePattern.followUpOpportunity}`);
    }

    // 5. Test Note creation
    const user = await prisma.users.findFirst({ where: { business_id: businessId } });
    const userId = user ? user.id : null;
    const note = await crmService.createCustomerNote(businessId, userId, {
      customer_id: cust.id,
      note: 'Verification test note: Customer interested in new textile inventory'
    });
    console.log(`✅ Customer note created: ID ${note.id}`);

    // 6. Test Follow-up creation & completion
    const followup = await crmService.createFollowup(businessId, userId, {
      customer_id: cust.id,
      type: 'Call',
      reason: 'Verification test follow-up call',
      due_date: new Date().toISOString(),
      priority: 'HIGH'
    });
    console.log(`✅ Follow-up created: ID ${followup.id}`);

    const updatedFollowup = await crmService.updateFollowup(businessId, followup.id, userId, {
      status: 'COMPLETED',
      completion_notes: 'Follow-up call completed in test'
    });
    console.log(`✅ Follow-up updated to COMPLETED: ID ${updatedFollowup.id}`);
  }

  // 7. Test Segment Filter Evaluation
  const segmentResult = await crmService.evaluateSegmentFilters(businessId, {
    minPurchaseValue: '100'
  });
  console.log(`✅ Segment filter evaluated: ${segmentResult.length} matching customers`);

  // 8. Test Product Insights
  const insights = await crmService.getProductInsights(businessId);
  console.log(`✅ Product insights calculated (${insights.topProducts.length} top products, ${insights.frequentlyBoughtTogether.length} cross-sell pairs)`);

  console.log('--- CRM VERIFICATION SUCCESSFUL ---');
  process.exit(0);
}

testCrmEngine().catch(err => {
  console.error('❌ CRM Verification Failed:', err);
  process.exit(1);
});
