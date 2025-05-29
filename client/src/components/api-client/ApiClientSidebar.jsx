import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutApiClient } from '../../features/apiClient/apiClientSlice';

const ApiClientSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.apiClient);

  const handleLogout = async () => {
    try {
      await dispatch(logoutApiClient()).unwrap();
      navigate('/api-client/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="bg-white h-screen w-64 fixed left-0 top-0 shadow-lg">
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800">API Client</h2>
      </div>
      
      <nav className="mt-6">
        <div className="px-4 space-y-2">
          <Link
            to="/api-client/dashboard"
            className={`flex items-center px-4 py-2 text-gray-700 rounded-lg ${
              isActive('/api-client/dashboard') ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <span className="mx-4">Dashboard</span>
          </Link>

          <Link
            to="/api-client/apis"
            className={`flex items-center px-4 py-2 text-gray-700 rounded-lg ${
              isActive('/api-client/apis') ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <span className="mx-4">APIs</span>
          </Link>

          <Link
            to="/api-client/api-keys"
            className={`flex items-center px-4 py-2 text-gray-700 rounded-lg ${
              isActive('/api-client/api-keys') ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <span className="mx-4">API Keys</span>
          </Link>

          <Link
            to="/api-client/api-report"
            className={`flex items-center px-4 py-2 text-gray-700 rounded-lg ${
              isActive('/api-client/api-report') ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
            }`}
          >
            <span className="mx-4">API Report</span>
          </Link>
        </div>
      </nav>

      <div className="absolute bottom-0 w-full p-4">
        <button
          onClick={handleLogout}
          disabled={loading}
          className="w-full flex items-center justify-center px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
};

export default ApiClientSidebar; 