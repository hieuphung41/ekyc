import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AdminSidebar from './AdminSidebar';
import { getUserById, updateUser } from './adminSlice';

const AdminUserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedUser: user, loading, error } = useSelector((state) => state.admin);

  const fields = [
    {
      name: 'email',
      label: 'Email',
      type: 'email',
      disabled: true // Email cannot be changed
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
    },
    {
      name: 'isVerified',
      label: 'Verification Status',
      type: 'select',
      options: [
        { value: true, label: 'Verified' },
        { value: false, label: 'Not Verified' }
      ],
      required: true
    }
  ];

  useEffect(() => {
    dispatch(getUserById(id));
  }, [dispatch, id]);

  const handleSave = async (formData) => {
    try {
      await dispatch(updateUser({ userId: id, userData: formData })).unwrap();
      navigate('/admin/users');
    } catch (err) {
      console.error('Failed to update user:', err);
    }
  };

  const handleCancel = () => {
    navigate('/admin/users');
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
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

  if (error) {
    return (
      <div className="flex h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Edit User</h2>
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
                      defaultValue={user?.[field.name]}
                      disabled={field.disabled}
                      required={field.required}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
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
                      defaultValue={user?.[field.name]}
                      disabled={field.disabled}
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUserEdit; 