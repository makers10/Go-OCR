import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import client from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  apiMode: 'live' | 'demo';
  setApiMode: (mode: 'live' | 'demo') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [apiMode, setApiModeState] = useState<'live' | 'demo'>(client.mode);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load initial session on mount
    const savedToken = localStorage.getItem('ocr_jwt_token');
    const savedUser = client.getCurrentUser();
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(savedUser);
    }
    setIsLoading(false);

    // Synchronize mode transitions
    const handleModeChange = () => {
      setApiModeState(client.mode);
    };

    const handleLogout = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('api-mode-change', handleModeChange);
    window.addEventListener('auth-logout', handleLogout);

    return () => {
      window.removeEventListener('api-mode-change', handleModeChange);
      window.removeEventListener('auth-logout', handleLogout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await client.login(email, password);
      setToken(res.token);
      setUser(res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    client.logout();
    setToken(null);
    setUser(null);
  };

  const setApiMode = (mode: 'live' | 'demo') => {
    client.mode = mode;
    setApiModeState(mode);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        apiMode,
        setApiMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
