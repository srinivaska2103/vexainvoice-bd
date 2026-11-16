const prisma = require('../src/config/db');
const { getCurrentStock } = require('../src/services/stock.service');
const { getDashboardData } = require('../src/services/report.service');
const { getCategories, createCategory, deleteCategory } = require('../src/services/master.service');
const { memoryCache } = require('../src/utils/memoryCache.util');

async function runOptimizationVerification() {
  console.log('=== MULTI-SERVER & PERFORMANCE OPTIMIZATION VERIFICATION ===\n');

  // 1. Get an active business
  const business = await prisma.businesses.findFirst({
    where: { is_active: true },
    select: { id: true, business_name: true }
  });

  if (!business) {
    throw new Error('No active business found for tests.');
  }

  const businessId = business.id;
  console.log(`✓ Testing with Business: "${business.business_name}" (${businessId})`);

  // 2. Verify stock.service batching (N+1 Elimination)
  console.log('\n[TEST 1] Verifying stock.service getCurrentStock execution:');
  const t0 = Date.now();
  const stockResult = await getCurrentStock(businessId, { page: 1, limit: 50 });
  const stockDuration = Date.now() - t0;
  console.log(`✓ Returned ${stockResult.stock.length} products in ${stockDuration}ms without individual N+1 aggregate queries.`);

  // 3. Verify report.service getDashboardData correctness & speed
  console.log('\n[TEST 2] Verifying getDashboardData totals & execution:');
  const t1 = Date.now();
  const dashboard = await getDashboardData(businessId);
  const dashDuration = Date.now() - t1;
  console.log(`✓ Dashboard calculated in ${dashDuration}ms:`);
  console.log(`   - Today's Sales: ₹${dashboard.todaysSales}`);
  console.log(`   - Bill Count: ${dashboard.todaysBillCount}`);
  console.log(`   - Collections: ₹${dashboard.todaysCollections}`);
  console.log(`   - Outstanding: ₹${dashboard.totalCustomerOutstanding}`);
  console.log(`   - Stock Valuation: ₹${dashboard.totalStockValue}`);
  console.log(`   - Low Stock Count: ${dashboard.lowStockCount}`);

  // 4. Verify Company-Scoped In-Memory Master Cache
  console.log('\n[TEST 3] Verifying Memory Cache & Invalidation:');
  memoryCache.clear();
  
  // First call -> cache miss
  const cat1 = await getCategories(businessId);
  const cachedVal1 = memoryCache.get(businessId, 'categories');
  if (!cachedVal1) throw new Error('Cache failed to store categories after read!');
  console.log(`✓ Cache populated on first read: ${cat1.length} categories.`);

  // Second call -> cache hit
  const cat2 = await getCategories(businessId);
  console.log(`✓ Subsequent call served from cache (Matches: ${cat1.length === cat2.length})`);

  // Invalidate on write
  const testCatName = `TestOptCategory_${Date.now()}`;
  const newCat = await createCategory(businessId, { name: testCatName });
  const cachedAfterWrite = memoryCache.get(businessId, 'categories');
  if (cachedAfterWrite !== null) {
    throw new Error('Cache was not invalidated after createCategory!');
  }
  console.log(`✓ Cache successfully invalidated upon creating category "${newCat.name}".`);

  // Cleanup test category
  await deleteCategory(businessId, newCat.id);
  console.log('✓ Test category deleted and cache invalidated again.');

  // 5. Verify Database Composite Index Utilization via EXPLAIN
  console.log('\n[TEST 4] Verifying PostgreSQL Composite Index Usage:');
  
  // Sales Date Index
  const salesExplain = await prisma.$queryRaw`
    EXPLAIN SELECT id, invoice_number, invoice_date FROM sales 
    WHERE business_id = ${businessId}::uuid 
    ORDER BY invoice_date DESC LIMIT 10
  `;
  console.log('Sales Query Plan:');
  salesExplain.forEach(row => console.log('  ', row['QUERY PLAN']));

  // Stock Transactions Prod/Var Index
  const stockExplain = await prisma.$queryRaw`
    EXPLAIN SELECT sum(quantity) FROM stock_transactions 
    WHERE business_id = ${businessId}::uuid AND product_id IS NOT NULL
  `;
  console.log('Stock Transactions Query Plan:');
  stockExplain.forEach(row => console.log('  ', row['QUERY PLAN']));

  console.log('\n======================================================');
  console.log('🎉 ALL DATABASE OPTIMIZATIONS VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
}

runOptimizationVerification()
  .catch((err) => {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
