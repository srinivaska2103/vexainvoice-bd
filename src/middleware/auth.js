const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/db');
const { sendError } = require('../utils/response.util');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: [env.JWT_ALGORITHM || 'HS256']
    });

    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        business_id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        custom_role_id: true,
        custom_roles: {
          select: {
            id: true,
            name: true,
            slug: true,
            permissions: true,
            is_active: true
          }
        },
        is_active: true,
        businesses: {
          select: {
            is_active: true,
            business_name: true,
            business_type: true
          }
        }
      }
    });

    if (!user || user.is_active === false) {
      return sendError(res, 'User account is inactive or no longer exists', 401);
    }

    if (!user.businesses || user.businesses.is_active === false) {
      return sendError(res, 'Associated business account is inactive', 403);
    }

    // Check if custom role is inactive / deactivated
    if (user.custom_roles && user.custom_roles.is_active === false) {
      return sendError(res, 'Your assigned custom role is currently deactivated. Please contact your company administrator.', 403);
    }

    // Multi-Server Dedicated Shop Guard: If this server instance is dedicated to a specific company, reject unauthorized tenants
    if (env.ASSIGNED_COMPANY_ID && user.business_id !== env.ASSIGNED_COMPANY_ID) {
      return sendError(res, 'Access denied: You are not authorized to access this dedicated shop application instance.', 403);
    }

    let permissions = [];
    if (user.role === 'ADMIN') {
      permissions = ['*'];
    } else if (user.custom_roles && Array.isArray(user.custom_roles.permissions)) {
      permissions = user.custom_roles.permissions;
    }

    req.user = {
      id: user.id,
      business_id: user.business_id,
      company_id: user.business_id,
      role: user.role,
      custom_role_id: user.custom_role_id || null,
      custom_role: user.custom_roles || null,
      permissions,
      name: user.name,
      email: user.email,
      business_type: user.businesses.business_type
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return sendError(res, 'Invalid or expired token', 401);
    }
    next(error);
  }
};

/**
 * Optional Authentication Middleware
 * If Authorization header is present and valid, attaches req.user; otherwise proceeds as guest
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      return next();
    }

    if (!decoded || !decoded.userId) {
      return next();
    }

    const user = await prisma.users.findUnique({
      where: { id: decoded.userId },
      include: {
        businesses: {
          select: {
            id: true,
            is_active: true,
            business_name: true,
            business_type: true,
            company_id: true,
            subscription_status: true
          }
        }
      }
    });

    if (user && user.is_active && user.businesses && user.businesses.is_active) {
      req.user = {
        id: user.id,
        business_id: user.business_id,
        company_id: user.businesses.company_id || user.business_id,
        role: user.role,
        name: user.name,
        email: user.email,
        business_name: user.businesses.business_name,
        business_type: user.businesses.business_type
      };
    }

    next();
  } catch (err) {
    next();
  }
};

module.exports = { authenticate, optionalAuthenticate };
