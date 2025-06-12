import { useState } from 'react';
import axios from 'axios';

const API_URL = `${import.meta.env.VITE_API_URL}/api` || 'http://localhost:5000/api';

export const useApiClient = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Webhook Management
  const getWebhooks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api-client/webhooks`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch webhooks');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async (webhookData) => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api-client/webhooks`, webhookData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create webhook');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateWebhook = async (webhookId, webhookData) => {
    try {
      setLoading(true);
      const response = await axios.put(`${API_URL}/api-client/webhooks/${webhookId}`, webhookData);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update webhook');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (webhookId) => {
    try {
      setLoading(true);
      const response = await axios.delete(`${API_URL}/api-client/webhooks/${webhookId}`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete webhook');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // API Usage
  const getApiUsage = async (params = {}) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api-client/usage`, { params });
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch API usage');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getApiReport = async (params = {}) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api-client/report`, { params });
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch API report');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Existing functions
  const getClientInfo = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api-client/profile`);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch client info');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClientInfo = async (data) => {
    try {
      setLoading(true);
      const response = await axios.put(`${API_URL}/api-client/profile`, data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update client info');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateClientSettings = async (data) => {
    try {
      setLoading(true);
      const response = await axios.put(`${API_URL}/api-client/settings`, data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update client settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateBillingSettings = async (data) => {
    try {
      setLoading(true);
      const response = await axios.put(`${API_URL}/api-client/billing`, data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update billing settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    getApiUsage,
    getApiReport,
    getClientInfo,
    updateClientInfo,
    updateClientSettings,
    updateBillingSettings,
  };
}; 