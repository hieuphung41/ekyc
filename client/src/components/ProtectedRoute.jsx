import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    // Redirect to login page but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If role is required, check if user has the required role
  if (requiredRole && user?.role !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    return <Navigate to={user?.role === 'admin' ? '/admin/dashboard' : '/dashboard'} replace />;
  }

  return children;
};

export default ProtectedRoute; 