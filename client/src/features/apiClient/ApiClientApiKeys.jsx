import React from 'react';
import ApiClientLayout from './ApiClientLayout';

const ApiClientApiKeys = () => {
  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">API Keys</h1>

        {/* API Keys Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Your API Keys</h3>
          
          {/* API Keys List/Table */}
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
                {/* Placeholder rows - replace with dynamic data */}
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">`sk-*********************`</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">2023-10-27</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">2023-11-01</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-green-600">Active</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">Revoke</button>
                    <button className="text-blue-600 hover:text-blue-900">Regenerate</button>
                  </td>
                </tr>
                {/* Add more rows for multiple keys if applicable */}
              </tbody>
            </table>
          </div>
          {/* Button to generate new key */}
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
            Generate New API Key
          </button>
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientApiKeys; 