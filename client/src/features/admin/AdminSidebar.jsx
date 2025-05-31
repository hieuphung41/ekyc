import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logoutAdmin } from "./adminSlice";

const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.admin || { loading: false });

  const navigation = [
    { name: "Dashboard", href: "/admin/dashboard", icon: "HomeIcon" },
    { name: "Users", href: "/admin/users", icon: "UsersIcon" },
    { name: "API Clients", href: "/admin/clients", icon: "ApiIcon" },
  ];

  const handleLogout = async () => {
    try {
      await dispatch(logoutAdmin()).unwrap();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="flex flex-col w-64 bg-gray-800 min-h-screen">
      <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <h1 className="text-white text-xl font-bold">Admin Panel</h1>
        </div>
        <nav className="mt-5 flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
              >
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            disabled={loading}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>{loading ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSidebar;
