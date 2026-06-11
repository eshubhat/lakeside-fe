import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setMemoryToken } from '../services/api';
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

  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) setMemoryToken(savedToken);
    return savedToken;
  });
  useEffect(() => {
    // Asynchronously try to refresh the token in the background just in case it's nearing expiration,
    // but don't block the UI rendering on it, and don't wipe the session if it fails 
    // (since the access token is stored in localStorage now).
    const backgroundRefresh = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (data.token) {
          setToken(data.token);
          setMemoryToken(data.token);
          localStorage.setItem('token', data.token);
        }
      } catch (error) {
        // Ignore refresh failure on boot, we have the local token.
      }
    };
    if (token) backgroundRefresh();
  }, []);

  const login = (userData: User, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    setMemoryToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
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
    localStorage.removeItem('token');
  };

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
