import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axios';
import { checkAuthStatus } from '../../utils/auth';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';

export const login = createAsyncThunk(
  '/users/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/users/login', credentials, {
        withCredentials: true
      });
      
      // Decode the token to get user info
      const token = response.data.data.token;
      const decoded = jwtDecode(token);
      
      toast.success('Login successful!');
      return {
        token,
        user: {
          ...response.data.data,
          role: decoded.role
        }
      };
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
      return rejectWithValue(error.response?.data || { message: 'Login failed' });
    }
  }
);

export const register = createAsyncThunk(
  'users/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/users/register', userData, {
        withCredentials: true
      });
      toast.success('Registration successful! Please login.');
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed');
      return rejectWithValue(error.response?.data || { message: 'Registration failed' });
    }
  }
);

export const checkAuth = createAsyncThunk(
  'auth/check',
  async (_, { rejectWithValue }) => {
    try {
      const userData = await checkAuthStatus();
      if (!userData) {
        return rejectWithValue({ message: 'Not authenticated' });
      }
      
      // If we have a token in the response, decode it
      if (userData.token) {
        const decoded = jwtDecode(userData.token);
        return {
          ...userData,
          role: decoded.role
        };
      }
      
      return userData;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Authentication check failed' });
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await axiosInstance.post('/users/logout', {}, {
        withCredentials: true
      });
      toast.success('Logged out successfully');
      return null;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Logout failed');
      return rejectWithValue(error.response?.data || { message: 'Logout failed' });
    }
  }
);

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  role: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.role = action.payload.user.role;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.error = action.payload?.message || 'Login failed';
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Registration failed';
      })
      .addCase(checkAuth.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
        state.role = action.payload.role;
        state.error = null;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.error = null;
      })
      .addCase(logout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.role = null;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Logout failed';
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer; 