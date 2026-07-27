import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Database, Laptop } from 'lucide-react';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { apiMode, setApiMode } = useAuth();

  return (
    <header style={headerStyle}>
      <div style={titleContainerStyle}>
        <h1 style={titleStyle}>{title}</h1>
      </div>

      <div style={actionsContainerStyle}>
        {/* API Selector Switcher */}
        <div style={switcherContainerStyle} className="glass-panel">
          <button 
            onClick={() => setApiMode('demo')} 
            style={{
              ...switchBtnStyle,
              ...(apiMode === 'demo' ? activeDemoStyle : {})
            }}
            title="Interact without a running backend server"
          >
            <Laptop size={14} />
            <span>Demo Mode</span>
          </button>
          
          <button 
            onClick={() => setApiMode('live')} 
            style={{
              ...switchBtnStyle,
              ...(apiMode === 'live' ? activeLiveStyle : {})
            }}
            title="Connect to local/remote Go API server"
          >
            <Database size={14} />
            <span>Live API</span>
          </button>
        </div>

        {/* Status Indicator */}
        <div style={statusBadgeStyle(apiMode)}>
          <span style={indicatorDotStyle(apiMode)} />
          <span>{apiMode === 'demo' ? 'Local Sandbox' : 'Backend Linked'}</span>
        </div>
      </div>
    </header>
  );
};

// Inline styles for header spacing and modular toggles
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingBottom: '1.5rem',
  marginBottom: '2rem',
  borderBottom: '1px solid var(--border-color)',
  flexWrap: 'wrap',
  gap: '1rem'
};

const titleContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  margin: 0,
  fontWeight: 700,
  background: 'linear-gradient(to right, #ffffff, #9ca3af)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
};

const actionsContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem'
};

const switcherContainerStyle: React.CSSProperties = {
  display: 'flex',
  padding: '3px',
  borderRadius: '10px',
  gap: '2px',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  border: '1px solid var(--border-color)'
};

const switchBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '6px 12px',
  borderRadius: '8px',
  border: 'none',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text-secondary)',
  transition: 'all 0.2s ease'
};

const activeDemoStyle: React.CSSProperties = {
  background: '#064e3b',
  color: '#34d399',
  boxShadow: '0 0 10px rgba(52, 211, 153, 0.15)'
};

const activeLiveStyle: React.CSSProperties = {
  background: '#14532d',
  color: '#4ade80',
  boxShadow: '0 0 10px rgba(34, 197, 94, 0.15)'
};

const statusBadgeStyle = (mode: 'live' | 'demo'): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '6px 12px',
  borderRadius: '8px',
  border: '1px solid',
  borderColor: mode === 'demo' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(34, 197, 94, 0.2)',
  background: mode === 'demo' ? 'rgba(52, 211, 153, 0.05)' : 'rgba(34, 197, 94, 0.05)',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: mode === 'demo' ? '#34d399' : '#4ade80'
});

const indicatorDotStyle = (mode: 'live' | 'demo'): React.CSSProperties => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  backgroundColor: mode === 'demo' ? '#10b981' : '#22c55e',
  display: 'inline-block',
  boxShadow: mode === 'demo' 
    ? '0 0 8px #10b981' 
    : '0 0 8px #22c55e',
  animation: mode === 'live' ? 'pulse-glow 2s infinite' : 'none'
});
