// @desc    Middleware to ensure tenantId is available in request
//          This should be used after authentication middleware
const ensureTenant = (req, res, next) => {
  if (!req.user || !req.user.tenantId) {
    return res.status(401).json({
      success: false,
      message: 'Tenant information not available. Please login again.'
    });
  }
  next();
};

// @desc    Helper function to add tenantId to query
//          Usage: const query = addTenantFilter({ status: 'ready' }, req.user.tenantId)
const addTenantFilter = (query, tenantId) => {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant filtering');
  }
  return { ...query, tenantId };
};

// @desc    Helper function to create tenant-scoped query
//          Usage: const videos = await Video.find(tenantQuery(req.user.tenantId, { status: 'ready' }))
const tenantQuery = (tenantId, additionalFilters = {}) => {
  if (!tenantId) {
    throw new Error('tenantId is required for tenant filtering');
  }
  return { tenantId, ...additionalFilters };
};

// @desc    Middleware to automatically add tenantId to request body for POST/PUT requests
const injectTenantId = (req, res, next) => {
  if (req.user && req.user.tenantId) {
    // Automatically add tenantId to request body for create/update operations
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      // Ensure req.body exists (for multipart/form-data, body may be undefined before multer)
      if (!req.body) {
        req.body = {};
      }
      req.body.tenantId = req.user.tenantId;
    }
  }
  next();
};

module.exports = {
  ensureTenant,
  addTenantFilter,
  tenantQuery,
  injectTenantId
};

