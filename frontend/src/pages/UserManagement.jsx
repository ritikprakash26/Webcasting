import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../services/api';
import './UserManagement.css';

const UserManagement = () => {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [editedRoles, setEditedRoles] = useState({});

  useEffect(() => {
    if (!isAdmin()) {
      setError('Access denied. Admin role required.');
      setLoading(false);
      return;
    }
    fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await userAPI.getAll();
      if (response.data.success) {
        setUsers(response.data.data.users || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    setEditedRoles((prev) => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleSaveUser = async (user) => {
    const userId = user._id || user.id;
    const newRole = editedRoles[userId] || user.role;

    if (newRole === user.role) {
      return; // nothing to save
    }

    try {
      setSavingUserId(userId);
      setError('');
      await userAPI.update(userId, { role: newRole });
      await fetchUsers();
    } catch (err) {
      console.error('Update user error:', err);
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    const userId = user._id || user.id;

    // Prevent deleting currently logged-in admin (backend also guards this)
    if (currentUser && (currentUser.id === userId || currentUser._id === userId)) {
      setError('You cannot delete your own account.');
      return;
    }

    const confirmed = window.confirm(`Delete user ${user.email}?`);
    if (!confirmed) return;

    try {
      setDeletingUserId(userId);
      setError('');
      await userAPI.delete(userId);
      await fetchUsers();
    } catch (err) {
      console.error('Delete user error:', err);
      setError(err.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  if (!isAdmin()) {
    return (
      <div className="user-management-page">
        <div className="error-container">
          <h2>Access Denied</h2>
          <p>You must be an administrator to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management-page">
      <div className="user-management-container">
        <h1>User Management</h1>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : (
          <div className="users-table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Tenant ID</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user) => {
                    const userId = user._id || user.id;
                    const roleValue = editedRoles[userId] || user.role;
                    const isSelf = currentUser && (currentUser.id === userId || currentUser._id === userId);

                    return (
                      <tr key={userId}>
                        <td>{user.email}</td>
                        <td>
                          <select
                            value={roleValue}
                            onChange={(e) => handleRoleChange(userId, e.target.value)}
                            className="role-select"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td>{user.tenantId}</td>
                        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleSaveUser(user)}
                            disabled={savingUserId === userId}
                          >
                            {savingUserId === userId ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteUser(user)}
                            disabled={deletingUserId === userId || isSelf}
                          >
                            {deletingUserId === userId ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;

