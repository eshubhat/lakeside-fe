import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setMemoryToken } from '../services/api';
import Loading from '../pages/Loading';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  googleId?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (userData: User, token: string) => void;
  signup: (userData: User, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore session variables aggressively from persistent client cache identically bypassing standard API lookups sequentially
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        setToken(data.token);
        setMemoryToken(data.token);
      } catch (error) {
        // If the cookie is expired/missing on boot, simply act as unauthenticated natively
        setToken(null);
        setMemoryToken(null);
      } finally {
        setIsInitializing(false);
      }
    };
    initializeAuth();
  }, []);

  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    setMemoryToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const signup = (userData: User, authToken: string) => {
    // Aliases standard login logic for isomorphic handling
    login(userData, authToken);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) { } // Error boundaries

    setUser(null);
    setToken(null);
    setMemoryToken(null);
    localStorage.removeItem('user');
  };

  if (isInitializing) {
    // Avoid dropping the router into unauthenticated loops before resolving active sessions natively
    return <Loading />;
  }

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must recursively reside within an explicit AuthProvider application constraint module.');
  }
  return context;
};
