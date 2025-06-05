import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ApiClientLayout from './ApiClientLayout';
import { getApiReport } from './apiClientSlice';
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

const apiList = [
  {
    name: 'Passport Recognition',
    endpoint: '/api/ekyc/passport',
    freeRemain: 50,
    paidRemain: 0,
    unit: 'request',
  },
  {
    name: "Driver's license recognition",
    endpoint: '/api/ekyc/drivers-license',
    freeRemain: 50,
    paidRemain: 0,
    unit: 'request',
  },
  {
    name: 'ID Recognition',
    endpoint: '/api/ekyc/recognize',
    freeRemain: 45,
    paidRemain: 0,
    unit: 'request',
  },
  {
    name: 'FaceMatch',
    endpoint: '/api/ekyc/face-match',
    freeRemain: 43,
    paidRemain: 0,
    unit: 'request',
  },
];

const ApiClientDashboard = () => {
  const dispatch = useDispatch();
  const { apiReport, apiReportLoading } = useSelector((state) => state.apiClient);

  useEffect(() => {
    dispatch(getApiReport());
  }, [dispatch]);

  // Prepare chart data
  const dates = apiReport?.timeSeriesData ? Object.keys(apiReport.timeSeriesData).sort() : [];
  const trafficData = dates.map(date => (apiReport.timeSeriesData[date]?.total || 0));
  const errorData = dates.map(date => (apiReport.timeSeriesData[date]?.failed || 0));
  const medianLatencyData = dates.map(date => {
    // Calculate median latency for each date from endpointStats if available
    let latencies = [];
    if (apiReport?.endpointStats) {
      Object.values(apiReport.endpointStats).forEach(stat => {
        // Simulate median as avgResponseTime for demo
        latencies.push(stat.avgResponseTime || 0);
      });
    }
    return latencies.length > 0 ? (latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  });

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
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Traffic Chart */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Traffic</h2>
            <div className="h-64 bg-white rounded-lg shadow p-4">
              <Line
                data={{
                  labels: dates,
                  datasets: [
                    {
                      label: 'Traffic',
                      data: trafficData,
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
          {/* Errors Chart */}
          <div>
            <h2 className="text-lg font-semibold mb-2">Errors</h2>
            <div className="h-64 bg-white rounded-lg shadow p-4">
              <Line
                data={{
                  labels: dates,
                  datasets: [
                    {
                      label: 'Errors',
                      data: errorData,
                      borderColor: 'rgb(239, 68, 68)',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      fill: true,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
          {/* Median Latency Chart */}
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold mb-2">Median Latency (ms)</h2>
              {/* You can add interval/date range pickers here */}
            </div>
            <div className="h-64 bg-white rounded-lg shadow p-4">
              <Line
                data={{
                  labels: dates,
                  datasets: [
                    {
                      label: 'Median latency',
                      data: medianLatencyData,
                      borderColor: 'rgb(139, 92, 246)',
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      fill: true,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
        {/* APIs Table */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold mb-4 text-gray-700">APIs</h3>
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
                {apiList.map((api) => {
                  // Try to get stats from apiReport.endpointStats
                  const stats = apiReport?.endpointStats?.[api.endpoint] || { total: 0, failed: 0 };
                  return (
                    <tr key={api.endpoint}>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm text-blue-700 font-semibold cursor-pointer hover:underline">
                        {api.name}
                      </td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{stats.total}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{stats.failed}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{api.freeRemain}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{api.paidRemain}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">{api.unit}</td>
                      <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                        <a href="#" className="text-blue-600 hover:underline">buy more</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientDashboard; 