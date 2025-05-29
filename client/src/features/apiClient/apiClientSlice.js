import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axios';
import { jwtDecode } from 'jwt-decode';

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

const initialState = {
  client: null, // Stores API client data including representative info, permissions, etc.
  isAuthenticated: false, // Indicates if an API client representative is logged in
  loading: false,
  error: null,
  token: null // Storing token client-side if needed, or rely purely on httpOnly cookie
};

const apiClientSlice = createSlice({
  name: 'apiClient',
  initialState,
  reducers: {
    clearApiClientError: (state) => {
      state.error = null;
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
      });
  },
});

export const { clearApiClientError } = apiClientSlice.actions;
export default apiClientSlice.reducer; 