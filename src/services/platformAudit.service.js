const prisma = require('../config/db');

/**
 * Service to record platform-level administrative actions.
 * Logs actor (super admin), action, target entity, timestamp, metadata.
 * Does NOT log passwords, secrets, or sensitive card credentials.
 */
const logPlatformAudit = async ({
  admin_id,
  admin_email,
  action,
  target_type, // 'COMPANY', 'USER', 'SUBSCRIPTION', 'PAYMENT', 'SETTING'
  target_id = null,
  company_id = null,
  details = null,
  ip_address = null
}) => {
  try {
    // If target has an associated business, we can also link to audit_logs or store in platform audit store
    // Let's create an audit_log record with module 'PLATFORM_SUPER_ADMIN'
    // If company_id / business_id is known, link to it; otherwise find first business or use SYSTEM
    let targetBusinessId = null;
    if (company_id) {
      const biz = await prisma.businesses.findFirst({
        where: { OR: [{ id: company_id }, { company_id: company_id }] },
        select: { id: true }
      });
      if (biz) targetBusinessId = biz.id;
    }

    // Sanitize details to guarantee no sensitive data is stored
    let cleanDetails = null;
    if (details && typeof details === 'object') {
      cleanDetails = { ...details };
      const redactKeys = ['password', 'password_hash', 'secret', 'key', 'token', 'jwt', 'cvv', 'card_number'];
      for (const k of Object.keys(cleanDetails)) {
        if (redactKeys.some(rk => k.toLowerCase().includes(rk))) {
          cleanDetails[k] = '[REDACTED]';
        }
      }
    }

    if (targetBusinessId) {
      await prisma.audit_logs.create({
        data: {
          business_id: targetBusinessId,
          action: `SUPER_ADMIN_${action}`,
          module: 'PLATFORM_SUPER_ADMIN',
          reference_id: target_id ? String(target_id) : null,
          new_data: {
            admin_id,
            admin_email,
            target_type,
            ip_address,
            details: cleanDetails,
            logged_at: new Date().toISOString()
          }
        }
      });
    }

    console.log(`🛡️ [SUPER ADMIN AUDIT] Action: ${action} | Admin: ${admin_email} | Target: ${target_type} (${target_id || 'N/A'})`);
  } catch (err) {
    console.error('Failed to log platform audit:', err.message);
  }
};

module.exports = { logPlatformAudit };
