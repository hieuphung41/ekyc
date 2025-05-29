import React from 'react';
import ApiClientLayout from './ApiClientLayout';

const ApiClientApis = () => {
  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Available APIs</h1>

        {/* API List Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">List of APIs</h3>
          
          {/* APIs Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">API Name</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Endpoint</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pricing</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {/* Placeholder rows - replace with dynamic data */}
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">eKYC ID Recognition</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Recognize details from ID documents.</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">`/api/ekyc/recognize`</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Free/Paid tiers</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-green-600">Active</td>
                </tr>
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">eKYC Face Match</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Compare faces for verification.</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">`/api/ekyc/face-match`</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">Free/Paid tiers</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-green-600">Active</td>
                </tr>
                {/* Add more rows based on available APIs */}
              </tbody>
            </table>
          </div>
          {/* Pagination/Footer can be added here */}
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientApis; 