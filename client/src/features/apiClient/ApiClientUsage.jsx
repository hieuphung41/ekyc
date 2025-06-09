import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Box,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useApiClient } from './hooks/useApiClient';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ApiClientUsage = () => {
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const { getApiUsage } = useApiClient();

  useEffect(() => {
    fetchUsageData();
  }, [timeRange]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      const data = await getApiUsage({ timeRange });
      setUsageData(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" component="h1">
                API Usage
              </Typography>
              <FormControl sx={{ minWidth: 120 }}>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  label="Time Range"
                  onChange={handleTimeRangeChange}
                >
                  <MenuItem value="24h">Last 24 Hours</MenuItem>
                  <MenuItem value="7d">Last 7 Days</MenuItem>
                  <MenuItem value="30d">Last 30 Days</MenuItem>
                  <MenuItem value="90d">Last 90 Days</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {usageData && (
              <>
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="textSecondary">
                        Total Requests
                      </Typography>
                      <Typography variant="h4">
                        {usageData.summary.totalRequests}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="textSecondary">
                        Success Rate
                      </Typography>
                      <Typography variant="h4">
                        {usageData.summary.successRate.toFixed(1)}%
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="textSecondary">
                        Avg Response Time
                      </Typography>
                      <Typography variant="h4">
                        {usageData.summary.avgResponseTime.toFixed(0)}ms
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                <Box sx={{ mb: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Request Volume
                  </Typography>
                  <Line
                    data={{
                      labels: usageData.timeSeriesData.map(d => d.date),
                      datasets: [
                        {
                          label: 'Requests',
                          data: usageData.timeSeriesData.map(d => d.total),
                          borderColor: 'rgb(75, 192, 192)',
                          tension: 0.1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                        },
                      },
                    }}
                  />
                </Box>

                <Typography variant="h6" sx={{ mb: 2 }}>
                  Endpoint Usage
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Endpoint</TableCell>
                        <TableCell align="right">Total Requests</TableCell>
                        <TableCell align="right">Success Rate</TableCell>
                        <TableCell align="right">Avg Response Time</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usageData.endpointStats.map((endpoint) => (
                        <TableRow key={endpoint.endpoint}>
                          <TableCell>{endpoint.endpoint}</TableCell>
                          <TableCell align="right">{endpoint.total}</TableCell>
                          <TableCell align="right">
                            {endpoint.successRate.toFixed(1)}%
                          </TableCell>
                          <TableCell align="right">
                            {endpoint.avgResponseTime.toFixed(0)}ms
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ApiClientUsage; 