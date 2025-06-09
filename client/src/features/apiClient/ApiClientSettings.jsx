import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider,
  Box
} from '@mui/material';
import { useApiClient } from './hooks/useApiClient';

const ApiClientSettings = () => {
  const { getClientInfo, updateClientInfo, updateClientSettings, loading, error } = useApiClient();
  const [formData, setFormData] = useState({
    name: '',
    organization: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notifications: {
      email: true,
      sms: false,
      webhook: false,
    },
    security: {
      twoFactorAuth: false,
      ipWhitelist: '',
    },
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchClientInfo = async () => {
      try {
        const data = await getClientInfo();
        if (data) {
          setFormData({
            ...data,
            notifications: data.notifications || {
              email: true,
              sms: false,
              webhook: false,
            },
            security: data.security || {
              twoFactorAuth: false,
              ipWhitelist: '',
            },
          });
        }
      } catch (err) {
        console.error('Error fetching client info:', err);
      }
    };

    fetchClientInfo();
  }, [getClientInfo]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNotificationChange = (name) => (e) => {
    setFormData((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [name]: e.target.checked,
      },
    }));
  };

  const handleSecurityChange = (name) => (e) => {
    setFormData((prev) => ({
      ...prev,
      security: {
        ...prev.security,
        [name]: e.target.checked,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateClientInfo(formData);
      await updateClientSettings({
        notifications: formData.notifications,
        security: formData.security,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
    }
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
            <Typography variant="h4" gutterBottom>
              API Client Settings
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>Settings updated successfully!</Alert>}
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                {/* Basic Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Basic Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Client Name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Organization"
                        name="organization"
                        value={formData.organization}
                        onChange={handleInputChange}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {/* Contact Information */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Contact Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Contact Person"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {/* Notifications */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Notifications
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.notifications.email}
                            onChange={handleNotificationChange('email')}
                          />
                        }
                        label="Email Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.notifications.sms}
                            onChange={handleNotificationChange('sms')}
                          />
                        }
                        label="SMS Notifications"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.notifications.webhook}
                            onChange={handleNotificationChange('webhook')}
                          />
                        }
                        label="Webhook Notifications"
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {/* Security */}
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Security Settings
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.security.twoFactorAuth}
                            onChange={handleSecurityChange('twoFactorAuth')}
                          />
                        }
                        label="Two-Factor Authentication"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="IP Whitelist"
                        name="ipWhitelist"
                        value={formData.security.ipWhitelist}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            security: {
                              ...prev.security,
                              ipWhitelist: e.target.value,
                            },
                          }))
                        }
                        helperText="Comma-separated list of allowed IP addresses"
                      />
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Box display="flex" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      disabled={loading}
                    >
                      Save Changes
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ApiClientSettings; 