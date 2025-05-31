import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import AdminSidebar from './AdminSidebar';
import { createUser, getAllUsers } from './adminSlice';

const AdminUserCreate = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const fields = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true
    },
    {
      name: 'password',
      label: 'Password',
      type: 'password',
      required: true
    },
    {
      name: 'firstName',
      label: 'First Name',
      type: 'text',
      required: true
    },
    {
      name: 'lastName',
      label: 'Last Name',
      type: 'text',
      required: true
    },
    {
      name: 'phoneNumber',
      label: 'Phone Number',
      type: 'tel'
    },
    {
      name: 'role',
      label: 'Role',
      type: 'select',
      options: [
        { value: 'user', label: 'User' },
        { value: 'admin', label: 'Admin' },
        { value: 'api-client', label: 'API Client' }
      ],
      required: true
    }
  ];

  const handleSave = async (formData) => {
    try {
      await dispatch(createUser(formData)).unwrap();
      await dispatch(getAllUsers());
      navigate('/admin/users');
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  const handleCancel = () => {
    navigate('/admin/users');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create New User</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const data = Object.fromEntries(formData.entries());
              handleSave(data);
            }}>
              {fields.map((field) => (
                <div key={field.name} className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      name={field.name}
                      required={field.required}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      name={field.name}
                      required={field.required}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end space-x-4 mt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserCreate; 