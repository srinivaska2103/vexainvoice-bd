const prisma = require('../config/db');
const { logAudit } = require('./audit.service');

const createCustomerPayment = async (business_id, user_id, data) => {
  const payResult = await prisma.$transaction(async (tx) => {
    const customer = await tx.customers.findFirst({
      where: { id: data.customer_id, business_id }
    });
    if (!customer) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const amt = parseFloat(data.amount || 0);
    const pm = data.payment_method || data.paymentMethod || 'CASH';
    const validPm = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'].includes(pm) ? pm : 'CASH';

    const payment = await tx.customer_payments.create({
      data: {
        business_id,
        customer_id: data.customer_id,
        sale_id: data.sale_id || null,
        amount: amt,
        payment_method: validPm,
        reference_number: data.reference_number || null,
        notes: data.notes || null,
        created_by: user_id || null
      }
    });

    // Reduce Customer Current Balance
    await tx.customers.update({
      where: { id: data.customer_id },
      data: { current_balance: { decrement: amt } }
    });

    if (data.sale_id) {
      const sale = await tx.sales.findFirst({ where: { id: data.sale_id, business_id } });
      if (sale) {
        const grand = Number(sale.grand_total || sale.total_amount || 0);
        const newPaid = Number(sale.paid_amount || 0) + amt;
        const newBal = Math.max(0, grand - newPaid);
        const status = newBal <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
        await tx.sales.update({
          where: { id: data.sale_id },
          data: {
            paid_amount: newPaid,
            balance_amount: newBal
          }
        });
      }
    } else {
      // Auto-allocate general payment against unpaid/partially paid invoices (FIFO order)
      const unpaidSales = await tx.sales.findMany({
        where: {
          business_id,
          customer_id: data.customer_id,
          balance_amount: { gt: 0 }
        },
        orderBy: { created_at: 'asc' }
      });

      let remainingPay = amt;
      for (const sale of unpaidSales) {
        if (remainingPay <= 0) break;

        const currentBal = Number(sale.balance_amount || 0);
        const currentPaid = Number(sale.paid_amount || 0);
        const grand = Number(sale.grand_total || sale.total_amount || 0);

        const allocate = Math.min(remainingPay, currentBal);
        const updatedPaid = currentPaid + allocate;
        const updatedBal = Math.max(0, grand - updatedPaid);

        await tx.sales.update({
          where: { id: sale.id },
          data: {
            paid_amount: updatedPaid,
            balance_amount: updatedBal
          }
        });

        remainingPay -= allocate;
      }
    }

    return payment;
  });

  const { sendCustomerPaymentEmail } = require('./notification.service');
  setTimeout(() => {
    sendCustomerPaymentEmail(business_id, payResult.id).catch(err => console.error('Customer payment email error:', err.message));
  }, 10);

  return payResult;
};

const getCustomerPayments = async (business_id, customerId = null, queryParams = {}) => {
  const { page = 1, limit = 20 } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(customerId ? { customer_id: customerId } : {})
  };

  const total = await prisma.customer_payments.count({ where });
  const payments = await prisma.customer_payments.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { payment_date: 'desc' },
    include: {
      customers: true
    }
  });

  return {
    payments,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

const createSupplierPayment = async (business_id, user_id, data) => {
  const amt = parseFloat(data.amount || 0);
  const pm = data.payment_method || data.paymentMethod || 'CASH';
  const validPm = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT'].includes(pm) ? pm : 'CASH';
  const supplierId = data.supplier_id || data.supplierId;

  const payment = await prisma.$transaction(async (tx) => {
    const pay = await tx.supplier_payments.create({
      data: {
        business_id,
        supplier_id: supplierId,
        purchase_id: data.purchase_id || data.purchaseId || null,
        amount: amt,
        payment_method: validPm,
        reference_number: data.reference_number || data.referenceNumber || null,
        notes: data.notes || null,
        created_by: user_id || null
      }
    });

    // Update supplier balance
    if (supplierId) {
      await tx.suppliers.update({
        where: { id: supplierId },
        data: { current_balance: { decrement: amt } }
      });
    }

    // Update specific purchase bill balance if allocated
    if (data.purchase_id || data.purchaseId) {
      const purId = data.purchase_id || data.purchaseId;
      const pur = await tx.purchases.findFirst({ where: { id: purId, business_id } });
      if (pur) {
        const newPaid = Number(pur.paid_amount || 0) + amt;
        const newBal = Number(pur.grand_total || 0) - newPaid;
        await tx.purchases.update({
          where: { id: purId },
          data: {
            paid_amount: newPaid,
            balance_amount: Math.max(0, newBal)
          }
        });
      }
    }

    return pay;
  });

  const { sendSupplierPaymentEmail } = require('./notification.service');
  setTimeout(() => {
    sendSupplierPaymentEmail(business_id, payment.id).catch(err => console.error('Supplier payment email error:', err.message));
  }, 10);

  return payment;
};

const getSupplierPayments = async (business_id, supplierId = null, queryParams = {}) => {
  const { page = 1, limit = 20 } = queryParams;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = {
    business_id,
    ...(supplierId ? { supplier_id: supplierId } : {})
  };

  const total = await prisma.supplier_payments.count({ where });
  const payments = await prisma.supplier_payments.findMany({
    where,
    skip,
    take: limitNum,
    orderBy: { payment_date: 'desc' },
    include: {
      suppliers: true
    }
  });

  return {
    payments,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
  };
};

module.exports = {
  createCustomerPayment,
  getCustomerPayments,
  createSupplierPayment,
  getSupplierPayments
};
