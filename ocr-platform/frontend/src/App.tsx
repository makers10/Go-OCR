import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { DocumentListPage } from './pages/DocumentListPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { UploadPage } from './pages/UploadPage';
import { SearchPage } from './pages/SearchPage';
import { Sidebar } from './components/Sidebar';
import { Loader2 } from 'lucide-react';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={appLoaderStyle}>
        <Loader2 size={40} className="spinner" color="var(--primary)" />
        <span style={appLoaderTextStyle}>Loading DigitalOCR Session...</span>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

const AuthRouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={appLoaderStyle}>
        <Loader2 size={40} className="spinner" color="var(--primary)" />
      </div>
    );
  }

  if (token) {
    return <Navigate to="/documents" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Auth Page */}
      <Route 
        path="/login" 
        element={
          <AuthRouteGuard>
            <LoginPage />
          </AuthRouteGuard>
        } 
      />

      {/* Protected Dashboard Pages */}
      <Route 
        path="/documents" 
        element={
          <ProtectedLayout>
            <DocumentListPage />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/documents/:id" 
        element={
          <ProtectedLayout>
            <DocumentDetailPage />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/upload" 
        element={
          <ProtectedLayout>
            <UploadPage />
          </ProtectedLayout>
        } 
      />
      <Route 
        path="/search" 
        element={
          <ProtectedLayout>
            <SearchPage />
          </ProtectedLayout>
        } 
      />

      {/* Wildcard Fallback */}
      <Route path="*" element={<Navigate to="/documents" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

// Global App Loading Styles
const appLoaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  backgroundColor: 'var(--bg-base)',
  gap: '1.25rem',
  color: 'var(--text-primary)'
};

const appLoaderTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  fontSize: '1rem',
  fontWeight: 500,
  letterSpacing: '0.02em',
  color: 'var(--text-secondary)'
};

export default App;
