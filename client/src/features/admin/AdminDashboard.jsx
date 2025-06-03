import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAdminStats } from './adminSlice';
import AdminSidebar from './AdminSidebar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
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

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((state) => state.admin);
  const [userPeriod, setUserPeriod] = useState('month'); // Default to month
  const [clientPeriod, setClientPeriod] = useState('month'); // Default to month

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // The updated getAdminStats now fetches time-based data
        await dispatch(getAdminStats()).unwrap();
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      }
    };
    fetchStats();
  }, [dispatch]);

  // Prepare chart data for users based on selected period
  const userChartData = {
    labels: stats?.userStats?.[userPeriod]?.map(stat => stat._id) || [],
    datasets: [
      {
        label: `New Users (${userPeriod.charAt(0).toUpperCase() + userPeriod.slice(1)})`,
        data: stats?.userStats?.[userPeriod]?.map(stat => stat.count) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false,
        pointRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgb(75, 192, 192)',
        pointHoverRadius: 7,
      },
    ],
  };

  // Prepare chart data for API clients based on selected period
  const clientChartData = {
    labels: stats?.clientStats?.[clientPeriod]?.map(stat => stat._id) || [],
    datasets: [
      {
        label: `New API Clients (${clientPeriod.charAt(0).toUpperCase() + clientPeriod.slice(1)})`,
        data: stats?.clientStats?.[clientPeriod]?.map(stat => stat.count) || [],
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1,
        fill: false,
        pointRadius: 5,
        pointBackgroundColor: '#fff',
        pointBorderColor: 'rgb(153, 102, 255)',
        pointHoverRadius: 7,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false, // Title is now in the h3 tag above the chart
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        // Configure x-axis for better label display if needed
        ticks: {
            autoSkip: true,
            maxRotation: 45, // Adjust rotation for readability
            minRotation: 45,
        }
      }
    },
  };

  if (loading) {
    return (
      <div className="flex h-screen">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Dashboard</h1>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">Total Users</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {stats?.totalUsers?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {/* You might add new users today stat if backend provides it */}
              Overall count
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">Total API Clients</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {stats?.totalApiClients?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">
               Overall count
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {stats?.activeSessions?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Across all platforms
            </p>
          </div>
        </div>

        {/* Charts with Period Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Growth Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">User Growth</h3>
              <select 
                value={userPeriod} 
                onChange={e => setUserPeriod(e.target.value)}
                className="block w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              >
                <option value="week">By Week</option>
                <option value="month">By Month</option>
                <option value="year">By Year</option>
              </select>
            </div>
            <div className="h-80">
              <Line data={userChartData} options={chartOptions} />
            </div>
          </div>
          
          {/* API Client Growth Chart */}
          <div className="bg-white rounded-lg shadow p-6">
             <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">API Client Growth</h3>
              <select 
                value={clientPeriod} 
                onChange={e => setClientPeriod(e.target.value)}
                 className="block w-auto rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              >
                <option value="week">By Week</option>
                <option value="month">By Month</option>
                <option value="year">By Year</option>
              </select>
            </div>
            <div className="h-80">
              <Line data={clientChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard; 