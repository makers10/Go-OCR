import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, AlertCircle, Laptop, Database } from 'lucide-react';
import { OcrLogo } from '../components/OcrLogo';

export const LoginPage: React.FC = () => {
  const { login, apiMode, setApiMode } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/documents');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('demo@example.com');
    setPassword('password123');
    setError(null);
  };

  return (
    <div style={containerStyle}>
      {/* Decorative Glow Background */}
      <div style={bgGlowLeftStyle} />
      <div style={bgGlowRightStyle} />

      <div style={cardStyle} className="glass-panel animate-fade-in">
        {/* Title Brand Header */}
        <div style={brandHeaderStyle}>
          <div style={logoIconStyle}>
            <OcrLogo size={28} />
          </div>
          <h1 style={titleStyle}>DigitalOCR</h1>
          <p style={subtitleStyle}>Advanced Self-Hosted Document Parsing</p>
        </div>

        {/* Mode Switcher */}
        <div style={switcherStyle}>
          <button 
            type="button"
            onClick={() => setApiMode('demo')} 
            style={{
              ...switchBtnStyle,
              ...(apiMode === 'demo' ? activeDemoStyle : {})
            }}
          >
            <Laptop size={14} />
            <span>Sandbox Demo</span>
          </button>
          
          <button 
            type="button"
            onClick={() => setApiMode('live')} 
            style={{
              ...switchBtnStyle,
              ...(apiMode === 'live' ? activeLiveStyle : {})
            }}
          >
            <Database size={14} />
            <span>Live Server API</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={formStyle}>
          {error && (
            <div style={errorContainerStyle}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Email Address</label>
            <div style={inputContainerStyle}>
              <Mail size={16} color="var(--text-muted)" style={inputIconStyle} />
              <input 
                type="email" 
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Password</label>
            <div style={inputContainerStyle}>
              <Lock size={16} color="var(--text-muted)" style={inputIconStyle} />
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary"
            style={submitBtnStyle}
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>

          {/* Quick filler button in demo mode */}
          {apiMode === 'demo' && (
            <button 
              type="button" 
              onClick={handleFillDemo}
              className="btn btn-secondary"
              style={demoFillBtnStyle}
            >
              Autofill Sandbox Credentials
            </button>
          )}
        </form>

        <div style={footerStyle}>
          <span>DigitalOCR Single-Tenant Node. Single-user authentication.</span>
        </div>
      </div>
    </div>
  );
};

// Aesthetics page layouts
const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-base)',
  padding: '1.5rem',
  position: 'relative',
  overflow: 'hidden'
};

const bgGlowLeftStyle: React.CSSProperties = {
  position: 'absolute',
  top: '-10%',
  left: '-10%',
  width: '40vw',
  height: '40vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(34, 197, 94, 0.12) 0%, transparent 70%)',
  pointerEvents: 'none'
};

const bgGlowRightStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '-10%',
  right: '-10%',
  width: '45vw',
  height: '45vw',
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(249, 115, 22, 0.08) 0%, transparent 70%)',
  pointerEvents: 'none'
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: '430px',
  padding: '2.5rem 2rem',
  backgroundColor: 'var(--bg-panel)',
  zIndex: 5
};

const brandHeaderStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '2rem'
};

const logoIconStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '56px',
  height: '56px',
  borderRadius: '14px',
  background: 'linear-gradient(135deg, #166534, #15803d, #1a4731)',
  boxShadow: '0 0 28px rgba(34, 197, 94, 0.4)',
  marginBottom: '1rem'
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.8rem',
  fontWeight: 800,
  margin: '0 0 4px 0',
  letterSpacing: '-0.03em',
  background: 'linear-gradient(to right, #ffffff, #4ade80)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent'
};

const subtitleStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  margin: 0
};

const switcherStyle: React.CSSProperties = {
  display: 'flex',
  padding: '3px',
  borderRadius: '10px',
  gap: '2px',
  backgroundColor: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid var(--border-color)',
  marginBottom: '2rem'
};

const switchBtnStyle: React.CSSProperties = {
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.4rem',
  padding: '8px 12px',
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
  color: '#34d399'
};

const activeLiveStyle: React.CSSProperties = {
  background: '#14532d',
  color: '#4ade80'
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem'
};

const errorContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '8px 12px',
  backgroundColor: 'rgba(239, 68, 68, 0.08)',
  border: '1px solid rgba(239, 68, 68, 0.15)',
  borderRadius: '8px',
  color: 'var(--error)',
  fontSize: '0.8rem'
};

const fieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 500,
  color: 'var(--text-secondary)'
};

const inputContainerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center'
};

const inputIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '12px',
  pointerEvents: 'none'
};

const inputStyle: React.CSSProperties = {
  paddingLeft: '36px'
};

const submitBtnStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  width: '100%'
};

const demoFillBtnStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.5rem',
  borderColor: 'rgba(52, 211, 153, 0.2)',
  color: '#34d399',
  background: 'transparent'
};

const footerStyle: React.CSSProperties = {
  marginTop: '2rem',
  textAlign: 'center',
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  borderTop: '1px solid var(--border-color)',
  paddingTop: '1.25rem'
};
