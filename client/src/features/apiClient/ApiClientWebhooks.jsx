import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Box,
  Divider,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useApiClient } from './hooks/useApiClient';

const ApiClientWebhooks = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [formData, setFormData] = useState({
    url: '',
    events: [],
    isActive: true,
    secret: '',
  });
  const { getWebhooks, createWebhook, updateWebhook, deleteWebhook } = useApiClient();

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      setLoading(true);
      const data = await getWebhooks();
      setWebhooks(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (webhook = null) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.isActive,
        secret: webhook.secret,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        url: '',
        events: [],
        isActive: true,
        secret: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingWebhook(null);
    setFormData({
      url: '',
      events: [],
      isActive: true,
      secret: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingWebhook) {
        await updateWebhook(editingWebhook._id, formData);
      } else {
        await createWebhook(formData);
      }
      handleCloseDialog();
      fetchWebhooks();
    } catch (err) {
      setError(err.message || 'Failed to save webhook');
    }
  };

  const handleDelete = async (webhookId) => {
    if (window.confirm('Are you sure you want to delete this webhook?')) {
      try {
        await deleteWebhook(webhookId);
        fetchWebhooks();
      } catch (err) {
        setError(err.message || 'Failed to delete webhook');
      }
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
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" component="h1">
                Webhooks
              </Typography>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add Webhook
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <List>
              {webhooks.map((webhook) => (
                <React.Fragment key={webhook._id}>
                  <ListItem>
                    <ListItemText
                      primary={webhook.url}
                      secondary={
                        <>
                          <Typography component="span" variant="body2" color="textPrimary">
                            Events: {webhook.events.join(', ')}
                          </Typography>
                          <br />
                          <Typography component="span" variant="body2" color="textSecondary">
                            Status: {webhook.isActive ? 'Active' : 'Inactive'}
                          </Typography>
                        </>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        aria-label="edit"
                        onClick={() => handleOpenDialog(webhook)}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDelete(webhook._id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingWebhook ? 'Edit Webhook' : 'Add New Webhook'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Webhook URL"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Secret Key"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                  helperText="Used to sign webhook payloads"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained" color="primary">
              {editingWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default ApiClientWebhooks; 