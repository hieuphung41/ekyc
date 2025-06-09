import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ApiClientLayout from './ApiClientLayout';
import { getClientUsage } from './apiClientSlice';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ApiClientUsage = () => {
  const dispatch = useDispatch();
  const { usageData, loading, error } = useSelector((state) => state.apiClient);

  useEffect(() => {
    dispatch(getClientUsage());
  }, [dispatch]);

  if (loading) {
    return (
      <ApiClientLayout>
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </ApiClientLayout>
    );
  }

  if (error) {
    return (
      <ApiClientLayout>
        <div className="p-8">
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        </div>
      </ApiClientLayout>
    );
  }

  // Prepare chart data
  const dates = usageData?.daily ? usageData.daily.map(item => new Date(item.date).toLocaleDateString()) : [];
  const requestData = usageData?.daily ? usageData.daily.map(item => item.totalRequests) : [];
  const successRateData = usageData?.daily ? usageData.daily.map(item => item.successRate) : [];
  const responseTimeData = usageData?.daily ? usageData.daily.map(item => item.averageResponseTime) : [];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'API Usage Over Time'
      }
    },
    scales: {
      x: {
        ticks: { maxRotation: 60, minRotation: 60 },
      },
      y: {
        beginAtZero: true,
      },
    },
    fill: true
  };

  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">API Usage</h1>

        {/* Usage Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Total Requests</h2>
            <p className="text-3xl font-bold text-blue-600">
              {usageData?.summary?.totalRequests || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Storage Used</h2>
            <p className="text-3xl font-bold text-blue-600">
              {usageData?.summary?.storageUsed || 0} GB
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Active Users</h2>
            <p className="text-3xl font-bold text-blue-600">
              {usageData?.summary?.activeUsers || 0}
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Request Volume Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Request Volume</h2>
            <div className="h-64">
              <Line
                data={{
                  labels: dates,
                  datasets: [
                    {
                      label: 'Requests',
                      data: requestData,
                      borderColor: 'rgb(59, 130, 246)',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      fill: true,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>

          {/* Success Rate Chart */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Success Rate</h2>
            <div className="h-64">
              <Line
                data={{
                  labels: dates,
                  datasets: [
                    {
                      label: 'Success Rate (%)',
                      data: successRateData,
                      borderColor: 'rgb(34, 197, 94)',
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      fill: true,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>

        {/* Response Time Chart */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Average Response Time</h2>
          <div className="h-64">
            <Line
              data={{
                labels: dates,
                datasets: [
                  {
                    label: 'Response Time (ms)',
                    data: responseTimeData,
                    borderColor: 'rgb(245, 158, 11)',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    fill: true,
                  },
                ],
              }}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Endpoint Usage */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Endpoint Usage</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Requests
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Response Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageData?.endpoints?.map((endpoint, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endpoint.endpoint}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endpoint.totalRequests}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endpoint.successRate.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {endpoint.averageResponseTime.toFixed(2)}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientUsage; 