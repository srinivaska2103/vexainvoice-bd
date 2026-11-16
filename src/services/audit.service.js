const prisma = require('../config/db');

/**
 * Creates an audit log entry mapped to companies and users.
 */
const logAudit = async ({
  business_id,
  company_id,
  user_id = null,
  action,
  module = 'SYSTEM',
  reference_id = null,
  old_data = null,
  new_data = null
}, tx = null) => {
  const db = tx || prisma;
  const tenantId = business_id || company_id;
  try {
    return await db.audit_logs.create({
      data: {
        business_id: tenantId,
        user_id: user_id || null,
        action,
        module: module || 'SYSTEM',
        reference_id: reference_id ? String(reference_id) : null,
        old_data: old_data || undefined,
        new_data: new_data || undefined
      }
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
};


module.exports = { logAudit };
