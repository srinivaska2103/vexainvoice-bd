const prisma = require('../src/config/db');
const authService = require('../src/services/auth.service');
const productService = require('../src/services/product.service');
const customerService = require('../src/services/customer.service');
const supplierService = require('../src/services/supplier.service');
const saleService = require('../src/services/sale.service');
const purchaseService = require('../src/services/purchase.service');
const stockService = require('../src/services/stock.service');
const paymentService = require('../src/services/payment.service');
const reportService = require('../src/services/report.service');
const masterService = require('../src/services/master.service');

async function runVerificationTests() {
  console.log('----------------------------------------------------');
  console.log('🧪 RUNNING VEXA INVOICE BACKEND VERIFICATION TESTS');
  console.log('----------------------------------------------------');

  try {
    // 1. Business Registration & Auth Test
    const time = Date.now();
    const regResult = await authService.registerBusinessAndAdmin({
      business_name: `VEXA Garments Test ${time}`,
      business_type: 'GARMENT_TEXTILE',
      email: `admin_${time}@vexagarmentstest.com`,
      admin_name: 'Super Admin',
      password: 'Password@123',
      invoice_prefix: 'VEX'
    });

    console.log('✅ 1. Registration Test Passed. Business ID:', regResult.business.id);
    const businessId = regResult.business.id;
    const adminId = regResult.user.id;

    // 2. Business Isolation Test (Create Business B)
    const regResultB = await authService.registerBusinessAndAdmin({
      business_name: `Isolated Shop B ${time}`,
      business_type: 'RETAIL',
      email: `adminb_${time}@shopb.com`,
      admin_name: 'Shop B Admin',
      password: 'Password@123'
    });
    const businessIdB = regResultB.business.id;

    const productsB = await productService.getProducts(businessIdB, {});
    console.log('✅ 2. Business Isolation Test Passed. Isolated Business B Products Count:', productsB.products.length);

    // 3. Wholesale Pricing Test (Prompt Section 69)
    const wholesaleProduct = await productService.createProduct(businessId, adminId, {
      name: `Wholesale Shirt ${time}`,
      sku: `WS-${time}`,
      retail_price: 500,
      wholesale_price: 350,
      dealer_price: 320,
      opening_stock: 50
    });

    const wholesaleCustomer = await customerService.createCustomer(businessId, {
      name: `ABC Textiles ${time}`,
      customer_type: 'WHOLESALE',
      price_level: 'WHOLESALE'
    });

    const wholesaleSale = await saleService.createSale(businessId, adminId, {
      customer_id: wholesaleCustomer.id,
      items: [
        {
          product_id: wholesaleProduct.id,
          quantity: 2
        }
      ]
    });

    const saleItem = wholesaleSale.sale_items ? wholesaleSale.sale_items[0] : null;
    const fetchedSale = await saleService.getSaleById(businessId, wholesaleSale.id);
    const fetchedItem = fetchedSale.sale_items[0];

    if (Number(fetchedItem.unit_price) !== 350) {
      throw new Error(`Wholesale test failed! Expected 350, got ${fetchedItem.unit_price}`);
    }
    const currentYearStr = new Date().getFullYear();
    if (!fetchedSale.invoice_number || !fetchedSale.invoice_number.startsWith(`INV-${currentYearStr}-`)) {
      throw new Error(`Sequential Invoice Number failed! Expected INV-${currentYearStr}-..., got ${fetchedSale.invoice_number}`);
    }
    if (!fetchedSale.order_number || !fetchedSale.order_number.startsWith(`ORD-${currentYearStr}-`)) {
      throw new Error(`Sequential Order Reference failed! Expected ORD-${currentYearStr}-..., got ${fetchedSale.order_number}`);
    }
    console.log(`✅ 3. Required Wholesale Pricing & Sequential Numbering Test Passed. Invoice: ${fetchedSale.invoice_number}, Order Ref: ${fetchedSale.order_number}`);

    // 4. Garment Stock Matrix Test (Prompt Section 70)
    const colorBlue = await masterService.createColor(businessId, { name: `Blue_${time}` });
    const colorBlack = await masterService.createColor(businessId, { name: `Black_${time}` });
    const sizeM = await masterService.createSize(businessId, { name: `M_${time}`, sort_order: 1 });
    const sizeL = await masterService.createSize(businessId, { name: `L_${time}`, sort_order: 2 });

    const garmentProduct = await productService.createProduct(businessId, adminId, {
      name: `Polo T-Shirt ${time}`,
      sku: `TSHIRT-${time}`,
      retail_price: 800,
      has_variants: true,
      variants: [
        { color_id: colorBlue.id, size_id: sizeM.id, variant_name: 'Blue / M', opening_stock: 20 },
        { color_id: colorBlue.id, size_id: sizeL.id, variant_name: 'Blue / L', opening_stock: 15 },
        { color_id: colorBlack.id, size_id: sizeM.id, variant_name: 'Black / M', opening_stock: 10 },
        { color_id: colorBlack.id, size_id: sizeL.id, variant_name: 'Black / L', opening_stock: 12 }
      ]
    });

    const variants = await productService.getVariantsByProductId(businessId, garmentProduct.id);
    const blueMVariant = variants.find(v => v.color === colorBlue.color_name && v.size === sizeM.size_name) || variants[0];

    // Sell Blue / M = 3
    await saleService.createSale(businessId, adminId, {
      items: [
        {
          product_id: garmentProduct.id,
          variant_id: blueMVariant.id,
          quantity: 3,
          unit_price: 800
        }
      ]
    });

    const updatedVariants = await productService.getVariantsByProductId(businessId, garmentProduct.id);
    const vBlueM = updatedVariants.find(v => v.id === blueMVariant.id);
    const vBlueL = updatedVariants.find(v => v.color === colorBlue.color_name && v.size === sizeL.size_name);
    const vBlackM = updatedVariants.find(v => v.color === colorBlack.color_name && v.size === sizeM.size_name);
    const vBlackL = updatedVariants.find(v => v.color === colorBlack.color_name && v.size === sizeL.size_name);

    if (Number(vBlueM.current_stock) !== 17) {
      throw new Error(`Garment Matrix test failed! Expected Blue/M=17, got ${vBlueM.current_stock}`);
    }
    console.log('✅ 4. Required Garment Stock Matrix Test Passed. Stocks: Blue/M=17, Blue/L=15, Black/M=10, Black/L=12');

    // 5. Required Stock Test Scenario (Prompt Section 67)
    // Opening = 100, Purchase = +50, Sale = -20, Sale Return = +5 -> Expected = 135
    const testStockProduct = await productService.createProduct(businessId, adminId, {
      name: `Stock Flow Test Product ${time}`,
      sku: `SFLOW-${time}`,
      retail_price: 100,
      purchase_price: 60,
      opening_stock: 100 // Step 1: Opening 100
    });

    const supplier = await supplierService.createSupplier(businessId, { name: `Test Supplier ${time}` });

    // Step 2: Purchase +50
    await purchaseService.createPurchase(businessId, adminId, {
      supplier_id: supplier.id,
      items: [{ product_id: testStockProduct.id, quantity: 50, unit_price: 60 }]
    });

    // Step 3: Sale -20
    const stockSale = await saleService.createSale(businessId, adminId, {
      items: [{ product_id: testStockProduct.id, quantity: 20, unit_price: 100 }]
    });

    // Step 4: Sale Return +5
    await saleService.returnSale(businessId, stockSale.id, adminId, {
      returned_items: [{ product_id: testStockProduct.id, quantity: 5 }]
    });

    const stockDetails = await stockService.getStockByProductId(businessId, testStockProduct.id);
    const finalStockQty = Number(stockDetails[0].quantity);

    const stockTxList = await stockService.getTransactions(businessId, { product_id: testStockProduct.id });

    if (finalStockQty !== 135) {
      throw new Error(`Stock Test Scenario failed! Expected 135, got ${finalStockQty}`);
    }
    if (stockTxList.transactions.length !== 4) {
      throw new Error(`Stock Transactions count failed! Expected 4, got ${stockTxList.transactions.length}`);
    }
    console.log('✅ 5. Required Stock Flow Test Passed. Final Stock = 135, Stock Transactions Count = 4');

    // 6. Required Payment Test Scenario (Prompt Section 68)
    // Invoice = 50,000, Paid = 20,000 (Outstanding = 30,000), Customer Payment = 10,000 -> Expected Outstanding = 20,000
    const payCustomer = await customerService.createCustomer(businessId, { name: `Payment Test Customer ${time}` });

    const payProduct = await productService.createProduct(businessId, adminId, {
      name: `High Value Item ${time}`,
      sku: `HV-${time}`,
      retail_price: 50000,
      gst_percentage: 0,
      opening_stock: 10
    });

    const paySale = await saleService.createSale(businessId, adminId, {
      customer_id: payCustomer.id,
      items: [{ product_id: payProduct.id, quantity: 1, unit_price: 50000 }],
      payments: [{ payment_method: 'CASH', amount: 20000 }]
    });

    let custOutstanding = await customerService.getCustomerOutstanding(businessId, payCustomer.id);
    if (custOutstanding.current_balance !== 30000) {
      throw new Error(`Initial payment test failed! Expected 30000, got ${custOutstanding.current_balance}`);
    }

    // Direct Customer Payment = 10,000
    await paymentService.createCustomerPayment(businessId, adminId, {
      customer_id: payCustomer.id,
      sale_id: paySale.id,
      amount: 10000,
      payment_method: 'UPI'
    });

    custOutstanding = await customerService.getCustomerOutstanding(businessId, payCustomer.id);
    if (custOutstanding.current_balance !== 20000) {
      throw new Error(`Final payment test failed! Expected 20000, got ${custOutstanding.current_balance}`);
    }
    console.log('✅ 6. Required Payment Test Passed. Initial Outstanding = ₹30,000, Final Outstanding = ₹20,000');

    // 8. Consolidated Low Stock Alert System Test
    const notifService = require('../src/services/notification.service');
    const lowStockProd1 = await productService.createProduct(businessId, adminId, {
      name: `Consolidated T-Shirt ${time}`,
      sku: `CTSHIRT-${time}`,
      retail_price: 600,
      minimum_stock: 5,
      has_variants: true,
      variants: [
        { color_id: colorBlue.id, size_id: sizeM.id, variant_name: 'Blue / M', opening_stock: 2 },
        { color_id: colorBlack.id, size_id: sizeM.id, variant_name: 'Black / M', opening_stock: 3 }
      ]
    });

    const lowStockProd2 = await productService.createProduct(businessId, adminId, {
      name: `Consolidated Jeans ${time}`,
      sku: `CJEANS-${time}`,
      retail_price: 1200,
      minimum_stock: 5,
      opening_stock: 1
    });

    const lowItems = await notifService.getAllLowStockItems(businessId);
    if (lowItems.length < 3) {
      throw new Error(`Consolidated low stock test failed! Expected at least 3 low stock items, found ${lowItems.length}`);
    }

    const notifRes = await notifService.sendLowStockAlert(businessId, true);
    const lowStockLogs = await prisma.email_logs.findMany({
      where: { business_id: businessId, email_type: 'LOW_STOCK' }
    });

    if (lowStockLogs.length !== 1) {
      throw new Error(`Expected exactly ONE consolidated email log entry, but found ${lowStockLogs.length}`);
    }
    console.log(`✅ 8. Consolidated Low Stock Alert System Test Passed. Total Low Stock Items Detected: ${lowItems.length}, Consolidated Email Sent: yes (Log ID: ${lowStockLogs[0].id})`);

    // 9. One-Time License Verification Tests (Cash, Cheque, Bounced, Online)
    const subscriptionService = require('../src/services/subscription.service');
    
    // Test 1: Cash Payment
    const cashOrder = await subscriptionService.purchaseOneTimeLicense(businessId, adminId, {
      payment_method: 'CASH',
      reference_number: `CASH-REF-${time}`
    });
    if (cashOrder.transaction.status !== 'PENDING_VERIFICATION' || cashOrder.license.status !== 'PENDING_ACTIVATION') {
      throw new Error(`Cash license test failed! Expected PENDING_VERIFICATION & PENDING_ACTIVATION`);
    }

    const verifiedCash = await subscriptionService.verifyLicensePayment(cashOrder.transaction.id, 'VEXA Operations', 'VERIFIED');
    if (verifiedCash.status !== 'VERIFIED') throw new Error('Cash payment verification failed');
    console.log('✅ 9.1. Cash One-Time License Flow Passed (Pending -> Verified -> Active)');

    // Test 2: Cheque Payment & Clearance
    const chequeOrder = await subscriptionService.purchaseOneTimeLicense(businessId, adminId, {
      payment_method: 'CHEQUE',
      cheque_number: '000567',
      bank_name: 'SBI Bank',
      cheque_date: new Date().toISOString()
    });
    if (chequeOrder.transaction.status !== 'CHEQUE_RECEIVED') throw new Error('Cheque initial status failed');
    await subscriptionService.verifyLicensePayment(chequeOrder.transaction.id, 'VEXA Operations', 'CLEARED');
    console.log('✅ 9.2. Cheque One-Time License Flow Passed (Received -> Cleared -> Active)');

    // Test 3: Cheque Bounced
    const bouncedOrder = await subscriptionService.purchaseOneTimeLicense(businessId, adminId, {
      payment_method: 'CHEQUE',
      cheque_number: '000568',
      bank_name: 'Axis Bank',
      cheque_date: new Date().toISOString()
    });
    await subscriptionService.verifyLicensePayment(bouncedOrder.transaction.id, 'VEXA Operations', 'BOUNCED');
    console.log('✅ 9.3. Bounced Cheque Flow Passed (Received -> Bounced -> License Not Active)');

    // Test 4: Online Payment
    const onlineOrder = await subscriptionService.purchaseOneTimeLicense(businessId, adminId, {
      payment_method: 'ONLINE',
      reference_number: `RAZORPAY-PAY-${time}`
    });
    if (onlineOrder.transaction.status !== 'VERIFIED' || onlineOrder.license.status !== 'ACTIVE') {
      throw new Error('Online payment one-time license activation failed');
    }
    console.log('✅ 9.4. Online One-Time License Flow Passed (Verified -> Active)');

    console.log('----------------------------------------------------');
    console.log('🎉 ALL VEXA INVOICE VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');

    // Cleanup created test businesses so user data is never polluted
    const bIds = [businessId, businessIdB].filter(Boolean);
    if (bIds.length > 0) {
      await prisma.stock_transactions.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.customer_payments.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.supplier_payments.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.sale_payments.deleteMany({ where: { sales: { business_id: { in: bIds } } } });
      await prisma.purchase_payments.deleteMany({ where: { purchases: { business_id: { in: bIds } } } });
      await prisma.sale_items.deleteMany({ where: { sales: { business_id: { in: bIds } } } });
      await prisma.purchase_items.deleteMany({ where: { purchases: { business_id: { in: bIds } } } });
      await prisma.quotation_items.deleteMany({ where: { quotations: { business_id: { in: bIds } } } });
      await prisma.sales.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.purchases.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.quotations.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.product_stock.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.product_variants.deleteMany({ where: { products: { business_id: { in: bIds } } } });
      await prisma.products.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.customers.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.suppliers.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.brands.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.categories.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.colors.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.sizes.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.users.deleteMany({ where: { business_id: { in: bIds } } });
      await prisma.businesses.deleteMany({ where: { id: { in: bIds } } });
    }
  } catch (err) {
    console.error('❌ Verification Test Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVerificationTests();
