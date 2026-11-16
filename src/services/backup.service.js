const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');

// Ensure backups directory exists consistently in backend/backups or current directory
const BACKUP_DIR = fs.existsSync(path.join(__dirname, '..', '..', 'backups'))
  ? path.join(__dirname, '..', '..', 'backups')
  : path.join(process.cwd(), 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create backups directory:', e.message);
  }
}

/**
 * Generate JSON Backup Data Payload for a Business
 */
const generateBackupPayload = async (business_id) => {
  const [
    business,
    users,
    colors,
    sizes,
    categories,
    brands,
    products,
    productVariants,
    productStock,
    customers,
    suppliers,
    sales,
    saleItems,
    salePayments,
    purchases,
    purchaseItems,
    purchasePayments,
    quotations,
    quotationItems,
    customerPayments,
    supplierPayments,
    stockTransactions
  ] = await Promise.all([
    prisma.businesses.findUnique({ where: { id: business_id } }),
    prisma.users.findMany({ where: { business_id } }),
    prisma.colors.findMany({ where: { business_id } }),
    prisma.sizes.findMany({ where: { business_id } }),
    prisma.categories.findMany({ where: { business_id } }),
    prisma.brands.findMany({ where: { business_id } }),
    prisma.products.findMany({ where: { business_id } }),
    prisma.product_variants.findMany({ where: { products: { business_id } } }),
    prisma.product_stock.findMany({ where: { business_id } }),
    prisma.customers.findMany({ where: { business_id } }),
    prisma.suppliers.findMany({ where: { business_id } }),
    prisma.sales.findMany({ where: { business_id } }),
    prisma.sale_items.findMany({ where: { sales: { business_id } } }),
    prisma.sale_payments.findMany({ where: { sales: { business_id } } }),
    prisma.purchases.findMany({ where: { business_id } }),
    prisma.purchase_items.findMany({ where: { purchases: { business_id } } }),
    prisma.purchase_payments.findMany({ where: { purchases: { business_id } } }),
    prisma.quotations.findMany({ where: { business_id } }),
    prisma.quotation_items.findMany({ where: { quotations: { business_id } } }),
    prisma.customer_payments.findMany({ where: { business_id } }),
    prisma.supplier_payments.findMany({ where: { business_id } }),
    prisma.stock_transactions.findMany({ where: { business_id } })
  ]);

  return {
    app: 'VEXA Invoice Desktop Edition',
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    business_id,
    data: {
      business,
      users,
      colors,
      sizes,
      categories,
      brands,
      products,
      productVariants,
      productStock,
      customers,
      suppliers,
      sales,
      saleItems,
      salePayments,
      purchases,
      purchaseItems,
      purchasePayments,
      quotations,
      quotationItems,
      customerPayments,
      supplierPayments,
      stockTransactions
    }
  };
};

/**
 * Generate Excel (.xlsx) Workbook for Business Database Snapshot
 */
const ExcelJS = require('exceljs');

const generateExcelBackupWorkbook = async (business_id) => {
  const payload = await generateBackupPayload(business_id);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEXA Invoice Desktop';
  workbook.created = new Date();

  const data = payload.data;

  // Create fast lookup maps for human readable names
  const categoryMap = new Map((data.categories || []).map(c => [c.id, c.name]));
  const brandMap = new Map((data.brands || []).map(b => [b.id, b.name]));
  const colorMap = new Map((data.colors || []).map(c => [c.id, c.name]));
  const sizeMap = new Map((data.sizes || []).map(s => [s.id, s.name]));
  const productMap = new Map((data.products || []).map(p => [p.id, p.name]));
  const customerMap = new Map((data.customers || []).map(c => [c.id, c.name]));
  const supplierMap = new Map((data.suppliers || []).map(s => [s.id, s.name]));

  // Helper to format worksheets cleanly
  const createCleanSheet = (sheetName, columns, rows) => {
    const sheet = workbook.addWorksheet(sheetName);
    
    // Add Header Row
    sheet.addRow(columns.map(c => c.header));
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    headerRow.height = 24;

    if (!rows || rows.length === 0) {
      sheet.addRow(['No Records Available']);
      return;
    }

    rows.forEach(item => {
      const rowValues = columns.map(col => {
        let val = item[col.key];
        if (col.transform) {
          val = col.transform(val, item);
        } else if (val === null || val === undefined) {
          val = '';
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        } else if (typeof val === 'number') {
          val = val;
        } else if (typeof val === 'string' && !isNaN(val) && val.trim() !== '') {
          val = parseFloat(val);
        } else if (val && typeof val === 'object' && val.toString) {
          const strVal = val.toString();
          if (!isNaN(strVal) && strVal.trim() !== '') {
            val = parseFloat(strVal);
          }
        }
        return val;
      });
      sheet.addRow(rowValues);
    });

    sheet.columns.forEach((col, idx) => {
      col.width = columns[idx]?.width || 20;
    });
  };

  // 1. Products Sheet
  createCleanSheet('Products', [
    { header: 'Product Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category_id', width: 22, transform: id => categoryMap.get(id) || '-' },
    { header: 'Brand', key: 'brand_id', width: 22, transform: id => brandMap.get(id) || '-' },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'HSN Code', key: 'hsn_code', width: 15 },
    { header: 'GST Rate (%)', key: 'gst_percentage', width: 15, transform: v => parseFloat(v || 0) },
    { header: 'SKU', key: 'sku', width: 22 },
    { header: 'Barcode', key: 'barcode', width: 22 },
    { header: 'Purchase Price (₹)', key: 'purchase_price', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Retail Price (₹)', key: 'retail_price', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Wholesale Price (₹)', key: 'wholesale_price', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Dealer Price (₹)', key: 'dealer_price', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Opening Stock', key: 'id', width: 15, transform: (id, item) => {
        const stock = (data.productStock || []).find(s => s.product_id === id && !s.variant_id);
        return stock ? parseFloat(stock.quantity || 0) : 0;
      }
    },
    { header: 'Has Variants', key: 'has_variants', width: 15, transform: v => v ? 'Yes' : 'No' }
  ], data.products);

  // 2. Product Variants Sheet
  createCleanSheet('Product Variants', [
    { header: 'Product Name', key: 'product_id', width: 30, transform: id => productMap.get(id) || '-' },
    { header: 'Variant Name', key: 'variant_name', width: 25 },
    { header: 'Color', key: 'color_id', width: 18, transform: id => colorMap.get(id) || '-' },
    { header: 'Size', key: 'size_id', width: 15, transform: id => sizeMap.get(id) || '-' },
    { header: 'SKU', key: 'sku', width: 25 },
    { header: 'Barcode', key: 'barcode', width: 25 },
    { header: 'Retail Price (₹)', key: 'retail_price', width: 18, transform: v => parseFloat(v || 0) }
  ], data.productVariants);

  // 3. Current Stock Sheet
  createCleanSheet('Current Stock', [
    { header: 'Product Name', key: 'product_id', width: 30, transform: id => productMap.get(id) || '-' },
    { header: 'Current Quantity', key: 'quantity', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Last Updated', key: 'updated_at', width: 24, transform: v => v ? new Date(v).toLocaleString('en-IN') : '-' }
  ], data.productStock);

  // 4. Sales Transactions Sheet
  createCleanSheet('Sales Transactions', [
    { header: 'Invoice Number', key: 'invoice_number', width: 22 },
    { header: 'Sale Date', key: 'invoice_date', width: 16, transform: v => v ? new Date(v).toLocaleDateString('en-IN') : '-' },
    { header: 'Customer Name', key: 'customer_id', width: 25, transform: id => customerMap.get(id) || 'Cash Customer' },
    { header: 'Subtotal (₹)', key: 'subtotal', width: 15, transform: v => parseFloat(v || 0) },
    { header: 'Tax Amount (₹)', key: 'taxable_amount', width: 15, transform: v => parseFloat(v || 0) },
    { header: 'Discount (₹)', key: 'discount_amount', width: 15, transform: v => parseFloat(v || 0) },
    { header: 'Total Amount (₹)', key: 'grand_total', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Paid Amount (₹)', key: 'paid_amount', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Balance Due (₹)', key: 'balance_amount', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Payment Method', key: 'id', width: 18, transform: (id, item) => {
        const sp = (data.salePayments || []).find(p => p.sale_id === id);
        return sp ? sp.payment_method : 'CASH';
      }
    },
    { header: 'Status', key: 'status', width: 15 }
  ], data.sales);

  // 5. Sale Items Sheet
  createCleanSheet('Sale Items', [
    { header: 'Product Name', key: 'product_id', width: 30, transform: id => productMap.get(id) || '-' },
    { header: 'Quantity', key: 'quantity', width: 12, transform: v => parseFloat(v || 0) },
    { header: 'Unit Price (₹)', key: 'unit_price', width: 15, transform: v => parseFloat(v || 0) },
    { header: 'Total Price (₹)', key: 'total_amount', width: 18, transform: v => parseFloat(v || 0) }
  ], data.saleItems);

  // 6. Customers Sheet
  createCleanSheet('Customers', [
    { header: 'Full Name', key: 'name', width: 25 },
    { header: 'Mobile Number', key: 'phone', width: 18 },
    { header: 'Email', key: 'email', width: 25 },
    { header: 'GSTIN', key: 'gst_number', width: 20 },
    { header: 'Outstanding Balance (₹)', key: 'current_balance', width: 22, transform: v => parseFloat(v || 0) }
  ], data.customers);

  // 7. Suppliers Sheet
  createCleanSheet('Suppliers', [
    { header: 'Company Name', key: 'name', width: 25 },
    { header: 'Mobile Number', key: 'phone', width: 18 },
    { header: 'GSTIN', key: 'gst_number', width: 20 },
    { header: 'Outstanding Balance (₹)', key: 'current_balance', width: 22, transform: v => parseFloat(v || 0) }
  ], data.suppliers);

  // 8. Purchases Sheet
  createCleanSheet('Purchases', [
    { header: 'Purchase Number', key: 'purchase_number', width: 22 },
    { header: 'Purchase Date', key: 'purchase_date', width: 16, transform: v => v ? new Date(v).toLocaleDateString('en-IN') : '-' },
    { header: 'Supplier Name', key: 'supplier_id', width: 25, transform: id => supplierMap.get(id) || '-' },
    { header: 'Total Amount (₹)', key: 'grand_total', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Paid Amount (₹)', key: 'paid_amount', width: 18, transform: v => parseFloat(v || 0) },
    { header: 'Balance Due (₹)', key: 'balance_amount', width: 18, transform: v => parseFloat(v || 0) }
  ], data.purchases);

  // 9. Stock Ledger Sheet
  createCleanSheet('Stock Ledger', [
    { header: 'Product Name', key: 'product_id', width: 30, transform: id => productMap.get(id) || '-' },
    { header: 'Transaction Type', key: 'transaction_type', width: 20 },
    { header: 'Quantity Change', key: 'quantity', width: 16, transform: v => parseFloat(v || 0) },
    { header: 'Reference', key: 'reference_id', width: 25 },
    { header: 'Date & Time', key: 'created_at', width: 22, transform: v => v ? new Date(v).toLocaleString('en-IN') : '-' }
  ], data.stockTransactions);

  // 10. Master Tables (Categories, Brands, Colors, Sizes)
  createCleanSheet('Categories', [{ header: 'Category Name', key: 'name', width: 25 }], data.categories);
  createCleanSheet('Brands', [{ header: 'Brand Name', key: 'name', width: 25 }], data.brands);
  createCleanSheet('Colors', [{ header: 'Color Name', key: 'name', width: 20 }, { header: 'Hex Code', key: 'hex_code', width: 15 }], data.colors);
  createCleanSheet('Sizes', [{ header: 'Size Name', key: 'name', width: 20 }], data.sizes);

  return workbook;
};

/**
 * Perform Automatic Daily Backup for a Business as Excel workbook (.xlsx)
 */
const performAutoDailyBackup = async (business_id) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const excelFilename = `VEXA_Daily_Backup_${todayStr}.xlsx`;
    const excelFilePath = path.join(BACKUP_DIR, excelFilename);

    let generated = false;

    // Generate Excel (.xlsx) Daily Backup workbook
    if (!fs.existsSync(excelFilePath)) {
      const workbook = await generateExcelBackupWorkbook(business_id);
      await workbook.xlsx.writeFile(excelFilePath);
      console.log(`✅ [DAILY_BACKUP] Automatic Daily Excel Backup generated: ${excelFilename}`);
      generated = true;
    }

    // Cleanup backups older than 30 days
    cleanupOldBackups();

    return {
      success: true,
      filename: excelFilename,
      filePath: excelFilePath,
      message: generated ? 'Daily Excel backup created successfully' : 'Backup already exists for today'
    };
  } catch (err) {
    console.error('❌ [DAILY_BACKUP] Failed to perform automatic daily backup:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Cleanup Daily Backups older than 30 days
 */
const cleanupOldBackups = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('VEXA_Daily_Backup_'));
    const maxRetentionDays = 30;
    const now = Date.now();

    for (const file of files) {
      const fullPath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(fullPath);
      const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageInDays > maxRetentionDays) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ [DAILY_BACKUP] Cleaned up old backup file: ${file}`);
      }
    }
  } catch (e) {
    console.error('Failed to cleanup old backups:', e.message);
  }
};

/**
 * List all available local Daily Backups
 */
const listDailyBackups = () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    // Prioritize clean Excel (.xlsx) files for daily backups list view
    const allFiles = fs.readdirSync(BACKUP_DIR).filter(f => (f.endsWith('.xlsx') || f.endsWith('.vexa') || f.endsWith('.json')) && !f.startsWith('PRE_RESTORE_SAFETY_SNAPSHOT_'));

    // If an .xlsx version exists for a given date, show the .xlsx file so users see & download Excel spreadsheets
    const xlsxBaseNames = new Set(allFiles.filter(f => f.endsWith('.xlsx')).map(f => f.replace(/\.xlsx$/i, '')));

    const files = allFiles.filter(f => {
      if (f.endsWith('.xlsx')) return true;
      const baseName = f.replace(/\.(vexa|json)$/i, '');
      return !xlsxBaseNames.has(baseName); // Only include .vexa / .json if no .xlsx exists for that snapshot
    });

    const list = files.map((file) => {
      const fullPath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(fullPath);
      const sizeKb = (stats.size / 1024).toFixed(1);
      const formattedSize = stats.size >= 1024 * 1024 ? `${(stats.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKb} KB`;
      const dateStr = stats.mtime.toISOString().split('T')[0];
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isExcel = file.endsWith('.xlsx');

      return {
        filename: file,
        size: stats.size,
        formattedSize,
        createdAt: stats.mtime.toISOString(),
        dateStr,
        isToday,
        isExcel,
        format: isExcel ? 'Excel (.xlsx)' : 'VEXA Snapshot',
        isAutoDaily: file.startsWith('VEXA_Daily_Backup_')
      };
    });

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (e) {
    console.error('Failed to list daily backups:', e.message);
    return [];
  }
};

let isSchedulerInitialized = false;

/**
 * Schedule Automatic Daily Backup Job on Startup
 */
const initAutoDailyBackupScheduler = async () => {
  if (isSchedulerInitialized) return;
  isSchedulerInitialized = true;

  try {
    // Run initial check after 5 seconds
    setTimeout(async () => {
      const activeBusinesses = await prisma.businesses.findMany({
        where: { is_active: true },
        select: { id: true }
      });
      for (const biz of activeBusinesses) {
        await performAutoDailyBackup(biz.id);
      }
    }, 5000);

    // Schedule check every 12 hours
    setInterval(async () => {
      try {
        const activeBusinesses = await prisma.businesses.findMany({
          where: { is_active: true },
          select: { id: true }
        });
        for (const biz of activeBusinesses) {
          await performAutoDailyBackup(biz.id);
        }
      } catch (e) {}
    }, 12 * 60 * 60 * 1000);
  } catch (e) {
    console.error('Failed to initialize daily backup scheduler:', e.message);
  }
};

/**
 * Restore Business Database from uploaded Excel (.xlsx) Backup Buffer
 */
const restoreFromExcelWorkbook = async (buffer, business_id) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const extractSheetRows = (sheetName) => {
    const sheet = workbook.worksheets.find(s => s.name.trim().toLowerCase() === sheetName.trim().toLowerCase());
    if (!sheet) return [];
    const rows = [];
    let headers = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        headers = row.values.slice(1).map(h => (h !== null && h !== undefined ? String(h).trim() : ''));
      } else {
        const rowVal = row.values.slice(1);
        const obj = {};
        let hasData = false;
        headers.forEach((header, idx) => {
          if (!header) return;
          let val = rowVal[idx];
          if (val && typeof val === 'object' && val.text !== undefined) {
            val = val.text;
          } else if (val && typeof val === 'object' && val.result !== undefined) {
            val = val.result;
          }
          if (val !== undefined && val !== null && val !== '') {
            hasData = true;
          }
          obj[header] = val;
        });
        if (hasData && obj[headers[0]] !== 'No Records Available') {
          rows.push(obj);
        }
      }
    });
    return rows;
  };

  const categoriesRows = extractSheetRows('Categories');
  const brandsRows = extractSheetRows('Brands');
  const colorsRows = extractSheetRows('Colors');
  const sizesRows = extractSheetRows('Sizes');
  const customersRows = extractSheetRows('Customers');
  const suppliersRows = extractSheetRows('Suppliers');
  const productsRows = extractSheetRows('Products');
  const variantsRows = extractSheetRows('Product Variants');
  const salesRows = extractSheetRows('Sales Transactions');
  const saleItemsRows = extractSheetRows('Sale Items');
  const purchasesRows = extractSheetRows('Purchases');
  const stockRows = extractSheetRows('Current Stock');

  // Automatically take pre-restore safety snapshot before modifying database
  await createPreRestoreSnapshot(business_id);

  return await prisma.$transaction(async (tx) => {
    // 1. Clean existing records in reverse-dependency order
    await tx.stock_transactions.deleteMany({ where: { business_id } });
    await tx.customer_payments.deleteMany({ where: { business_id } });
    await tx.supplier_payments.deleteMany({ where: { business_id } });
    await tx.quotation_items.deleteMany({ where: { quotations: { business_id } } });
    await tx.quotations.deleteMany({ where: { business_id } });
    await tx.purchase_payments.deleteMany({ where: { purchases: { business_id } } });
    await tx.purchase_items.deleteMany({ where: { purchases: { business_id } } });
    await tx.purchases.deleteMany({ where: { business_id } });
    await tx.sale_payments.deleteMany({ where: { sales: { business_id } } });
    await tx.sale_items.deleteMany({ where: { sales: { business_id } } });
    await tx.sales.deleteMany({ where: { business_id } });
    await tx.product_stock.deleteMany({ where: { business_id } });
    await tx.product_variants.deleteMany({ where: { products: { business_id } } });
    await tx.products.deleteMany({ where: { business_id } });
    await tx.categories.deleteMany({ where: { business_id } });
    await tx.brands.deleteMany({ where: { business_id } });
    await tx.colors.deleteMany({ where: { business_id } });
    await tx.sizes.deleteMany({ where: { business_id } });
    await tx.customers.deleteMany({ where: { business_id } });
    await tx.suppliers.deleteMany({ where: { business_id } });

    // 2. Re-insert master tables & track ID maps
    const categoryMap = new Map();
    for (const row of categoriesRows) {
      const name = row['Category Name'] || row['Name'];
      if (name) {
        const cat = await tx.categories.create({ data: { business_id, name: String(name).trim() } });
        categoryMap.set(String(name).trim(), cat.id);
      }
    }

    const brandMap = new Map();
    for (const row of brandsRows) {
      const name = row['Brand Name'] || row['Name'];
      if (name) {
        const b = await tx.brands.create({ data: { business_id, name: String(name).trim() } });
        brandMap.set(String(name).trim(), b.id);
      }
    }

    const colorMap = new Map();
    for (const row of colorsRows) {
      const name = row['Color Name'] || row['Name'];
      if (name) {
        const hex = row['Hex Code'] ? String(row['Hex Code']).trim() : null;
        const c = await tx.colors.create({ data: { business_id, name: String(name).trim(), hex_code: hex } });
        colorMap.set(String(name).trim(), c.id);
      }
    }

    const sizeMap = new Map();
    for (const row of sizesRows) {
      const name = row['Size Name'] || row['Name'];
      if (name) {
        const s = await tx.sizes.create({ data: { business_id, name: String(name).trim() } });
        sizeMap.set(String(name).trim(), s.id);
      }
    }

    const customerMap = new Map();
    for (const row of customersRows) {
      const name = row['Full Name'] || row['Name'];
      if (name) {
        const cust = await tx.customers.create({
          data: {
            business_id,
            name: String(name).trim(),
            phone: row['Mobile Number'] ? String(row['Mobile Number']).trim() : null,
            email: row['Email'] ? String(row['Email']).trim() : null,
            gst_number: row['GSTIN'] ? String(row['GSTIN']).trim() : null,
            current_balance: parseFloat(row['Outstanding Balance (₹)'] || row['Current Balance'] || 0)
          }
        });
        customerMap.set(String(name).trim(), cust.id);
      }
    }

    const supplierMap = new Map();
    for (const row of suppliersRows) {
      const name = row['Company Name'] || row['Name'];
      if (name) {
        const sup = await tx.suppliers.create({
          data: {
            business_id,
            name: String(name).trim(),
            phone: row['Mobile Number'] ? String(row['Mobile Number']).trim() : null,
            gst_number: row['GSTIN'] ? String(row['GSTIN']).trim() : null,
            current_balance: parseFloat(row['Outstanding Balance (₹)'] || row['Current Balance'] || 0)
          }
        });
        supplierMap.set(String(name).trim(), sup.id);
      }
    }

    const getVal = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
          return row[k];
        }
      }
      return null;
    };

    // Helper for unit_type enum validation
    const validUnits = ['PCS', 'DOZEN', 'BOX', 'BUNDLE', 'METER', 'KG', 'GRAM', 'ROLL', 'SET'];
    const parseUnit = (u) => {
      const upper = (u || '').toString().toUpperCase().trim();
      return validUnits.includes(upper) ? upper : 'PCS';
    };

    // 3. Products
    const productMap = new Map();
    for (const row of productsRows) {
      const name = getVal(row, 'Product Name', 'name', 'Name');
      if (name) {
        const cleanName = String(name).trim();
        const catName = getVal(row, 'Category', 'category');
        const brandName = getVal(row, 'Brand', 'brand');
        const category_id = catName ? categoryMap.get(String(catName).trim()) || null : null;
        const brand_id = brandName ? brandMap.get(String(brandName).trim()) || null : null;
        const openingStockQty = parseFloat(getVal(row, 'Opening Stock', 'opening_stock') || 0);

        const prod = await tx.products.create({
          data: {
            business_id,
            name: cleanName,
            category_id,
            brand_id,
            unit: parseUnit(getVal(row, 'Unit', 'unit')),
            hsn_code: getVal(row, 'HSN Code', 'hsn_code') ? String(getVal(row, 'HSN Code', 'hsn_code')).trim() : null,
            gst_percentage: parseFloat(getVal(row, 'GST Rate (%)', 'gst_percentage', 'GST') || 0),
            sku: getVal(row, 'SKU', 'sku') ? String(getVal(row, 'SKU', 'sku')).trim() : null,
            barcode: getVal(row, 'Barcode', 'barcode') ? String(getVal(row, 'Barcode', 'barcode')).trim() : null,
            purchase_price: parseFloat(getVal(row, 'Purchase Price (₹)', 'purchase_price') || 0),
            retail_price: parseFloat(getVal(row, 'Retail Price (₹)', 'retail_price') || 0),
            wholesale_price: parseFloat(getVal(row, 'Wholesale Price (₹)', 'wholesale_price') || 0),
            dealer_price: parseFloat(getVal(row, 'Dealer Price (₹)', 'dealer_price') || 0),
            has_variants: String(getVal(row, 'Has Variants', 'has_variants')).toLowerCase() === 'yes' || getVal(row, 'Has Variants', 'has_variants') === true
          }
        });
        productMap.set(cleanName, prod.id);

        await tx.product_stock.create({
          data: {
            business_id,
            product_id: prod.id,
            quantity: openingStockQty
          }
        });
      }
    }

    // 4. Product Variants
    for (const row of variantsRows) {
      const prodName = getVal(row, 'Product Name', 'product_name');
      const product_id = prodName ? productMap.get(String(prodName).trim()) : null;
      if (product_id) {
        const colorName = getVal(row, 'Color', 'color');
        const sizeName = getVal(row, 'Size', 'size');
        const color_id = colorName ? colorMap.get(String(colorName).trim()) || null : null;
        const size_id = sizeName ? sizeMap.get(String(sizeName).trim()) || null : null;

        await tx.product_variants.create({
          data: {
            product_id,
            variant_name: getVal(row, 'Variant Name', 'variant_name') ? String(getVal(row, 'Variant Name', 'variant_name')).trim() : `${prodName} ${colorName || ''} ${sizeName || ''}`.trim(),
            color_id,
            size_id,
            sku: getVal(row, 'SKU', 'sku') ? String(getVal(row, 'SKU', 'sku')).trim() : null,
            barcode: getVal(row, 'Barcode', 'barcode') ? String(getVal(row, 'Barcode', 'barcode')).trim() : null,
            retail_price: parseFloat(getVal(row, 'Retail Price (₹)', 'retail_price') || 0)
          }
        });
      }
    }

    // 5. Current Stock
    if (stockRows.length > 0) {
      await tx.product_stock.deleteMany({ where: { business_id } });
      for (const row of stockRows) {
        const prodName = getVal(row, 'Product Name', 'product_name');
        const product_id = prodName ? productMap.get(String(prodName).trim()) : null;
        if (product_id) {
          const qty = parseFloat(getVal(row, 'Current Quantity', 'quantity', 'Current Stock') || 0);
          await tx.product_stock.create({
            data: {
              business_id,
              product_id,
              quantity: qty
            }
          });
        }
      }
    }

    // Helper for sales enums
    const validPayments = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'];
    const parsePaymentMethod = (pm) => {
      const upper = (pm || '').toString().toUpperCase().trim();
      return validPayments.includes(upper) ? upper : 'CASH';
    };

    const validStatuses = ['DRAFT', 'CONFIRMED', 'CANCELLED'];
    const parseInvoiceStatus = (st) => {
      const upper = (st || '').toString().toUpperCase().trim();
      return validStatuses.includes(upper) ? upper : 'CONFIRMED';
    };

    // 6. Sales
    const salesMap = new Map();
    for (const row of salesRows) {
      const invoice_number = getVal(row, 'Invoice Number', 'invoice_number');
      if (invoice_number) {
        const custName = getVal(row, 'Customer Name', 'customer_name');
        const customer_id = custName ? customerMap.get(String(custName).trim()) || null : null;
        const paidAmount = parseFloat(getVal(row, 'Paid Amount (₹)', 'paid_amount', 'Paid Amount') || 0);

        const s = await tx.sales.create({
          data: {
            business_id,
            customer_id,
            invoice_number: String(invoice_number).trim(),
            subtotal: parseFloat(getVal(row, 'Subtotal (₹)', 'subtotal') || 0),
            taxable_amount: parseFloat(getVal(row, 'Tax Amount (₹)', 'taxable_amount', 'tax_amount') || 0),
            discount_amount: parseFloat(getVal(row, 'Discount (₹)', 'discount_amount') || 0),
            grand_total: parseFloat(getVal(row, 'Total Amount (₹)', 'grand_total', 'total_amount') || 0),
            paid_amount: paidAmount,
            balance_amount: parseFloat(getVal(row, 'Balance Due (₹)', 'balance_amount', 'balance_due') || 0),
            status: parseInvoiceStatus(getVal(row, 'Status', 'status'))
          }
        });
        salesMap.set(String(invoice_number).trim(), s.id);

        if (paidAmount > 0) {
          await tx.sale_payments.create({
            data: {
              sale_id: s.id,
              amount: paidAmount,
              payment_method: parsePaymentMethod(getVal(row, 'Payment Method', 'payment_method'))
            }
          });
        }
      }
    }

    // 7. Sale Items
    for (const row of saleItemsRows) {
      const prodName = getVal(row, 'Product Name', 'product_name');
      const product_id = prodName ? productMap.get(String(prodName).trim()) : null;
      if (product_id && salesMap.size > 0) {
        const firstSaleId = salesMap.values().next().value;
        if (firstSaleId) {
          await tx.sale_items.create({
            data: {
              sale_id: firstSaleId,
              product_id,
              product_name: String(prodName).trim(),
              quantity: parseFloat(getVal(row, 'Quantity', 'quantity') || 1),
              unit_price: parseFloat(getVal(row, 'Unit Price (₹)', 'unit_price') || 0),
              total_amount: parseFloat(getVal(row, 'Total Price (₹)', 'total_amount', 'total_price') || 0)
            }
          });
        }
      }
    }

    // 8. Purchases
    for (const row of purchasesRows) {
      const purchase_number = getVal(row, 'Purchase Number', 'purchase_number');
      if (purchase_number) {
        const supName = getVal(row, 'Supplier Name', 'supplier_name');
        const supplier_id = supName ? supplierMap.get(String(supName).trim()) || null : null;
        await tx.purchases.create({
          data: {
            business_id,
            supplier_id,
            purchase_number: String(purchase_number).trim(),
            grand_total: parseFloat(getVal(row, 'Total Amount (₹)', 'grand_total', 'total_amount') || 0),
            paid_amount: parseFloat(getVal(row, 'Paid Amount (₹)', 'paid_amount') || 0),
            balance_amount: parseFloat(getVal(row, 'Balance Due (₹)', 'balance_amount', 'balance_due') || 0)
          }
        });
      }
    }

    return {
      restored: true,
      summary: {
        categories: categoriesRows.length,
        brands: brandsRows.length,
        colors: colorsRows.length,
        sizes: sizesRows.length,
        products: productsRows.length,
        variants: variantsRows.length,
        customers: customersRows.length,
        suppliers: suppliersRows.length,
        sales: salesRows.length
      }
    };
  });
};

/**
 * Create a Pre-Restore Safety Snapshot before modifying database
 */
const createPreRestoreSnapshot = async (business_id) => {
  try {
    const payload = await generateBackupPayload(business_id);
    const filename = `PRE_RESTORE_SAFETY_SNAPSHOT_${business_id}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    const jsonStr = JSON.stringify(payload, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2);
    fs.writeFileSync(filePath, jsonStr, 'utf-8');
    console.log(`🛡️ [RESTORE_SAFETY] Pre-restore safety snapshot created for business ${business_id}`);
    return { success: true, timestamp: payload.exported_at };
  } catch (err) {
    console.error('Failed to create pre-restore snapshot:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Get Pre-Restore Safety Snapshot Info
 */
const getPreRestoreSnapshotInfo = (business_id) => {
  try {
    const filename = `PRE_RESTORE_SAFETY_SNAPSHOT_${business_id}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return { exists: false };
    }
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    return {
      exists: true,
      timestamp: json.exported_at || stats.mtime.toISOString(),
      formattedDate: new Date(json.exported_at || stats.mtime).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    };
  } catch (err) {
    return { exists: false };
  }
};

/**
 * Revert Business Database back to Pre-Restore Safety Snapshot
 */
const revertPreRestoreSnapshot = async (business_id) => {
  const filename = `PRE_RESTORE_SAFETY_SNAPSHOT_${business_id}.json`;
  const filePath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'No pre-restore safety backup found to revert.' };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const backupPayload = JSON.parse(content);
  const data = backupPayload.data;

  await prisma.$transaction(async (tx) => {
    // Delete current records for business in reverse-dependency order
    await tx.stock_transactions.deleteMany({ where: { business_id } });
    await tx.customer_payments.deleteMany({ where: { business_id } });
    await tx.supplier_payments.deleteMany({ where: { business_id } });
    await tx.quotation_items.deleteMany({ where: { quotations: { business_id } } });
    await tx.quotations.deleteMany({ where: { business_id } });
    await tx.purchase_payments.deleteMany({ where: { purchases: { business_id } } });
    await tx.purchase_items.deleteMany({ where: { purchases: { business_id } } });
    await tx.purchases.deleteMany({ where: { business_id } });
    await tx.sale_payments.deleteMany({ where: { sales: { business_id } } });
    await tx.sale_items.deleteMany({ where: { sales: { business_id } } });
    await tx.sales.deleteMany({ where: { business_id } });
    await tx.product_stock.deleteMany({ where: { business_id } });
    await tx.product_variants.deleteMany({ where: { products: { business_id } } });
    await tx.products.deleteMany({ where: { business_id } });
    await tx.categories.deleteMany({ where: { business_id } });
    await tx.brands.deleteMany({ where: { business_id } });
    await tx.colors.deleteMany({ where: { business_id } });
    await tx.sizes.deleteMany({ where: { business_id } });
    await tx.customers.deleteMany({ where: { business_id } });
    await tx.suppliers.deleteMany({ where: { business_id } });

    // Re-insert original master records
    if (Array.isArray(data.colors)) {
      for (const c of data.colors) await tx.colors.create({ data: { ...c, business_id } });
    }
    if (Array.isArray(data.sizes)) {
      for (const s of data.sizes) await tx.sizes.create({ data: { ...s, business_id } });
    }
    if (Array.isArray(data.categories)) {
      for (const cat of data.categories) await tx.categories.create({ data: { ...cat, business_id } });
    }
    if (Array.isArray(data.brands)) {
      for (const b of data.brands) await tx.brands.create({ data: { ...b, business_id } });
    }
    if (Array.isArray(data.customers)) {
      for (const cust of data.customers) await tx.customers.create({ data: { ...cust, business_id } });
    }
    if (Array.isArray(data.suppliers)) {
      for (const sup of data.suppliers) await tx.suppliers.create({ data: { ...sup, business_id } });
    }
    if (Array.isArray(data.products)) {
      for (const p of data.products) await tx.products.create({ data: { ...p, business_id } });
    }
    if (Array.isArray(data.productVariants)) {
      for (const pv of data.productVariants) await tx.product_variants.create({ data: pv });
    }
    if (Array.isArray(data.productStock)) {
      for (const ps of data.productStock) await tx.product_stock.create({ data: { ...ps, business_id } });
    }
    if (Array.isArray(data.sales)) {
      for (const sale of data.sales) await tx.sales.create({ data: { ...sale, business_id } });
    }
    if (Array.isArray(data.saleItems)) {
      for (const si of data.saleItems) await tx.sale_items.create({ data: si });
    }
    if (Array.isArray(data.salePayments)) {
      for (const sp of data.salePayments) await tx.sale_payments.create({ data: sp });
    }
    if (Array.isArray(data.purchases)) {
      for (const pur of data.purchases) await tx.purchases.create({ data: { ...pur, business_id } });
    }
    if (Array.isArray(data.purchaseItems)) {
      for (const pi of data.purchaseItems) await tx.purchase_items.create({ data: pi });
    }
    if (Array.isArray(data.purchasePayments)) {
      for (const pp of data.purchasePayments) await tx.purchase_payments.create({ data: pp });
    }
    if (Array.isArray(data.quotations)) {
      for (const q of data.quotations) await tx.quotations.create({ data: { ...q, business_id } });
    }
    if (Array.isArray(data.quotationItems)) {
      for (const qi of data.quotationItems) await tx.quotation_items.create({ data: qi });
    }
    if (Array.isArray(data.customerPayments)) {
      for (const cp of data.customerPayments) await tx.customer_payments.create({ data: { ...cp, business_id } });
    }
    if (Array.isArray(data.supplierPayments)) {
      for (const sp of data.supplierPayments) await tx.supplier_payments.create({ data: { ...sp, business_id } });
    }
    if (Array.isArray(data.stockTransactions)) {
      for (const st of data.stockTransactions) await tx.stock_transactions.create({ data: { ...st, business_id } });
    }
  });

  // Clean up safety snapshot after successful revert
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ [RESTORE_SAFETY] Cleaned up pre-restore safety snapshot for business ${business_id}`);
    } catch (e) {}
  }

  return { success: true, timestamp: backupPayload.exported_at };
};

module.exports = {
  generateBackupPayload,
  generateExcelBackupWorkbook,
  restoreFromExcelWorkbook,
  createPreRestoreSnapshot,
  getPreRestoreSnapshotInfo,
  revertPreRestoreSnapshot,
  performAutoDailyBackup,
  listDailyBackups,
  initAutoDailyBackupScheduler,
  BACKUP_DIR
};

