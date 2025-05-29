import React from 'react';
import ApiClientLayout from './ApiClientLayout';

const ApiClientDashboard = () => {
  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard</h1>

        {/* Graphs Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Traffic Graph */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Traffic</h3>
            {/* Placeholder for Traffic Graph */}
            <div className="h-40 bg-gray-200 flex items-center justify-center rounded">Graph Placeholder</div>
          </div>

          {/* Errors Graph */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Errors</h3>
            {/* Placeholder for Errors Graph */}
            <div className="h-40 bg-gray-200 flex items-center justify-center rounded">Graph Placeholder</div>
          </div>

          {/* Median Latency Graph */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-4 text-gray-700">Median Latency (ms)</h3>
            {/* Placeholder for Median Latency Graph */}
            <div className="h-40 bg-gray-200 flex items-center justify-center rounded">Graph Placeholder</div>
          </div>
        </div>

        {/* APIs Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">APIs</h3>
          
          {/* APIs Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">API</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Requests</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Requests error</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Free remain</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid remain</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {/* Placeholder rows - replace with dynamic data */}
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">ID Recognition</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">47</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">request</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm"><button className="text-indigo-600 hover:text-indigo-900">buy more</button></td>
                </tr>
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">FaceMatch</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">44</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">0</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">request</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm"><button className="text-indigo-600 hover:text-indigo-900">buy more</button></td>
                </tr>
                {/* Add more rows as needed based on data */}
              </tbody>
            </table>
          </div>
          {/* Pagination/Footer can be added here */}
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientDashboard; 