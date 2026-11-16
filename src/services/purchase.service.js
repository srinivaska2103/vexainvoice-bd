const prisma = require('../config/db');
const { logAudit } = require('./audit.service');

const getPurchases = async (business_id, queryParams = {}) => {
  const { page = 1, limit = 20, search = '' } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = { business_id };
  const total = await prisma.purchases.count({ where });
  const purchases = await prisma.purchases.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { purchase_date: 'desc' },
    include: {
      suppliers: true,
      purchase_items: true
    }
  });

  return {
    purchases,
    data: purchases,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const getPurchaseById = async (business_id, id) => {
  const p = await prisma.purchases.findFirst({
    where: { id, business_id },
    include: {
      suppliers: true,
      purchase_items: true
    }
  });
  if (!p) {
    const err = new Error('Purchase bill not found');
    err.statusCode = 404;
    throw err;
  }
  return p;
};

const createPurchase = async (business_id, user_id, data) => {
  const purchaseResult = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    const preparedItems = [];

    for (const item of data.items) {
      const product = await tx.products.findFirst({ where: { id: item.productId || item.product_id, business_id } });
      if (!product) {
        const err = new Error('Product not found');
        err.statusCode = 400;
        throw err;
      }

      const qty = parseFloat(item.quantity || 1);
      const unitCost = parseFloat(item.unitCost || item.unit_cost || item.unit_price || product.purchase_price || 0);
      const itemTotal = qty * unitCost;

      subtotal += itemTotal;
      preparedItems.push({
        product_id: product.id,
        variant_id: item.variant_id || item.variantId || null,
        product_name: product.name,
        quantity: qty,
        unit_price: unitCost,
        total_amount: itemTotal
      });
    }

    const purNumber = data.supplierInvoiceNumber || data.supplier_invoice_number || `PUR-${Date.now().toString().slice(-6)}`;
    const purchase = await tx.purchases.create({
      data: {
        business_id,
        supplier_id: data.supplierId || data.supplier_id || null,
        purchase_number: purNumber,
        subtotal,
        grand_total: subtotal,
        paid_amount: subtotal,
        created_by: user_id || null
      }
    });

    for (const itemData of preparedItems) {
      await tx.purchase_items.create({
        data: {
          purchase_id: purchase.id,
          ...itemData
        }
      });

      // Increment product stock
      const existingStock = await tx.product_stock.findFirst({
        where: { business_id, product_id: itemData.product_id, variant_id: itemData.variant_id || null }
      });

      if (existingStock) {
        await tx.product_stock.update({
          where: { id: existingStock.id },
          data: {
            quantity: { increment: itemData.quantity }
          }
        });
      } else {
        await tx.product_stock.create({
          data: {
            business_id,
            product_id: itemData.product_id,
            variant_id: itemData.variant_id || null,
            quantity: itemData.quantity
          }
        });
      }

      if (itemData.variant_id) {
        await tx.product_variants.update({
          where: { id: itemData.variant_id },
          data: {
            current_stock: { increment: itemData.quantity }
          }
        });
      }

      // Log stock transaction
      await tx.stock_transactions.create({
        data: {
          business_id,
          product_id: itemData.product_id,
          variant_id: itemData.variant_id,
          transaction_type: 'PURCHASE',
          quantity: itemData.quantity,
          reference_id: purchase.id,
          reference_number: purchase.purchase_number,
          notes: 'Purchase Inward',
          created_by: user_id || null
        }
      });
    }

    await logAudit({
      business_id,
      user_id,
      action: 'PURCHASE_CREATED',
      module: 'PURCHASES',
      reference_id: purchase.id,
      new_data: { purchase_number: purchase.purchase_number, grand_total: purchase.grand_total }
    }, tx);

    return purchase;
  });

  // Trigger Purchase Email Async
  const { sendPurchaseOrderEmail } = require('./notification.service');
  setTimeout(() => {
    sendPurchaseOrderEmail(business_id, purchaseResult.id).catch(err => console.error('Async purchase email error:', err.message));
  }, 10);

  return purchaseResult;
};

const returnPurchase = async (business_id, purchaseId, user_id, returnData) => {
  const { returned_items = [], reason = 'Debit Note / Purchase Return' } = returnData;

  const result = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchases.findFirst({
      where: { id: purchaseId, business_id },
      include: {
        purchase_items: true,
        suppliers: true
      }
    });

    if (!purchase) {
      const err = new Error('Purchase record not found');
      err.statusCode = 404;
      throw err;
    }

    const returnRefNumber = `PR-${Date.now().toString().slice(-6)}`;
    let totalReturnAmount = 0;

    for (const retItem of returned_items) {
      const matchedItem = purchase.purchase_items.find(
        (pi) => pi.product_id === retItem.product_id && (!retItem.variant_id || pi.variant_id === retItem.variant_id)
      );

      if (!matchedItem) {
        const err = new Error(`Item ${retItem.product_id} not found in original purchase bill`);
        err.statusCode = 400;
        throw err;
      }

      const returnQty = Number(retItem.quantity);
      if (returnQty <= 0) continue;

      const unitPrice = Number(matchedItem.unit_price || 0);
      const lineTotal = unitPrice * returnQty;
      totalReturnAmount += lineTotal;

      // Deduct stock via PURCHASE_RETURN stock transaction
      await tx.stock_transactions.create({
        data: {
          business_id,
          product_id: retItem.product_id,
          variant_id: retItem.variant_id || null,
          transaction_type: 'PURCHASE_RETURN',
          quantity: returnQty,
          reference_id: purchase.id,
          reference_number: purchase.purchase_number || returnRefNumber,
          notes: `Purchase Return [${returnRefNumber}]: Returned ${returnQty} PCS to supplier (${reason})`,
          created_by: user_id || null
        }
      });

      // Decrement variant stock if applicable
      if (retItem.variant_id) {
        try {
          await tx.product_variants.update({
            where: { id: retItem.variant_id },
            data: { current_stock: { decrement: returnQty } }
          });
        } catch (e) {
          console.warn('Could not decrement variant stock:', e.message);
        }
      }

      // Decrement product_stock
      try {
        const stockRecord = await tx.product_stock.findFirst({
          where: { business_id, product_id: retItem.product_id, variant_id: retItem.variant_id || null }
        });
        if (stockRecord) {
          await tx.product_stock.update({
            where: { id: stockRecord.id },
            data: { quantity: { decrement: returnQty } }
          });
        }
      } catch (e) {
        console.warn('Could not update product_stock:', e.message);
      }
    }

    // Append return audit log in purchase notes
    const returnSummary = `[RETURNED on ${new Date().toISOString().split('T')[0]}]: ₹${totalReturnAmount.toFixed(2)} (${reason})`;
    const updatedNotes = purchase.notes ? `${purchase.notes}\n${returnSummary}` : returnSummary;

    // Adjust balance amount on purchase bill
    const newBalance = Math.max(0, Number(purchase.balance_amount || 0) - totalReturnAmount);

    await tx.purchases.update({
      where: { id: purchase.id },
      data: {
        notes: updatedNotes,
        balance_amount: newBalance
      }
    });

    await logAudit({
      business_id,
      user_id,
      action: 'PURCHASE_RETURN_PROCESSED',
      module: 'PURCHASES',
      reference_id: purchase.id,
      new_data: { returnRefNumber, totalReturnAmount, reason }
    }, tx);

    return {
      message: 'Purchase return processed successfully',
      returnRefNumber,
      totalReturnAmount,
      purchaseId: purchase.id
    };
  });

  return result;
};

module.exports = {
  getPurchases,
  getPurchaseById,
  createPurchase,
  returnPurchase
};
