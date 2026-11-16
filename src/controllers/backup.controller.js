const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');
const { sendSuccess, sendError } = require('../utils/response.util');
const { logAudit } = require('../services/audit.service');

/**
 * Export Business Database Snapshot (.vexa file data)
 */
const exportBackup = async (req, res, next) => {
  try {
    const business_id = req.user.business_id;
    const format = (req.query.format || '').toLowerCase();

    if (format === 'excel' || format === 'xlsx') {
      const backupService = require('../services/backup.service');
      const workbook = await backupService.generateExcelBackupWorkbook(business_id);
      const filename = `VEXA_Database_Backup_${new Date().toISOString().split('T')[0]}.xlsx`;

      await logAudit({
        business_id,
        user_id: req.user.id,
        action: 'DATABASE_BACKUP_EXCEL_CREATED',
        module: 'SETTINGS',
        new_data: { filename }
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return workbook.xlsx.write(res).then(() => {
        res.status(200).end();
      });
    }

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

    const backupPayload = {
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

    await logAudit({
      business_id,
      user_id: req.user.id,
      action: 'DATABASE_BACKUP_CREATED',
      module: 'SETTINGS',
      new_data: { exported_at: backupPayload.exported_at }
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="VEXA_Backup_${Date.now()}.vexa"`);
    const jsonString = JSON.stringify(backupPayload, (key, value) => typeof value === 'bigint' ? value.toString() : value);
    return res.send(jsonString);
  } catch (error) {
    next(error);
  }
};

/**
 * Restore Business Database Snapshot from uploaded/provided JSON payload
 */
const restoreBackup = async (req, res, next) => {
  try {
    const business_id = req.user.business_id;
    const backupData = req.body || {};

    if (backupData.fileBase64) {
      const backupService = require('../services/backup.service');
      const buffer = Buffer.from(backupData.fileBase64, 'base64');
      const result = await backupService.restoreFromExcelWorkbook(buffer, business_id);

      await logAudit({
        business_id,
        user_id: req.user.id,
        action: 'DATABASE_RESTORED_FROM_EXCEL',
        module: 'SETTINGS',
        new_data: { restored_at: new Date().toISOString(), summary: result.summary }
      });

      return sendSuccess(res, 'Database backup restored successfully from Excel file', result);
    }

    if (!backupData || !backupData.app || !backupData.data) {
      return sendError(res, 'Invalid backup file format. Please upload a valid Excel (.xlsx) backup file.', 400);
    }

    const { data } = backupData;

    await prisma.$transaction(async (tx) => {
      // 1. Delete existing records for business in reverse-dependency order
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

      // 2. Re-insert master records
      if (Array.isArray(data.colors) && data.colors.length > 0) {
        for (const c of data.colors) {
          await tx.colors.create({ data: { ...c, business_id } });
        }
      }
      if (Array.isArray(data.sizes) && data.sizes.length > 0) {
        for (const s of data.sizes) {
          await tx.sizes.create({ data: { ...s, business_id } });
        }
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        for (const cat of data.categories) {
          await tx.categories.create({ data: { ...cat, business_id } });
        }
      }
      if (Array.isArray(data.brands) && data.brands.length > 0) {
        for (const b of data.brands) {
          await tx.brands.create({ data: { ...b, business_id } });
        }
      }
      if (Array.isArray(data.customers) && data.customers.length > 0) {
        for (const cust of data.customers) {
          await tx.customers.create({ data: { ...cust, business_id } });
        }
      }
      if (Array.isArray(data.suppliers) && data.suppliers.length > 0) {
        for (const sup of data.suppliers) {
          await tx.suppliers.create({ data: { ...sup, business_id } });
        }
      }

      // 3. Re-insert products & variants
      if (Array.isArray(data.products) && data.products.length > 0) {
        for (const p of data.products) {
          await tx.products.create({ data: { ...p, business_id } });
        }
      }
      if (Array.isArray(data.productVariants) && data.productVariants.length > 0) {
        for (const pv of data.productVariants) {
          await tx.product_variants.create({ data: pv });
        }
      }
      if (Array.isArray(data.productStock) && data.productStock.length > 0) {
        for (const ps of data.productStock) {
          await tx.product_stock.create({ data: { ...ps, business_id } });
        }
      }

      // 4. Re-insert sales & purchases
      if (Array.isArray(data.sales) && data.sales.length > 0) {
        for (const sale of data.sales) {
          await tx.sales.create({ data: { ...sale, business_id } });
        }
      }
      if (Array.isArray(data.saleItems) && data.saleItems.length > 0) {
        for (const si of data.saleItems) {
          await tx.sale_items.create({ data: si });
        }
      }
      if (Array.isArray(data.salePayments) && data.salePayments.length > 0) {
        for (const sp of data.salePayments) {
          await tx.sale_payments.create({ data: sp });
        }
      }

      if (Array.isArray(data.purchases) && data.purchases.length > 0) {
        for (const pur of data.purchases) {
          await tx.purchases.create({ data: { ...pur, business_id } });
        }
      }
      if (Array.isArray(data.purchaseItems) && data.purchaseItems.length > 0) {
        for (const pi of data.purchaseItems) {
          await tx.purchase_items.create({ data: pi });
        }
      }
      if (Array.isArray(data.purchasePayments) && data.purchasePayments.length > 0) {
        for (const pp of data.purchasePayments) {
          await tx.purchase_payments.create({ data: pp });
        }
      }

      // 5. Re-insert quotations & payments
      if (Array.isArray(data.quotations) && data.quotations.length > 0) {
        for (const q of data.quotations) {
          await tx.quotations.create({ data: { ...q, business_id } });
        }
      }
      if (Array.isArray(data.quotationItems) && data.quotationItems.length > 0) {
        for (const qi of data.quotationItems) {
          await tx.quotation_items.create({ data: qi });
        }
      }
      if (Array.isArray(data.customerPayments) && data.customerPayments.length > 0) {
        for (const cp of data.customerPayments) {
          await tx.customer_payments.create({ data: { ...cp, business_id } });
        }
      }
      if (Array.isArray(data.supplierPayments) && data.supplierPayments.length > 0) {
        for (const sp of data.supplierPayments) {
          await tx.supplier_payments.create({ data: { ...sp, business_id } });
        }
      }

      // 6. Re-insert stock transactions
      if (Array.isArray(data.stockTransactions) && data.stockTransactions.length > 0) {
        for (const st of data.stockTransactions) {
          await tx.stock_transactions.create({ data: { ...st, business_id } });
        }
      }
    });

    await logAudit({
      business_id,
      user_id: req.user.id,
      action: 'DATABASE_RESTORED',
      module: 'SETTINGS',
      new_data: { restored_at: new Date().toISOString() }
    });

    return sendSuccess(res, 'Database backup restored successfully', { restored: true });
  } catch (error) {
    next(error);
  }
};

const backupService = require('../services/backup.service');

const getDailyBackups = async (req, res, next) => {
  try {
    const list = backupService.listDailyBackups();
    return sendSuccess(res, 'Daily backups retrieved', list);
  } catch (error) {
    next(error);
  }
};

const triggerDailyBackup = async (req, res, next) => {
  try {
    const result = await backupService.performAutoDailyBackup(req.user.business_id);
    if (result.success) {
      return sendSuccess(res, 'Daily backup generated successfully', result);
    } else {
      return sendError(res, result.error || 'Failed to generate daily backup', 500);
    }
  } catch (error) {
    next(error);
  }
};

const downloadDailyBackup = async (req, res, next) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(backupService.BACKUP_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return sendError(res, 'Backup file not found', 404);
    }

    if (safeFilename.endsWith('.xlsx')) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

const revertBackup = async (req, res, next) => {
  try {
    const business_id = req.user.business_id;
    const backupService = require('../services/backup.service');
    const result = await backupService.revertPreRestoreSnapshot(business_id);
    if (!result.success) {
      return sendError(res, result.error || 'No safety backup available to revert', 400);
    }

    await logAudit({
      business_id,
      user_id: req.user.id,
      action: 'DATABASE_RESTORE_REVERTED',
      module: 'SETTINGS',
      new_data: { reverted_at: new Date().toISOString(), snapshot_timestamp: result.timestamp }
    });

    return sendSuccess(res, 'Database successfully reverted back to state before last restore', result);
  } catch (error) {
    next(error);
  }
};

const getRevertStatus = async (req, res, next) => {
  try {
    const business_id = req.user.business_id;
    const backupService = require('../services/backup.service');
    const info = backupService.getPreRestoreSnapshotInfo(business_id);
    return sendSuccess(res, 'Pre-restore status retrieved', info);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportBackup,
  restoreBackup,
  revertBackup,
  getRevertStatus,
  getDailyBackups,
  triggerDailyBackup,
  downloadDailyBackup
};
