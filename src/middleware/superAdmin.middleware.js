const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');
const { sendError } = require('../utils/response.util');

/**
 * Platform-level Super Admin Authentication Middleware.
 * Enforces strict verification against the dedicated platform `admin_users` table.
 * Regular company users (even with role 'ADMIN') CANNOT pass this check.
 */
const authenticateSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Platform Super Admin authorization token required', 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET, {
        algorithms: [env.JWT_ALGORITHM || 'HS256']
      });
    } catch (jwtErr) {
      return sendError(res, 'Invalid or expired Super Admin token', 401);
    }

    // Must have explicit platform super admin token type/identity
    if (!decoded || !decoded.is_super_admin) {
      return sendError(res, 'Access denied: Platform Super Admin identity required', 403);
    }

    const admin = await prisma.admin_users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        is_active: true,
        last_login_at: true
      }
    });

    if (!admin || !admin.is_active) {
      return sendError(res, 'Platform Super Admin account is inactive or revoked', 403);
    }

    if (admin.role !== 'SUPER_ADMIN') {
      return sendError(res, 'Insufficient platform administrative privileges', 403);
    }

    req.superAdmin = admin;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticateSuperAdmin };
