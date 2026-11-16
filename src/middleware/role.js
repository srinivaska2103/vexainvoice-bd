const { sendError } = require('../utils/response.util');

const authorize = (...allowedRolesOrPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return sendError(res, 'Access denied. Authentication required.', 401);
    }

    // ADMIN has unconditional access
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // If the user is assigned to a custom role, their custom permissions are strictly authoritative!
    if (req.user.custom_role) {
      if (req.user.custom_role.is_active === false) {
        return sendError(res, `Access denied. Role '${req.user.custom_role.name}' is currently deactivated.`, 403);
      }
      if (Array.isArray(req.user.permissions)) {
        if (req.user.permissions.includes('*')) {
          return next();
        }
        const hasPerm = allowedRolesOrPermissions.some(perm => req.user.permissions.includes(perm));
        if (hasPerm) {
          return next();
        }
      }
      // Also match if specific custom role slug was explicitly allowed
      if (req.user.custom_role.slug && allowedRolesOrPermissions.includes(req.user.custom_role.slug)) {
        return next();
      }
      return sendError(res, `Access denied. Role '${req.user.custom_role.name}' is not authorized for this resource.`, 403);
    }

    // Standard system role check (when user has no custom role)
    if (allowedRolesOrPermissions.includes(req.user.role)) {
      return next();
    }

    // Check user custom permissions (if any)
    if (Array.isArray(req.user.permissions)) {
      if (req.user.permissions.includes('*')) {
        return next();
      }
      const hasPerm = allowedRolesOrPermissions.some(perm => req.user.permissions.includes(perm));
      if (hasPerm) {
        return next();
      }
    }

    return sendError(res, `Access denied. Role '${req.user.custom_role ? req.user.custom_role.name : req.user.role}' is not authorized for this resource.`, 403);
  };
};

module.exports = { authorize };
