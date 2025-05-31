import React, { useEffect } from 'react';
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dispatch(getAdminStats()).unwrap();
        console.log(data)
      } catch (error) {
        console.error('Failed to fetch admin stats:', error);
      }
    };
    fetchStats();
  }, [dispatch]);

  // Prepare chart data for users
  const userChartData = {
    labels: stats?.userStats?.map(stat => stat.date) || [],
    datasets: [
      {
        label: 'New Users',
        data: stats?.userStats?.map(stat => stat.count) || [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
        fill: false,
      },
    ],
  };

  // Prepare chart data for API clients
  const clientChartData = {
    labels: stats?.clientStats?.map(stat => stat.date) || [],
    datasets: [
      {
        label: 'New API Clients',
        data: stats?.clientStats?.map(stat => stat.count) || [],
        borderColor: 'rgb(153, 102, 255)',
        tension: 0.1,
        fill: false,
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
        display: true,
        text: 'Growth Over Time',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
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
              {stats?.newUsersToday?.toLocaleString() || 0} new today
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">API Clients</h3>
            <p className="text-3xl font-bold text-indigo-600 mt-2">
              {stats?.totalApiClients?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {stats?.newClientsToday?.toLocaleString() || 0} new today
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

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">User Growth</h3>
            <div className="h-80">
              <Line data={userChartData} options={chartOptions} />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">API Client Growth</h3>
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