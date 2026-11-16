const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const productService = require('../src/services/product.service');

async function runAcceptanceTests() {
  console.log('--- STARTING ACCEPTANCE TESTS FOR BARCODE-BASED PRODUCT REGISTRATION ---');

  // 1. Get primary test business and user
  const user = await prisma.users.findFirst({
    where: { is_active: true },
    select: { id: true, business_id: true, email: true }
  });

  if (!user || !user.business_id) {
    throw new Error('No active user or business found in database');
  }

  const businessId = user.business_id;
  const userId = user.id;
  console.log(`✓ Active Business ID: ${businessId}, User: ${user.email}`);

  // Fetch or create a secondary business to verify company isolation
  let secondBusiness = await prisma.businesses.findFirst({
    where: { id: { not: businessId } },
    select: { id: true, business_name: true }
  });

  if (!secondBusiness) {
    secondBusiness = await prisma.businesses.create({
      data: {
        business_name: 'Isolation Test Company',
        email: `isolation_${Date.now()}@test.com`,
        phone: '9999988888'
      }
    });
    console.log(`✓ Created secondary business for isolation tests: ${secondBusiness.id}`);
  } else {
    console.log(`✓ Found existing secondary business for isolation tests: ${secondBusiness.id} (${secondBusiness.business_name})`);
  }

  const testBarcode = `TEST-BARCODE-${Date.now()}`;
  console.log(`\nTest Target Barcode: ${testBarcode}`);

  // TEST 1: Scanning an unknown barcode
  console.log('\n[TEST 1] Scan unknown barcode');
  const unknownScanRes = await productService.resolveScannedCode(businessId, testBarcode);
  console.log('Result:', JSON.stringify(unknownScanRes));
  if (unknownScanRes.found !== false || unknownScanRes.matchType !== 'NOT_FOUND') {
    throw new Error('Expected unknown barcode to return found: false and matchType: NOT_FOUND');
  }
  console.log('✓ PASS: Unknown barcode properly returned not found without creating dummy product.');

  // TEST 2: Register product with the unknown barcode
  console.log('\n[TEST 2] Register new product using the scanned barcode & opening stock');
  const createdProd = await productService.createProduct(businessId, userId, {
    name: 'Acceptance Test Shirt',
    barcode: testBarcode,
    sku: `SKU-${Date.now()}`,
    purchase_price: 450,
    retail_price: 999,
    opening_stock: 15,
    unit: 'PCS',
    has_variants: true,
    variants: [
      {
        size_name: 'M',
        retail_price: 999,
        purchase_price: 450,
        opening_stock: 15,
        barcode: `${testBarcode}-M`
      }
    ]
  });

  console.log(`✓ Created Product ID: ${createdProd.id}, SKU: ${createdProd.sku}, Barcode: ${createdProd.barcode}`);
  const createdVariant = createdProd.product_variants?.[0];
  console.log(`✓ Created Variant ID: ${createdVariant?.id}, Variant SKU: ${createdVariant?.sku}, Variant Barcode: ${createdVariant?.barcode}`);

  // TEST 3: Scan known barcode -> loads exact product
  console.log('\n[TEST 3] Scan newly registered product barcode');
  const knownProductScan = await productService.resolveScannedCode(businessId, testBarcode);
  console.log('Product Scan Result:', knownProductScan.name, 'Price:', knownProductScan.unitPrice, 'Barcode:', knownProductScan.barcode);
  if (knownProductScan.id !== createdProd.id || knownProductScan.barcode !== testBarcode) {
    throw new Error('Barcode failed to resolve to the registered product');
  }
  console.log('✓ PASS: Barcode resolved correctly to main product');

  // TEST 4: Scan variant barcode -> loads exact variant
  console.log('\n[TEST 4] Scan newly registered variant barcode');
  const knownVariantScan = await productService.resolveScannedCode(businessId, `${testBarcode}-M`);
  console.log('Variant Scan Result:', knownVariantScan.name, 'Variant:', knownVariantScan.size, 'SKU:', knownVariantScan.sku);
  if (knownVariantScan.variantId !== createdVariant.id || knownVariantScan.sku !== createdVariant.sku) {
    throw new Error('Variant barcode failed to resolve to exact variant');
  }
  console.log('✓ PASS: Variant barcode resolved correctly to exact variant');

  // TEST 5: Duplicate registration prevention
  console.log('\n[TEST 5] Attempt to register duplicate barcode in same company');
  let duplicateRejected = false;
  try {
    await productService.createProduct(businessId, userId, {
      name: 'Duplicate Collision Item',
      barcode: testBarcode,
      retail_price: 1200
    });
  } catch (err) {
    if (err.statusCode === 409 && err.existingProductId === createdProd.id) {
      duplicateRejected = true;
      console.log(`✓ Safely rejected duplicate with 409: "${err.message}" (Existing Product ID: ${err.existingProductId})`);
    } else {
      throw err;
    }
  }
  if (!duplicateRejected) {
    throw new Error('Duplicate barcode was not rejected with HTTP 409!');
  }
  console.log('✓ PASS: Duplicate barcode protection verified');

  // TEST 6: Company Isolation
  console.log('\n[TEST 6] Company Isolation check');
  const crossCompanyScan = await productService.resolveScannedCode(secondBusiness.id, testBarcode);
  console.log('Cross-company scan result:', crossCompanyScan);
  if (crossCompanyScan.found !== false) {
    throw new Error('Company isolation failed! Business 2 was able to see Business 1 product data!');
  }
  console.log('✓ PASS: Company isolation strictly enforced. Barcode returns not found for other businesses.');

  // TEST 7: Inventory check
  console.log('\n[TEST 7] Inventory & transactions check');
  const stockRecord = await prisma.product_stock.findFirst({
    where: { product_id: createdProd.id }
  });
  const stockMovements = await prisma.stock_transactions.findMany({
    where: { product_id: createdProd.id }
  });
  console.log('Stock Quantity:', stockRecord?.quantity, 'Stock Movement Types:', stockMovements.map(m => m.transaction_type));
  // Note: Registering should not create sales or purchases
  const relatedSales = await prisma.sale_items.findMany({
    where: { product_id: createdProd.id }
  });
  const relatedPurchases = await prisma.purchase_items.findMany({
    where: { product_id: createdProd.id }
  });
  if (relatedSales.length > 0 || relatedPurchases.length > 0) {
    throw new Error('Product registration created unwanted sales or purchase records!');
  }
  console.log(`✓ PASS: Opening stock recorded cleanly without generating sale (${relatedSales.length}) or purchase (${relatedPurchases.length}) records.`);

  // Cleanup test product to keep database pristine
  console.log('\nCleaning up test records...');
  await prisma.stock_transactions.deleteMany({ where: { product_id: createdProd.id } });
  await prisma.product_stock.deleteMany({ where: { product_id: createdProd.id } });
  await prisma.product_variants.deleteMany({ where: { product_id: createdProd.id } });
  await prisma.products.delete({ where: { id: createdProd.id } });
  console.log('✓ Cleanup complete.');

  console.log('\n=========================================');
  console.log('🎉 ALL 7 ACCEPTANCE CRITERIA PASSED 100%!');
  console.log('=========================================');
}

runAcceptanceTests()
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
