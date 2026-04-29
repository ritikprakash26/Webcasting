const User = require('../models/User');
const { tenantQuery } = require('../middlewares/tenant.middleware');
const { asyncHandler, NotFoundError, ValidationError } = require('../middlewares/errorHandler.middleware');

// @desc    Get all users for the current tenant
// @route   GET /api/users
// @access  Private (Admin)
const getAllUsers = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;

  // Only return users from the same tenant
  const users = await User.find(tenantQuery(tenantId))
    .populate('organization', 'name tenantId')
    .select('-password')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: users.length,
    data: { users }
  });
});

// @desc    Get single user by ID (tenant-scoped)
// @route   GET /api/users/:id
// @access  Private (Admin)
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Ensure user belongs to the tenant
  const user = await User.findOne(tenantQuery(tenantId, { _id: id }))
    .populate('organization', 'name tenantId')
    .select('-password');

  if (!user) {
    throw new NotFoundError('User');
  }

  res.status(200).json({
    success: true,
    data: { user }
  });
});

// @desc    Update user (tenant-scoped)
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Ensure user belongs to the tenant
  const user = await User.findOne(tenantQuery(tenantId, { _id: id }));

  if (!user) {
    throw new NotFoundError('User');
  }

  // Prevent tenantId from being changed
  delete req.body.tenantId;

  // If password is being updated, it will be hashed by the pre-save hook
  const updatedUser = await User.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate('organization', 'name tenantId')
    .select('-password');

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user: updatedUser }
  });
});

// @desc    Delete user (tenant-scoped)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  // Prevent self-deletion
  if (id === req.user.userId) {
    throw new ValidationError('You cannot delete your own account');
  }

  // Ensure user belongs to the tenant
  const user = await User.findOne(tenantQuery(tenantId, { _id: id }));

  if (!user) {
    throw new NotFoundError('User');
  }

  await User.findByIdAndDelete(id);

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
    data: {}
  });
});

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
};

