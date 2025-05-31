import React from 'react';
import AdminSidebar from './AdminSidebar';

const AdminLayout = ({ children }) => {
  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout; 