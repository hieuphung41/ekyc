import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useApiClient } from '../hooks/useApiClient';

const ApiClientDashboard = () => {
  const navigate = useNavigate();
  const { getApiReport, getClientInfo } = useApiClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [reportData, infoData] = await Promise.all([
          getApiReport(),
          getClientInfo()
        ]);
        setUsageData(reportData);
        setClientInfo(infoData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Client Information */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Client Information
            </Typography>
            <Typography variant="body1">
              <strong>Name:</strong> {clientInfo?.name}
            </Typography>
            <Typography variant="body1">
              <strong>Organization:</strong> {clientInfo?.organization?.name}
            </Typography>
            <Typography variant="body1">
              <strong>Subscription:</strong> {clientInfo?.subscription?.tier}
            </Typography>
            <Typography variant="body1">
              <strong>Status:</strong> {clientInfo?.status}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Usage Summary
            </Typography>
            <Typography variant="body1">
              <strong>Total Requests:</strong> {usageData?.usage?.summary?.totalRequests}
            </Typography>
            <Typography variant="body1">
              <strong>Storage Used:</strong> {usageData?.usage?.summary?.storageUsed} GB
            </Typography>
            <Typography variant="body1">
              <strong>Active Users:</strong> {usageData?.usage?.summary?.activeUsers}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Usage Charts */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Daily API Usage
            </Typography>
            <Box sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageData?.usage?.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="totalRequests" stroke="#8884d8" name="Total Requests" />
                  <Line type="monotone" dataKey="successRate" stroke="#82ca9d" name="Success Rate (%)" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Endpoint Usage */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Endpoints
            </Typography>
            <Grid container spacing={2}>
              {usageData?.usage?.endpoints?.map((endpoint, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        {endpoint.endpoint}
                      </Typography>
                      <Typography variant="body2">
                        Requests: {endpoint.totalRequests}
                      </Typography>
                      <Typography variant="body2">
                        Success Rate: {endpoint.successRate.toFixed(1)}%
                      </Typography>
                      <Typography variant="body2">
                        Avg Response Time: {endpoint.averageResponseTime.toFixed(2)}ms
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ApiClientDashboard; 