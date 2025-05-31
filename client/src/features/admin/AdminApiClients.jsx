import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { getAllApiClients, deleteApiClient } from './adminSlice';

const AdminApiClients = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { apiClients, loading, error } = useSelector((state) => state.admin);

  const columns = [
    { 
      key: 'representative.email', 
      label: 'Email',
      render: (item) => item.representative?.email || 'N/A'
    },
    { 
      key: 'organization.name', 
      label: 'Company Name',
      render: (item) => item.organization?.name || 'N/A'
    },
    { 
      key: 'contactPerson.name', 
      label: 'Contact Person',
      render: (item) => item.contactPerson?.name || 'N/A'
    },
    { 
      key: 'representative.phoneNumber', 
      label: 'Phone Number',
      render: (item) => item.representative?.phoneNumber || 'N/A'
    },
    { 
      key: 'status', 
      label: 'Status',
      render: (item) => item.status || 'N/A'
    },
    { 
      key: 'createdAt', 
      label: 'Created At', 
      render: (item) => item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'
    }
  ];

  useEffect(() => {
    dispatch(getAllApiClients());
  }, [dispatch]);

  const handleDelete = async (clientId) => {
    if (window.confirm('Are you sure you want to delete this API client?')) {
      try {
        await dispatch(deleteApiClient(clientId)).unwrap();
        // Refresh the list after deletion
        dispatch(getAllApiClients());
      } catch (err) {
        console.error('Failed to delete API client:', err);
      }
    }
  };

  const handleEdit = (clientId) => {
    navigate(`/admin/clients/${clientId}`);
  };

  const handleCreate = () => {
    navigate('/admin/clients/create');
  };

  const renderCell = (client, column) => {
    try {
      if (column.render) {
        return column.render(client);
      }
      // Handle nested properties
      const value = column.key.split('.').reduce((obj, key) => obj?.[key], client);
      if (value === null || value === undefined) {
        return 'N/A';
      }
      if (typeof value === 'object') {
        console.error('Object found in cell:', { column: column.key, value });
        return 'N/A';
      }
      return String(value);
    } catch (err) {
      console.error('Error rendering cell:', { column: column.key, error: err });
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">API Clients Management</h1>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Create New API Client
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apiClients && apiClients.map((client) => (
                  <tr key={client._id}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {renderCell(client, column)}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(client._id)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(client._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminApiClients; 