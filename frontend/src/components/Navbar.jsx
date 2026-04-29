import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout, isAdmin, isEditor } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-brand">
          <span className="brand-icon">🎬</span>
          <span className="brand-text">Pulse Video</span>
        </Link>

        <div className="navbar-menu">
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>

          {/* Show Upload button only for Editor and Admin */}
          {(isEditor() || isAdmin()) && (
            <Link to="/upload" className="nav-link">
              Upload
            </Link>
          )}

          {/* Show User Management only for Admin */}
          {isAdmin() && (
            <Link to="/users" className="nav-link">
              User Management
            </Link>
          )}

          <div className="navbar-user">
            <span className="user-email">{user?.email}</span>
            <span className="user-role">{user?.role}</span>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
