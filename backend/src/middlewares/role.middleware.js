/**
 * Check if user has required role(s)
 * @param {...string} roles - Allowed roles (e.g., "admin", "editor")
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.post('/videos', checkRole("admin", "editor"), createVideo);
 */
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, please login'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = roles;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `User role '${userRole}' is not authorized to access this route. Required roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Legacy authorize function (alias for checkRole)
 * @deprecated Use checkRole instead
 */
const authorize = (...roles) => {
  return checkRole(...roles);
};

// @desc    Check if user belongs to the same tenant
const checkTenant = (req, res, next) => {
  const userTenantId = req.user.tenantId;
  const requestedTenantId = req.params.tenantId || req.body.tenantId;

  if (requestedTenantId && requestedTenantId !== userTenantId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access resources from your own organization'
    });
  }

  next();
};

module.exports = {
  checkRole,
  authorize, // Legacy alias
  checkTenant
};
