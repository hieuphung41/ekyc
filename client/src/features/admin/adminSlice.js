import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axios';
import { jwtDecode } from 'jwt-decode';

// Async thunks
export const loginAdmin = createAsyncThunk(
  '/users/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/users/login', credentials, {
        withCredentials: true
      });
      
      // Decode the token to get user info
      const token = response.data.data.token;
      const decoded = jwtDecode(token);
      
      // Return both the token and decoded user info
      return {
        token,
        admin: {
          ...response.data.data,
          role: decoded.role
        }
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Admin login failed' });
    }
  }
);

export const logoutAdmin = createAsyncThunk(
  '/users/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/users/logout', {}, {
        withCredentials: true
      });
      return null;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Admin logout failed' });
    }
  }
);

export const checkAdminAuth = createAsyncThunk(
  '/users/checkAuth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/users/profile', {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Admin authentication check failed' });
    }
  }
);

export const getAdminStats = createAsyncThunk(
  '/users/getStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/users/admin/stats', {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch admin stats' });
    }
  }
);

export const getAllUsers = createAsyncThunk(
  '/users/getAllUsers',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/users', {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch users' });
    }
  }
);

export const getUserById = createAsyncThunk(
  '/users/getUserById',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/users/${userId}`, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch user' });
    }
  }
);

export const updateUser = createAsyncThunk(
  '/users/updateUser',
  async ({ userId, userData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/users/${userId}`, userData, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to update user' });
    }
  }
);

export const deleteUser = createAsyncThunk(
  '/users/deleteUser',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/users/${userId}`, {
        withCredentials: true
      });
      return { userId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to delete user' });
    }
  }
);

export const createUser = createAsyncThunk(
  '/users/createUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/users', userData, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to create user' });
    }
  }
);

export const getAllApiClients = createAsyncThunk(
  '/clients/getAllApiClients',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/clients', {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch API clients' });
    }
  }
);

export const getApiClientById = createAsyncThunk(
  '/clients/getApiClientById',
  async (clientId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/clients/${clientId}`, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch API client' });
    }
  }
);

export const createApiClient = createAsyncThunk(
  '/clients/createApiClient',
  async (clientData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/clients', clientData, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to create API client' });
    }
  }
);

export const updateApiClient = createAsyncThunk(
  '/clients/updateApiClient',
  async ({ clientId, clientData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.put(`/clients/${clientId}`, clientData, {
        withCredentials: true
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to update API client' });
    }
  }
);

export const deleteApiClient = createAsyncThunk(
  '/clients/deleteApiClient',
  async (clientId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/clients/${clientId}`, {
        withCredentials: true
      });
      return { clientId, ...response.data };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to delete API client' });
    }
  }
);

const initialState = {
  admin: null,
  users: [],
  apiClients: [],
  stats: {
    totalUsers: 0,
    activeUsers: 0,
    totalApiClients: 0,
    activeApiClients: 0,
    userStats: {
      week: [],
      month: [],
      year: []
    },
    clientStats: {
      week: [],
      month: [],
      year: []
    }
  },
  loading: false,
  error: null,
  success: false
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    resetState: (state) => {
      state.loading = false;
      state.error = null;
      state.success = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedUser: (state) => {
      state.selectedUser = null;
    },
    clearSelectedApiClient: (state) => {
      state.selectedApiClient = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAdmin.fulfilled, (state, action) => {
        state.loading = false;
        state.admin = action.payload.admin;
        state.success = true;
      })
      .addCase(loginAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Login failed';
      })
      
      // Logout
      .addCase(logoutAdmin.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logoutAdmin.fulfilled, (state) => {
        state.loading = false;
        state.admin = null;
        state.users = [];
        state.apiClients = [];
        state.stats = initialState.stats;
      })
      .addCase(logoutAdmin.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Admin logout failed';
      })
      
      // Check Auth
      .addCase(checkAdminAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAdminAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.admin = action.payload;
      })
      .addCase(checkAdminAuth.rejected, (state, action) => {
        state.loading = false;
        state.admin = null;
        state.error = action.payload?.message || 'Admin authentication check failed';
      })

      // Get Admin Stats
      .addCase(getAdminStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAdminStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = {
          totalUsers: action.payload.totalUsers || 0,
          activeUsers: action.payload.activeUsers || 0,
          totalApiClients: action.payload.totalApiClients || 0,
          activeApiClients: action.payload.activeApiClients || 0,
          userStats: {
            week: action.payload.userStats?.week || [],
            month: action.payload.userStats?.month || [],
            year: action.payload.userStats?.year || []
          },
          clientStats: {
            week: action.payload.clientStats?.week || [],
            month: action.payload.clientStats?.month || [],
            year: action.payload.clientStats?.year || []
          }
        };
      })
      .addCase(getAdminStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch stats';
      })

      // Get All Users
      .addCase(getAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.users = action.payload;
        state.error = null;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch users';
      })

      // Get User By ID
      .addCase(getUserById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedUser = action.payload;
        state.error = null;
      })
      .addCase(getUserById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch user';
      })

      // Update User
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.map(user => 
          user.id === action.payload.id ? action.payload : user
        );
        state.selectedUser = action.payload;
        state.error = null;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update user';
      })

      // Delete User
      .addCase(deleteUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = state.users.filter(user => user.id !== action.payload.userId);
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete user';
      })

      // Create User
      .addCase(createUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.loading = false;
        state.users = [...state.users, action.payload];
        state.error = null;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create user';
      })

      // Get All API Clients
      .addCase(getAllApiClients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getAllApiClients.fulfilled, (state, action) => {
        state.loading = false;
        state.apiClients = action.payload;
        state.error = null;
      })
      .addCase(getAllApiClients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch API clients';
      })

      // Get API Client By ID
      .addCase(getApiClientById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getApiClientById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedApiClient = action.payload;
        state.error = null;
      })
      .addCase(getApiClientById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch API client';
      })

      // Create API Client
      .addCase(createApiClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createApiClient.fulfilled, (state, action) => {
        state.loading = false;
        state.apiClients = [...state.apiClients, action.payload];
        state.error = null;
      })
      .addCase(createApiClient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to create API client';
      })

      // Update API Client
      .addCase(updateApiClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateApiClient.fulfilled, (state, action) => {
        state.loading = false;
        state.apiClients = state.apiClients.map(client => 
          client.id === action.payload.id ? action.payload : client
        );
        state.selectedApiClient = action.payload;
        state.error = null;
      })
      .addCase(updateApiClient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to update API client';
      })

      // Delete API Client
      .addCase(deleteApiClient.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteApiClient.fulfilled, (state, action) => {
        state.loading = false;
        state.apiClients = state.apiClients.filter(client => client.id !== action.payload.clientId);
        state.error = null;
      })
      .addCase(deleteApiClient.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to delete API client';
      });
  }
});

export const { resetState, clearError, clearSelectedUser, clearSelectedApiClient } = adminSlice.actions;
export default adminSlice.reducer; 