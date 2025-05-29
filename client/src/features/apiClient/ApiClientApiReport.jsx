import React from 'react';
import ApiClientLayout from './ApiClientLayout';

const ApiClientApiReport = () => {
  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">API Usage Report</h1>

        {/* Report Filters/Options */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Filter Report</h3>
          {/* Placeholder for date range picker, API selector, etc. */}
          <div className="flex space-x-4">
            {/* Date Range Picker Placeholder */}
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date-range">Date Range</label>
              <input type="text" id="date-range" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" placeholder="Select Date Range" />
            </div>
            {/* API Selector Placeholder */}
            <div className="flex-1">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="api-select">Select API</label>
              <select id="api-select" className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                <option value="">All APIs</option>
                {/* Populate with actual API options */}
                <option value="id-recognition">ID Recognition</option>
                <option value="face-match">FaceMatch</option>
              </select>
            </div>
          </div>
          <button className="mt-4 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
            Generate Report
          </button>
        </div>

        {/* Report Data Section */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">Usage Data</h3>
          
          {/* Usage Data Table/Graph */}
          <div className="overflow-x-auto">
            <table className="min-w-full leading-normal">
              <thead>
                <tr>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">API</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Requests</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Errors</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Latency (ms)</th>
                  <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody>
                {/* Placeholder rows - replace with dynamic data */}
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">2023-11-01</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">ID Recognition</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">150</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">5</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">80</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">$1.50</td>
                </tr>
                <tr>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">2023-11-01</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">FaceMatch</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">120</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">2</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">120</td>
                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">$1.20</td>
                </tr>
                {/* Add more rows based on report data */}
              </tbody>
            </table>
          </div>
          {/* Pagination/Footer can be added here */}
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientApiReport; 