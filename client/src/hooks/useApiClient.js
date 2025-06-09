import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useApiClient = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getApiReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/clients/api-report`, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching API report');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getClientInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/clients/profile`, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching client info');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClientInfo = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.put(`${API_URL}/clients/profile`, data, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating client info');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClientSettings = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.put(`${API_URL}/clients/settings`, data, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating client settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getClientUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/clients/usage`, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error fetching client usage');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateBillingSettings = async (data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.put(`${API_URL}/clients/billing`, data, {
        withCredentials: true
      });
      return response.data.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating billing settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getApiReport,
    getClientInfo,
    updateClientInfo,
    updateClientSettings,
    getClientUsage,
    updateBillingSettings
  };
}; 