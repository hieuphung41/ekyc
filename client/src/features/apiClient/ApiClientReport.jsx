import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ApiClientLayout from './ApiClientLayout';
import { getApiReport, getEndpointReport } from './apiClientSlice';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ApiClientReport = () => {
  const dispatch = useDispatch();
  const { apiReport, apiReportLoading, apiReportError, endpointReport, endpointReportLoading } = useSelector((state) => state.apiClient);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);

  useEffect(() => {
    dispatch(getApiReport());
  }, [dispatch]);

  useEffect(() => {
    if (selectedEndpoint) {
      dispatch(getEndpointReport(selectedEndpoint));
    }
  }, [dispatch, selectedEndpoint]);

  const handleEndpointClick = (endpoint) => {
    setSelectedEndpoint(endpoint);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const prepareTimeSeriesData = () => {
    if (!apiReport?.timeSeriesData) return null;

    const dates = Object.keys(apiReport.timeSeriesData).sort();
    const successData = dates.map(date => apiReport.timeSeriesData[date].success);
    const failedData = dates.map(date => apiReport.timeSeriesData[date].failed);

    return {
      labels: dates.map(date => formatDate(date)),
      datasets: [
        {
          label: 'Successful Requests',
          data: successData,
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
        },
        {
          label: 'Failed Requests',
          data: failedData,
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
        },
      ],
    };
  };

  return (
    <ApiClientLayout>
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">API Usage Report</h1>

        {apiReportError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {apiReportError}
          </div>
        )}

        {apiReportLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : apiReport && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Requests</h3>
                <p className="text-3xl font-bold text-indigo-600">{apiReport.summary.totalRequests}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Successful Requests</h3>
                <p className="text-3xl font-bold text-green-600">{apiReport.summary.successfulRequests}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Failed Requests</h3>
                <p className="text-3xl font-bold text-red-600">{apiReport.summary.failedRequests}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Success Rate</h3>
                <p className="text-3xl font-bold text-blue-600">{apiReport.summary.successRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Time Series Chart */}
            <div className="bg-white p-6 rounded-lg shadow mb-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Request History</h3>
              <div className="h-80">
                <Line
                  data={prepareTimeSeriesData()}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      y: {
                        beginAtZero: true,
                        title: {
                          display: true,
                          text: 'Number of Requests'
                        }
                      },
                      x: {
                        title: {
                          display: true,
                          text: 'Date'
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* Endpoint Statistics */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">Endpoint Statistics</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full leading-normal">
                  <thead>
                    <tr>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Endpoint</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Requests</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Success Rate</th>
                      <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Response Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(apiReport.endpointStats).map(([endpoint, stats]) => (
                      <tr 
                        key={endpoint}
                        onClick={() => handleEndpointClick(endpoint)}
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          {endpoint}
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          {stats.total}
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          {((stats.success / stats.total) * 100).toFixed(1)}%
                        </td>
                        <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                          {stats.avgResponseTime.toFixed(2)}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Endpoint Detail Modal */}
            {selectedEndpoint && endpointReport && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-700">
                      Endpoint Details: {selectedEndpoint}
                    </h3>
                    <button
                      onClick={() => setSelectedEndpoint(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {endpointReportLoading ? (
                    <div className="flex justify-center items-center h-32">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-gray-50 p-4 rounded">
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Total Requests</h4>
                          <p className="text-2xl font-bold text-indigo-600">{endpointReport.summary.totalRequests}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Success Rate</h4>
                          <p className="text-2xl font-bold text-green-600">{endpointReport.summary.successRate.toFixed(1)}%</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded">
                          <h4 className="text-sm font-semibold text-gray-600 mb-1">Avg Response Time</h4>
                          <p className="text-2xl font-bold text-blue-600">{endpointReport.summary.avgResponseTime.toFixed(2)}ms</p>
                        </div>
                      </div>

                      {Object.keys(endpointReport.errorStats).length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold text-gray-700 mb-2">Error Distribution</h4>
                          <div className="bg-gray-50 p-4 rounded">
                            {Object.entries(endpointReport.errorStats).map(([errorType, count]) => (
                              <div key={errorType} className="flex justify-between items-center py-2 border-b last:border-b-0">
                                <span className="text-gray-600">{errorType}</span>
                                <span className="text-red-600 font-semibold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-lg font-semibold text-gray-700 mb-2">Recent Requests</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full leading-normal">
                            <thead>
                              <tr>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Response Time</th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Error Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpointReport.usage.slice(0, 10).map((usage, index) => (
                                <tr key={index}>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {formatDate(usage.timestamp)}
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    <span className={`px-2 py-1 rounded-full text-xs ${
                                      usage.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                      {usage.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {usage.responseTime?.toFixed(2)}ms
                                  </td>
                                  <td className="px-5 py-5 border-b border-gray-200 bg-white text-sm">
                                    {usage.errorType || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ApiClientLayout>
  );
};

export default ApiClientReport; 