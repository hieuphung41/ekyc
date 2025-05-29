import React from 'react';
import ApiClientSidebar from './ApiClientSidebar';
import { useDispatch } from 'react-redux';
import { logoutApiClient } from './apiClientSlice';
import { useNavigate } from 'react-router-dom';

const ApiClientLayout = ({ children }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await dispatch(logoutApiClient()).unwrap();
      navigate('/api-client/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <ApiClientSidebar onLogout={handleLogout} />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default ApiClientLayout; 