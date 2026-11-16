const prisma = require('../src/config/db');
const authService = require('../src/services/auth.service');
const productService = require('../src/services/product.service');
const saleService = require('../src/services/sale.service');
const purchaseService = require('../src/services/purchase.service');
const stockService = require('../src/services/stock.service');
const masterService = require('../src/services/master.service');
const supplierService = require('../src/services/supplier.service');

async function testStockAcceptanceFlow() {
  console.log('----------------------------------------------------');
  console.log('🧪 RUNNING EXACT ACCEPTANCE TEST: SALE -> STOCK FLOW');
  console.log('----------------------------------------------------');

  try {
    const time = Date.now();
    // 1. Setup Business & Colors/Sizes
    const regResult = await authService.registerBusinessAndAdmin({
      business_name: `Acceptance Store ${time}`,
      business_type: 'GARMENT_TEXTILE',
      email: `admin_${time}@acceptancestore.com`,
      admin_name: 'Test Admin',
      password: 'Password@123'
    });
    const businessId = regResult.business.id;
    const adminId = regResult.user.id;

    const colorBlue = await masterService.createColor(businessId, { name: `Blue_${time}` });
    const sizeM = await masterService.createSize(businessId, { name: `M_${time}`, sort_order: 1 });
    const supplier = await supplierService.createSupplier(businessId, { name: `Main Supplier ${time}` });

    // 2. Create Product: Slim T Shirt with variant Blue / M = 16 PCS
    const product = await productService.createProduct(businessId, adminId, {
      name: `Slim T Shirt ${time}`,
      sku: `SLIM-TSHIRT-${time}`,
      retail_price: 500,
      purchase_price: 300,
      has_variants: true,
      variants: [
        {
          color_id: colorBlue.id,
          size_id: sizeM.id,
          variant_name: 'Blue / M',
          opening_stock: 16
        }
      ]
    });

    const variants = await productService.getVariantsByProductId(businessId, product.id);
    const blueM = variants.find(v => v.variant_name === 'Blue / M' || (v.color === colorBlue.name && v.size === sizeM.name)) || variants[0];

    // Verify initial stock: 16 PCS
    const stockStep0 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vStock0 = stockStep0.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`[START] Initial Stock for Slim T Shirt (Blue / M): ${vStock0} PCS (Expected: 16)`);
    if (vStock0 !== 16) throw new Error(`Step 0 Failed! Expected 16, got ${vStock0}`);

    // STEP 1: Create Sale 2 PCS
    console.log('\n--- Step 1: Create Sale (2 PCS) ---');
    const sale1 = await saleService.createSale(businessId, adminId, {
      items: [
        {
          product_id: product.id,
          variant_id: blueM.id,
          quantity: 2,
          unit_price: 500
        }
      ]
    });
    
    // Verify DB & API after Sale
    const vDb1 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep1 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi1 = stockStep1.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb1.current_stock}, API/UI Stock: ${vApi1} (Expected: 14)`);
    if (Number(vDb1.current_stock) !== 14 || Number(vApi1) !== 14) {
      throw new Error(`Step 1 Sale Deduction Failed! DB=${vDb1.current_stock}, API=${vApi1}`);
    }
    console.log('✅ Step 1 Passed: Sale of 2 PCS correctly deducted stock (16 -> 14).');

    // STEP 2: Purchase +5 PCS
    console.log('\n--- Step 2: Purchase (+5 PCS) ---');
    await purchaseService.createPurchase(businessId, adminId, {
      supplier_id: supplier.id,
      items: [
        {
          product_id: product.id,
          variant_id: blueM.id,
          quantity: 5,
          unit_price: 300
        }
      ]
    });
    const vDb2 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep2 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi2 = stockStep2.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb2.current_stock}, API/UI Stock: ${vApi2} (Expected: 19)`);
    if (Number(vDb2.current_stock) !== 19 || Number(vApi2) !== 19) {
      throw new Error(`Step 2 Purchase Failed! DB=${vDb2.current_stock}, API=${vApi2}`);
    }
    console.log('✅ Step 2 Passed: Purchase of 5 PCS correctly added stock (14 -> 19).');

    // STEP 3: Sales Return +1 PCS
    console.log('\n--- Step 3: Sales Return (+1 PCS) ---');
    await saleService.returnSale(businessId, sale1.id, adminId, {
      returned_items: [
        {
          product_id: product.id,
          variant_id: blueM.id,
          quantity: 1
        }
      ]
    });
    const vDb3 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep3 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi3 = stockStep3.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb3.current_stock}, API/UI Stock: ${vApi3} (Expected: 20)`);
    if (Number(vDb3.current_stock) !== 20 || Number(vApi3) !== 20) {
      throw new Error(`Step 3 Sales Return Failed! DB=${vDb3.current_stock}, API=${vApi3}`);
    }
    console.log('✅ Step 3 Passed: Sales return of 1 PC correctly restored stock (19 -> 20).');

    // STEP 4: Purchase Return -3 PCS (Supplier Return)
    console.log('\n--- Step 4: Purchase Return (-3 PCS) ---');
    await stockService.createAdjustment(businessId, adminId, {
      product_id: product.id,
      variant_id: blueM.id,
      transaction_type: 'PURCHASE_RETURN',
      quantity: 3,
      notes: 'Supplier Return'
    });
    const vDb4 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep4 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi4 = stockStep4.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb4.current_stock}, API/UI Stock: ${vApi4} (Expected: 17)`);
    if (Number(vDb4.current_stock) !== 17 || Number(vApi4) !== 17) {
      throw new Error(`Step 4 Purchase Return Failed! DB=${vDb4.current_stock}, API=${vApi4}`);
    }
    console.log('✅ Step 4 Passed: Purchase return of 3 PCS correctly deducted stock (20 -> 17).');

    // STEP 5: Adjustment IN +2 PCS
    console.log('\n--- Step 5: Adjustment IN (+2 PCS) ---');
    await stockService.createAdjustment(businessId, adminId, {
      product_id: product.id,
      variant_id: blueM.id,
      transaction_type: 'ADJUSTMENT_IN',
      quantity: 2,
      notes: 'Physical count adjustment in'
    });
    const vDb5 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep5 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi5 = stockStep5.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb5.current_stock}, API/UI Stock: ${vApi5} (Expected: 19)`);
    if (Number(vDb5.current_stock) !== 19 || Number(vApi5) !== 19) {
      throw new Error(`Step 5 Adjustment IN Failed! DB=${vDb5.current_stock}, API=${vApi5}`);
    }
    console.log('✅ Step 5 Passed: Adjustment IN of 2 PCS correctly added stock (17 -> 19).');

    // STEP 6: Adjustment OUT -4 PCS
    console.log('\n--- Step 6: Adjustment OUT (-4 PCS) ---');
    await stockService.createAdjustment(businessId, adminId, {
      product_id: product.id,
      variant_id: blueM.id,
      transaction_type: 'ADJUSTMENT_OUT',
      quantity: 4,
      notes: 'Damaged item removal'
    });
    const vDb6 = await prisma.product_variants.findUnique({ where: { id: blueM.id } });
    const stockStep6 = await stockService.getCurrentStock(businessId, { search: product.name });
    const vApi6 = stockStep6.stock[0].variants.find(v => v.id === blueM.id).quantity;
    console.log(`DB Stock: ${vDb6.current_stock}, API/UI Stock: ${vApi6} (Expected: 15)`);
    if (Number(vDb6.current_stock) !== 15 || Number(vApi6) !== 15) {
      throw new Error(`Step 6 Adjustment OUT Failed! DB=${vDb6.current_stock}, API=${vApi6}`);
    }
    console.log('✅ Step 6 Passed: Adjustment OUT of 4 PCS correctly deducted stock (19 -> 15).');

    // STEP 7: Insufficient Stock Test (Attempt sale of 100 PCS when stock is 15)
    console.log('\n--- Step 7: Insufficient Stock Validation Test (Request 100 PCS when stock is 15) ---');
    try {
      await saleService.createSale(businessId, adminId, {
        items: [{ product_id: product.id, variant_id: blueM.id, quantity: 100, unit_price: 500 }]
      });
      throw new Error('Insufficient Stock test failed! Sale was created when it should have been rejected.');
    } catch (err) {
      if (err.message.includes('Insufficient stock')) {
        console.log('✅ Step 7 Passed: Backend correctly rejected sale due to insufficient stock:', err.message);
      } else {
        throw err;
      }
    }

    console.log('\n====================================================');
    console.log('🎉 ALL FINAL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
    console.log('Final stock matches across Database, Stock API, and Stock Management UI: 15 PCS');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ ACCEPTANCE TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testStockAcceptanceFlow();
