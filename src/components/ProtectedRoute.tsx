import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token } = useAuth();

  // Route security boundary bouncing unauthenticated actors aggressively
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // Abstractly parses children sequentially allowing identical downstream flexibility
  return children ? <>{children}</> : <Outlet />;
};
