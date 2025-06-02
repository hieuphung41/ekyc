import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axios';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

// Async Thunk for API Client Registration
export const registerClient = createAsyncThunk(
  'apiClient/register',
  async (clientData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients/register', clientData);
      // Assuming the response on successful registration might include client details or a success message
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'API client registration failed' });
    }
  }
);

// Async Thunk for API Client Representative Login
export const loginRepresentative = createAsyncThunk(
  'apiClient/login',
  async (credentials, { rejectWithValue }) => {
    try {
      // Use the new login endpoint for representatives
      const response = await axiosInstance.post('/clients/login', credentials, {
        withCredentials: true // Send cookies
      });

      // Assuming the response includes the token and client details
      const token = response.data.data.token;

      // Store token (e.g., in localStorage or Redux state if not using cookies only)
      // For now, we'll just return the data received, assuming cookie handles persistence

      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'API client login failed' });
    }
  }
);

// Async Thunk to check API Client authentication status
export const checkClientAuth = createAsyncThunk(
  'apiClient/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      // Assuming a backend endpoint exists to check API client auth status
      // This endpoint should read the auth_token_apiclient cookie
      const response = await axiosInstance.get('/clients/check-auth', { // Placeholder endpoint
         withCredentials: true // Send cookies
      });
      
      // Assuming backend returns client data if authenticated
      if (response.data.success) {
          return response.data.data;
      } else {
          // If success is false, consider it not authenticated
          return rejectWithValue({ message: 'Not authenticated as API client' });
      }

    } catch (error) {
       // If request fails (e.g., 401), consider it not authenticated
       return rejectWithValue(error.response?.data || { message: 'API client authentication check failed' });
    }
  }
);

// Async Thunk for API Client Logout
export const logoutApiClient = createAsyncThunk(
  'apiClient/logout',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients/logout', {}, {
        withCredentials: true
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'API client logout failed' });
    }
  }
);

// API Key Management Thunks
export const getApiKeys = createAsyncThunk(
  'apiClient/getApiKeys',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/clients/api-keys');
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to fetch API keys');
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch API keys' });
    }
  }
);

export const generateApiKey = createAsyncThunk(
  'apiClient/generateApiKey',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients/api-keys/generate');
      toast.success('New API key generated successfully');
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate API key');
      return rejectWithValue(error.response?.data || { message: 'Failed to generate API key' });
    }
  }
);

export const revokeApiKey = createAsyncThunk(
  'apiClient/revokeApiKey',
  async (keyId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients/api-keys/revoke', { keyId });
      toast.success('API key revoked successfully');
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to revoke API key');
      return rejectWithValue(error.response?.data || { message: 'Failed to revoke API key' });
    }
  }
);

export const regenerateApiKey = createAsyncThunk(
  'apiClient/regenerateApiKey',
  async (keyId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients/api-keys/regenerate', { keyId });
      toast.success('API key regenerated successfully');
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to regenerate API key');
      return rejectWithValue(error.response?.data || { message: 'Failed to regenerate API key' });
    }
  }
);

const initialState = {
  client: null, // Stores API client data including representative info, permissions, etc.
  isAuthenticated: false, // Indicates if an API client representative is logged in
  loading: true,
  error: null,
  token: null, // Storing token client-side if needed, or rely purely on httpOnly cookie
  apiKeys: [],
  apiKeysLoading: false,
  apiKeysError: null
};

const apiClientSlice = createSlice({
  name: 'apiClient',
  initialState,
  reducers: {
    clearApiClientError: (state) => {
      state.error = null;
    },
    clearApiKeysError: (state) => {
      state.apiKeysError = null;
    },
    // You might add a reducer here to load client state from a stored token if not using httpOnly cookies
    // loadClientFromToken: (state, action) => { ... }
  },
  extraReducers: (builder) => {
    builder
      // Register Client
      .addCase(registerClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerClient.fulfilled, (state, action) => {
        state.loading = false;
        // Registration usually doesn't log the user in automatically, 
        // so we just indicate success or return data without setting isAuthenticated
        // state.client = action.payload; // Optionally store some registration success data
        state.error = null;
      })
      .addCase(registerClient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'API client registration failed';
      })
      
      // Login Representative
      .addCase(loginRepresentative.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginRepresentative.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.client = action.payload; // Store the client data returned by the backend
        state.token = action.payload.token; // Store token if needed client-side
        state.error = null;
      })
      .addCase(loginRepresentative.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.client = null;
        state.token = null;
        state.error = action.payload?.message || 'API client login failed';
      })

      // Check Client Auth
      .addCase(checkClientAuth.pending, (state) => {
         state.loading = true;
         state.error = null;
      })
      .addCase(checkClientAuth.fulfilled, (state, action) => {
         state.loading = false;
         state.isAuthenticated = true;
         state.client = action.payload; // Store client data if authenticated
         state.error = null;
      })
      .addCase(checkClientAuth.rejected, (state, action) => {
         state.loading = false;
         state.isAuthenticated = false;
         state.client = null; // Clear client data if not authenticated
         state.error = action.payload?.message || 'API client authentication check failed';
      })
      
      // Logout API Client
      .addCase(logoutApiClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutApiClient.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.client = null;
        state.token = null;
        state.error = null;
      })
      .addCase(logoutApiClient.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.client = null;
        state.token = null;
        state.error = action.payload?.message || 'API client logout failed';
      })

      // Get API Keys
      .addCase(getApiKeys.pending, (state) => {
        state.apiKeysLoading = true;
        state.apiKeysError = null;
      })
      .addCase(getApiKeys.fulfilled, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeys = action.payload;
        state.apiKeysError = null;
      })
      .addCase(getApiKeys.rejected, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeysError = action.payload?.message || 'Failed to fetch API keys';
      })

      // Generate API Key
      .addCase(generateApiKey.pending, (state) => {
        state.apiKeysLoading = true;
        state.apiKeysError = null;
      })
      .addCase(generateApiKey.fulfilled, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeys.push(action.payload);
        state.apiKeysError = null;
      })
      .addCase(generateApiKey.rejected, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeysError = action.payload?.message || 'Failed to generate API key';
      })

      // Revoke API Key
      .addCase(revokeApiKey.pending, (state) => {
        state.apiKeysLoading = true;
        state.apiKeysError = null;
      })
      .addCase(revokeApiKey.fulfilled, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeys = state.apiKeys.map(key => 
          key._id === action.payload._id ? { ...key, status: action.payload.status } : key
        );
        state.apiKeysError = null;
      })
      .addCase(revokeApiKey.rejected, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeysError = action.payload?.message || 'Failed to revoke API key';
      })

      // Regenerate API Key
      .addCase(regenerateApiKey.pending, (state) => {
        state.apiKeysLoading = true;
        state.apiKeysError = null;
      })
      .addCase(regenerateApiKey.fulfilled, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeys = state.apiKeys.map(key => 
          key._id === action.payload._id ? action.payload : key
        );
        state.apiKeysError = null;
      })
      .addCase(regenerateApiKey.rejected, (state, action) => {
        state.apiKeysLoading = false;
        state.apiKeysError = action.payload?.message || 'Failed to regenerate API key';
      });
  },
});

export const { clearApiClientError, clearApiKeysError } = apiClientSlice.actions;
export default apiClientSlice.reducer; 