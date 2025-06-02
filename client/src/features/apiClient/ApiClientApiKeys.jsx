import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ApiClientLayout from './ApiClientLayout';
import { getApiKeys, generateApiKey, revokeApiKey, regenerateApiKey } from './apiClientSlice';
import { toast } from 'react-toastify';

const ApiClientApiKeys = () => {
  const dispatch = useDispatch();
  const { apiKeys, apiKeysLoading, apiKeysError } = useSelector((state) => state.apiClient);
  const [showKey, setShowKey] = useState(null);

  useEffect(() => {
    dispatch(getApiKeys());
  }, [dispatch]);

  const handleGenerateKey = async () => {
    try {
      await dispatch(generateApiKey()).unwrap();
    } catch (error) {
      console.error('Failed to generate API key:', error);
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!keyId) {
      toast.error('Invalid API key ID');
      return;
    }

    if (window.confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      try {
        await dispatch(revokeApiKey(keyId)).unwrap();
      } catch (error) {
        console.error('Failed to revoke API key:', error);
      }
    }
  };

  const handleRegenerateKey = async (keyId) => {
    if (!keyId) {
      toast.error('Invalid API key ID');
      return;
    }

    if (window.confirm('Are you sure you want to regenerate this API key? The old key will be invalidated.')) {
      try {
        await dispatch(regenerateApiKey(keyId)).unwrap();
      } catch (error) {
        console.error('Failed to regenerate API key:', error);
      }
    }
  };

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ApiClientLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">API Keys</h1>
          <button
            onClick={handleGenerateKey}
            disabled={apiKeysLoading}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:opacity-50"
          >
            {apiKeysLoading ? 'Generating...' : 'Generate New API Key'}
          </button>
        </div>

        {apiKeysError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {apiKeysError}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Your API Keys</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">API Key</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created At</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Used</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key._id}>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <div className="flex items-center space-x-2">
                        <code className="font-mono">
                          {showKey === key._id ? key.key : '••••••••••••••••••••••••'}
                        </code>
                        <button
                          onClick={() => setShowKey(showKey === key._id ? null : key._id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {showKey === key._id ? 'Hide' : 'Show'}
                        </button>
                        {showKey === key._id && (
                          <button
                            onClick={() => handleCopyKey(key.key)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      {key.lastUsed ? formatDate(key.lastUsed) : 'Never'}
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        key.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {key.status}
                      </span>
                    </td>
                    <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                      <button
                        onClick={() => handleRevokeKey(key._id)}
                        disabled={key.status === 'revoked' || apiKeysLoading}
                        className="text-red-600 hover:text-red-900 mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Revoke
                      </button>
                      <button
                        onClick={() => handleRegenerateKey(key._id)}
                        disabled={key.status === 'revoked' || apiKeysLoading}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Regenerate
                      </button>
                    </td>
                  </tr>
                ))}
                {apiKeys.length === 0 && !apiKeysLoading && (
                  <tr>
                    <td colSpan="5" className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-center text-gray-500">
                      No API keys found. Generate your first API key to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientApiKeys; 