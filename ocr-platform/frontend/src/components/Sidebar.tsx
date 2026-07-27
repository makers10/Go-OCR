import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileText, UploadCloud, Search, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OcrLogo } from './OcrLogo';

export const Sidebar: React.FC = () => {
  const { user, logout, apiMode } = useAuth();

  return (
    <aside style={sidebarStyle} className="glass-panel">
      {/* Brand Logo */}
      <div style={brandStyle}>
        <div style={logoIconStyle}>
          <OcrLogo size={22} />
        </div>
        <div>
          <h2 style={brandTitleStyle}>DigitalOCR</h2>
          <span style={brandSubStyle}>{apiMode === 'demo' ? 'Offline Demo' : 'Enterprise'}</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={navStyle}>
        <NavLink 
          to="/documents" 
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeLinkStyle : {})
          })}
        >
          <FileText size={18} />
          <span>My Documents</span>
        </NavLink>

        <NavLink 
          to="/upload" 
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeLinkStyle : {})
          })}
        >
          <UploadCloud size={18} />
          <span>Upload File</span>
        </NavLink>

        <NavLink 
          to="/search" 
          style={({ isActive }) => ({
            ...linkStyle,
            ...(isActive ? activeLinkStyle : {})
          })}
        >
          <Search size={18} />
          <span>OCR Search</span>
        </NavLink>
      </nav>

      {/* Bottom Profile and Action */}
      <div style={footerStyle}>
        {user && (
          <div style={userCardStyle}>
            <div style={avatarStyle}>
              {user.email[0].toUpperCase()}
            </div>
            <div style={userInfoStyle}>
              <div style={userEmailStyle}>{user.email}</div>
              <div style={userRoleStyle}>Authorized User</div>
            </div>
          </div>
        )}
        
        <button onClick={logout} style={logoutBtnStyle}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

// Inline styles mapped inside vanilla layout context (avoiding heavy external libraries)
const sidebarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  borderRadius: 0,
  borderTop: 'none',
  borderBottom: 'none',
  borderLeft: 'none',
  padding: '2rem 1.5rem',
  backgroundColor: 'var(--bg-panel)',
  zIndex: 10,
  position: 'sticky',
  top: 0
};

const brandStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '2.5rem'
};

const logoIconStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #166534, #15803d, #1a4731)',
  boxShadow: '0 0 20px rgba(34, 197, 94, 0.35)'
};

const brandTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  background: 'linear-gradient(to right, #fff, #4ade80)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
};

const brandSubStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 700
};

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  flex: 1
};

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
  padding: '0.85rem 1rem',
  borderRadius: '10px',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  fontSize: '0.95rem',
  transition: 'all 0.2s ease'
};

const activeLinkStyle: React.CSSProperties = {
  color: '#fff',
  background: 'rgba(34, 197, 94, 0.1)',
  border: '1px solid rgba(34, 197, 94, 0.2)'
};

const footerStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border-color)',
  paddingTop: '1.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem'
};

const userCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.25rem'
};

const avatarStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  background: '#14532d',
  border: '1px solid #166534',
  color: '#e0e7ff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.95rem'
};

const userInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const userEmailStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 500,
  color: 'var(--text-primary)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

const userRoleStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)'
};

const logoutBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  padding: '0.65rem',
  borderRadius: '8px',
  background: 'transparent',
  border: '1px solid var(--border-color)',
  color: 'var(--error)',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.85rem',
  transition: 'all 0.15s ease'
};
