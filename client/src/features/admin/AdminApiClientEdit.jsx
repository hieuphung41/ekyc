import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { getApiClientById, updateApiClient } from './adminSlice';

const AdminApiClientEdit = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { selectedApiClient: client, loading, error } = useSelector((state) => state.admin);

  const [formData, setFormData] = useState({
    organization: {
      name: '',
      address: '',
      registrationNumber: '',
      website: ''
    },
    contactPerson: {
      name: '',
      email: '',
      phone: ''
    },
    representative: {
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: ''
    },
    permissions: [],
    status: 'active',
    ekycConfig: {
      allowedVerificationMethods: {
        face: false,
        voice: false,
        document: false
      },
      maxVerificationAttempts: 3,
      verificationTimeout: 300,
      allowedDocumentTypes: []
    },
    ipWhitelist: [],
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000
    },
    webhookUrl: ''
  });

  useEffect(() => {
    dispatch(getApiClientById(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (client) {
      setFormData({
        organization: {
          name: client.organization?.name || '',
          address: client.organization?.address || '',
          registrationNumber: client.organization?.registrationNumber || '',
          website: client.organization?.website || ''
        },
        contactPerson: {
          name: client.contactPerson?.name || '',
          email: client.contactPerson?.email || '',
          phone: client.contactPerson?.phone || ''
        },
        representative: {
          email: client.representative?.email || '',
          firstName: client.representative?.firstName || '',
          lastName: client.representative?.lastName || '',
          phoneNumber: client.representative?.phoneNumber || ''
        },
        permissions: client.permissions || [],
        status: client.status || 'active',
        ekycConfig: {
          allowedVerificationMethods: {
            face: client.ekycConfig?.allowedVerificationMethods?.face || false,
            voice: client.ekycConfig?.allowedVerificationMethods?.voice || false,
            document: client.ekycConfig?.allowedVerificationMethods?.document || false
          },
          maxVerificationAttempts: client.ekycConfig?.maxVerificationAttempts || 3,
          verificationTimeout: client.ekycConfig?.verificationTimeout || 300,
          allowedDocumentTypes: client.ekycConfig?.allowedDocumentTypes || []
        },
        ipWhitelist: client.ipWhitelist || [],
        rateLimits: {
          requestsPerMinute: client.rateLimits?.requestsPerMinute || 60,
          requestsPerHour: client.rateLimits?.requestsPerHour || 1000,
          requestsPerDay: client.rateLimits?.requestsPerDay || 10000
        },
        webhookUrl: client.webhookUrl || ''
      });
    }
  }, [client]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateApiClient({ clientId: id, clientData: formData })).unwrap();
      navigate('/admin/clients');
    } catch (err) {
      console.error('Failed to update API client:', err);
    }
  };

  if (loading && !client) {
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Edit API Client</h1>
          
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Organization Information */}
              <div className="col-span-2">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                    <input
                      type="text"
                      name="organization.name"
                      value={formData.organization.name}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Registration Number</label>
                    <input
                      type="text"
                      name="organization.registrationNumber"
                      value={formData.organization.registrationNumber}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      type="text"
                      name="organization.address"
                      value={formData.organization.address}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      name="organization.website"
                      value={formData.organization.website}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Person Information */}
              <div className="col-span-2">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Person Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      name="contactPerson.name"
                      value={formData.contactPerson.name}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="contactPerson.email"
                      value={formData.contactPerson.email}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      name="contactPerson.phone"
                      value={formData.contactPerson.phone}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Representative Information */}
              <div className="col-span-2">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Representative Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      name="representative.firstName"
                      value={formData.representative.firstName}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      name="representative.lastName"
                      value={formData.representative.lastName}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="representative.email"
                      value={formData.representative.email}
                      onChange={handleChange}
                      required
                      disabled
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input
                      type="tel"
                      name="representative.phoneNumber"
                      value={formData.representative.phoneNumber}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Webhook URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
                <input
                  type="url"
                  name="webhookUrl"
                  value={formData.webhookUrl}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/admin/clients')}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminApiClientEdit; 