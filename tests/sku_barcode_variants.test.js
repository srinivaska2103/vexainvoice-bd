const assert = require('assert');
const prisma = require('../src/config/db');
const productService = require('../src/services/product.service');
const {
  deriveProductCode,
  deriveSizeCode,
  getHighestSequenceFromSkus,
  formatSequence
} = require('../src/utils/skuGenerator.util');

async function runTests() {
  console.log('=== RUNNING SKU & BARCODE TESTS ===');

  // Test 1: Unit tests for SKU generator utilities
  console.log('\n--- 1. Testing skuGenerator Utility ---');
  assert.strictEqual(deriveProductCode({ name: 'Shirt', brands: { name: 'OTTO' }, categories: { name: 'Shirt' } }), 'OTTO-SHIRT');
  assert.strictEqual(deriveSizeCode('S'), 'S');
  assert.strictEqual(deriveSizeCode('XL'), 'XL');
  assert.strictEqual(deriveSizeCode('32'), '32');
  assert.strictEqual(formatSequence(1), '001');
  assert.strictEqual(formatSequence(42), '042');
  assert.strictEqual(formatSequence(999), '999');

  const skus = ['OTTO-SHIRT-S-001', 'OTTO-SHIRT-S-002', 'OTTO-SHIRT-M-001', 'OTHER-S-005'];
  assert.strictEqual(getHighestSequenceFromSkus(skus, 'OTTO-SHIRT-S'), 2);
  assert.strictEqual(getHighestSequenceFromSkus(skus, 'OTTO-SHIRT-M'), 1);
  assert.strictEqual(getHighestSequenceFromSkus(skus, 'OTTO-SHIRT-L'), 0);
  console.log('✓ skuGenerator unit assertions passed.');

  // Test 2: Database integrated test
  console.log('\n--- 2. Testing Product Creation & Variant Generation in DB ---');
  const business = await prisma.businesses.findFirst();
  if (!business) {
    throw new Error('No business found to run integration test.');
  }

  const brand = await prisma.brands.findFirst({ where: { business_id: business.id } }) ||
    await prisma.brands.create({ data: { business_id: business.id, name: 'OTTO' } });

  const category = await prisma.categories.findFirst({ where: { business_id: business.id } }) ||
    await prisma.categories.create({ data: { business_id: business.id, name: 'Shirt' } });

  let sizeS = await prisma.sizes.findFirst({ where: { business_id: business.id, name: 'S' } });
  if (!sizeS) sizeS = await prisma.sizes.create({ data: { business_id: business.id, name: 'S' } });

  let sizeM = await prisma.sizes.findFirst({ where: { business_id: business.id, name: 'M' } });
  if (!sizeM) sizeM = await prisma.sizes.create({ data: { business_id: business.id, name: 'M' } });

  let sizeL = await prisma.sizes.findFirst({ where: { business_id: business.id, name: 'L' } });
  if (!sizeL) sizeL = await prisma.sizes.create({ data: { business_id: business.id, name: 'L' } });

  let colorBlue = await prisma.colors.findFirst({ where: { business_id: business.id, name: 'Blue' } });
  if (!colorBlue) colorBlue = await prisma.colors.create({ data: { business_id: business.id, name: 'Blue', hex_code: '#0000FF' } });

  let colorRed = await prisma.colors.findFirst({ where: { business_id: business.id, name: 'Red' } });
  if (!colorRed) colorRed = await prisma.colors.create({ data: { business_id: business.id, name: 'Red', hex_code: '#FF0000' } });

  const testUniqueTag = Date.now();
  const testProductName = `Test Product ${testUniqueTag}`;

  // Create product with multiple variants: S, S, M, L
  const product = await productService.createProduct(business.id, null, {
    name: testProductName,
    brand_id: brand.id,
    category_id: category.id,
    sku: `TEST-SHIRT-${testUniqueTag}`,
    purchase_price: 100,
    retail_price: 250,
    has_variants: true,
    variants: [
      { size_id: sizeS.id, color_id: colorBlue.id, opening_stock: 10 },
      { size_id: sizeS.id, color_id: colorRed.id, opening_stock: 5 },
      { size_id: sizeM.id, color_id: colorBlue.id, opening_stock: 8 },
      { size_id: sizeL.id, color_id: colorBlue.id, opening_stock: 12 }
    ]
  });

  console.log(`Created product: ${product.name} (id: ${product.id})`);
  const variants = await productService.getVariantsByProductId(business.id, product.id);
  console.log('Created variants count:', variants.length);

  variants.forEach(v => {
    console.log(`- Variant: size=${v.size}, color=${v.color}, SKU=${v.sku}, Barcode=${v.barcode}`);
  });

  const vS1 = variants.find(v => v.size === 'S' && v.color === 'Blue');
  const vS2 = variants.find(v => v.size === 'S' && v.color === 'Red');
  const vM1 = variants.find(v => v.size === 'M' && v.color === 'Blue');
  const vL1 = variants.find(v => v.size === 'L' && v.color === 'Blue');

  assert.ok(vS1, 'Variant S-1 exists');
  assert.ok(vS2, 'Variant S-2 exists');
  assert.ok(vM1, 'Variant M-1 exists');
  assert.ok(vL1, 'Variant L-1 exists');

  // Verify format: PRODUCTCODE-SIZE-SEQUENCE
  assert.ok(vS1.sku.endsWith('-S-001'), `Expected S-1 to end with -S-001, got ${vS1.sku}`);
  assert.ok(vS2.sku.endsWith('-S-002'), `Expected S-2 to end with -S-002, got ${vS2.sku}`);
  assert.ok(vM1.sku.endsWith('-M-001'), `Expected M-1 to end with -M-001, got ${vM1.sku}`);
  assert.ok(vL1.sku.endsWith('-L-001'), `Expected L-1 to end with -L-001, got ${vL1.sku}`);

  // Barcode should match SKU
  assert.strictEqual(vS1.barcode, vS1.sku, 'Barcode matches generated SKU');
  assert.strictEqual(vS2.barcode, vS2.sku, 'Barcode matches generated SKU');

  // Test 3: Adding another variant subsequently to test auto-increment
  console.log('\n--- 3. Testing subsequent addVariant for same product & size ---');
  const addedVariantS3 = await productService.addVariant(business.id, product.id, null, {
    size_id: sizeS.id,
    color_id: colorBlue.id,
    opening_stock: 4
  });
  console.log(`Added 3rd S variant: SKU=${addedVariantS3.sku}, Barcode=${addedVariantS3.barcode}`);
  assert.ok(addedVariantS3.sku.endsWith('-S-003'), `Expected 3rd S variant to end with -S-003, got ${addedVariantS3.sku}`);

  // Test 4: Barcode and SKU scanner resolution
  console.log('\n--- 4. Testing resolveScannedCode on variant SKU and Barcode ---');
  const resolvedBySku = await productService.resolveScannedCode(business.id, vS1.sku);
  assert.strictEqual(resolvedBySku.matchType, 'MODERN_VARIANT', 'Matches MODERN_VARIANT by SKU');
  assert.strictEqual(resolvedBySku.variantId, vS1.id, 'Resolves to correct variant ID');
  assert.strictEqual(resolvedBySku.size, 'S', 'Resolves correct size');

  const resolvedByBarcode = await productService.resolveScannedCode(business.id, vS2.barcode);
  assert.strictEqual(resolvedByBarcode.matchType, 'MODERN_VARIANT', 'Matches MODERN_VARIANT by Barcode');
  assert.strictEqual(resolvedByBarcode.variantId, vS2.id, 'Resolves to correct variant ID');
  assert.strictEqual(resolvedByBarcode.color, 'Red', 'Resolves correct color');
  console.log('✓ Scanner resolved variant barcode and SKU accurately.');

  // Test 5: Concurrency safety
  console.log('\n--- 5. Testing concurrent variant creation safety ---');
  const concurrentPromises = [
    productService.addVariant(business.id, product.id, null, { size_id: sizeM.id, color_id: colorRed.id }),
    productService.addVariant(business.id, product.id, null, { size_id: sizeM.id, color_id: colorBlue.id })
  ];

  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentSkus = concurrentResults.map(r => r.sku);
  console.log('Concurrent SKUs created for M:', concurrentSkus);
  assert.notStrictEqual(concurrentSkus[0], concurrentSkus[1], 'Concurrent SKUs are distinct and unique');

  // Cleanup test product
  await prisma.product_variants.deleteMany({ where: { product_id: product.id } });
  await prisma.stock_transactions.deleteMany({ where: { product_id: product.id } });
  await prisma.products.delete({ where: { id: product.id } });
  console.log('✓ Cleaned up test records.');

  console.log('\nALL SKU & BARCODE TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
