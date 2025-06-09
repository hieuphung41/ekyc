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
import { useApiClient } from '../hooks/useApiClient';

const ApiClientSettings = () => {
  const { getClientInfo, updateClientInfo, updateClientSettings, loading, error } = useApiClient();
  const [clientInfo, setClientInfo] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    organization: {
      name: '',
      address: '',
      registrationNumber: '',
      website: ''
    },
    contactPerson: {
      name: '',
      email: '',
      phone: ''
    },
    settings: {
      notifications: {
        email: {
          enabled: false,
          address: ''
        },
        webhook: {
          enabled: false,
          url: ''
        }
      },
      security: {
        mfaRequired: false,
        sessionTimeout: 3600,
        allowedOrigins: [],
        allowedIPs: []
      },
      apiPreferences: {
        defaultResponseFormat: 'json',
        timezone: 'UTC',
        dateFormat: 'ISO'
      }
    }
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchClientInfo = async () => {
      try {
        const data = await getClientInfo();
        setClientInfo(data);
        setFormData({
          name: data.name || '',
          organization: data.organization || {
            name: '',
            address: '',
            registrationNumber: '',
            website: ''
          },
          contactPerson: data.contactPerson || {
            name: '',
            email: '',
            phone: ''
          },
          settings: data.settings || {
            notifications: {
              email: {
                enabled: false,
                address: ''
              },
              webhook: {
                enabled: false,
                url: ''
              }
            },
            security: {
              mfaRequired: false,
              sessionTimeout: 3600,
              allowedOrigins: [],
              allowedIPs: []
            },
            apiPreferences: {
              defaultResponseFormat: 'json',
              timezone: 'UTC',
              dateFormat: 'ISO'
            }
          }
        });
      } catch (err) {
        console.error('Error fetching client info:', err);
      }
    };

    fetchClientInfo();
  }, []);

  const handleInputChange = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleNestedInputChange = (section, subsection, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [subsection]: {
          ...prev[section][subsection],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateClientInfo(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating client info:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              API Client Settings
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>Settings updated successfully</Alert>}
            
            <form onSubmit={handleSubmit}>
              {/* Basic Information */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Basic Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Client Name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', 'name', e.target.value)}
                    margin="normal"
                  />
                </Grid>
              </Grid>

              {/* Organization Information */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Organization Information
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Organization Name"
                    value={formData.organization.name}
                    onChange={(e) => handleNestedInputChange('organization', 'name', 'name', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Address"
                    value={formData.organization.address}
                    onChange={(e) => handleNestedInputChange('organization', 'address', 'address', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Registration Number"
                    value={formData.organization.registrationNumber}
                    onChange={(e) => handleNestedInputChange('organization', 'registrationNumber', 'registrationNumber', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Website"
                    value={formData.organization.website}
                    onChange={(e) => handleNestedInputChange('organization', 'website', 'website', e.target.value)}
                    margin="normal"
                  />
                </Grid>
              </Grid>

              {/* Contact Person */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Contact Person
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Name"
                    value={formData.contactPerson.name}
                    onChange={(e) => handleNestedInputChange('contactPerson', 'name', 'name', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    value={formData.contactPerson.email}
                    onChange={(e) => handleNestedInputChange('contactPerson', 'email', 'email', e.target.value)}
                    margin="normal"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={formData.contactPerson.phone}
                    onChange={(e) => handleNestedInputChange('contactPerson', 'phone', 'phone', e.target.value)}
                    margin="normal"
                  />
                </Grid>
              </Grid>

              {/* Notifications */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Notifications
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.settings.notifications.email.enabled}
                        onChange={(e) => handleNestedInputChange('settings', 'notifications', 'email', {
                          ...formData.settings.notifications.email,
                          enabled: e.target.checked
                        })}
                      />
                    }
                    label="Email Notifications"
                  />
                  <TextField
                    fullWidth
                    label="Email Address"
                    value={formData.settings.notifications.email.address}
                    onChange={(e) => handleNestedInputChange('settings', 'notifications', 'email', {
                      ...formData.settings.notifications.email,
                      address: e.target.value
                    })}
                    margin="normal"
                    disabled={!formData.settings.notifications.email.enabled}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.settings.notifications.webhook.enabled}
                        onChange={(e) => handleNestedInputChange('settings', 'notifications', 'webhook', {
                          ...formData.settings.notifications.webhook,
                          enabled: e.target.checked
                        })}
                      />
                    }
                    label="Webhook Notifications"
                  />
                  <TextField
                    fullWidth
                    label="Webhook URL"
                    value={formData.settings.notifications.webhook.url}
                    onChange={(e) => handleNestedInputChange('settings', 'notifications', 'webhook', {
                      ...formData.settings.notifications.webhook,
                      url: e.target.value
                    })}
                    margin="normal"
                    disabled={!formData.settings.notifications.webhook.enabled}
                  />
                </Grid>
              </Grid>

              {/* Security Settings */}
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Security Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.settings.security.mfaRequired}
                        onChange={(e) => handleNestedInputChange('settings', 'security', 'mfaRequired', e.target.checked)}
                      />
                    }
                    label="Require MFA"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Session Timeout (seconds)"
                    value={formData.settings.security.sessionTimeout}
                    onChange={(e) => handleNestedInputChange('settings', 'security', 'sessionTimeout', parseInt(e.target.value))}
                    margin="normal"
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={loading}
                >
                  Save Changes
                </Button>
              </Box>
            </form>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ApiClientSettings; 