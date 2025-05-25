import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance from '../../utils/axios';

// Async thunks for KYC operations
export const getKYCStatus = createAsyncThunk(
  'kyc/getStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get('/kyc/status');
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to fetch KYC status' });
    }
  }
);

export const uploadFacePhoto = createAsyncThunk(
  'kyc/uploadFacePhoto',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/kyc/biometric', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to upload face photo' });
    }
  }
);

export const uploadIDCard = createAsyncThunk(
  'kyc/uploadIDCard',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/kyc/document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to upload ID card' });
    }
  }
);

export const uploadVideo = createAsyncThunk(
  'kyc/uploadVideo',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/kyc/video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to upload video' });
    }
  }
);

export const resetKYCStep = createAsyncThunk(
  'kyc/resetStep',
  async (stepKey, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post('/api/kyc/reset-step', { step: stepKey });
      return response.data.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: 'Failed to reset KYC step' });
    }
  }
);

const initialState = {
  status: null,
  currentStep: null,
  completedSteps: {},
  loading: false,
  error: null,
  success: null
};

const kycSlice = createSlice({
  name: 'kyc',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSuccess: (state) => {
      state.success = null;
    },
    resetKYCState: (state) => {
      return initialState;
    }
  },
  extraReducers: (builder) => {
    builder
      // Get KYC Status
      .addCase(getKYCStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getKYCStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.status = action.payload.status;
        state.currentStep = action.payload.currentStep;
        state.completedSteps = action.payload.completedSteps;
        state.error = null;
      })
      .addCase(getKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch KYC status';
      })
      // Upload Face Photo
      .addCase(uploadFacePhoto.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadFacePhoto.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = {
          ...state.completedSteps,
          faceVerification: { completed: true }
        };
        state.success = 'Face photo uploaded successfully';
        state.error = null;
      })
      .addCase(uploadFacePhoto.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to upload face photo';
      })
      // Upload ID Card
      .addCase(uploadIDCard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadIDCard.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = {
          ...state.completedSteps,
          documentVerification: { completed: true }
        };
        state.success = 'ID card uploaded successfully';
        state.error = null;
      })
      .addCase(uploadIDCard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to upload ID card';
      })
      // Upload Video
      .addCase(uploadVideo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadVideo.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = {
          ...state.completedSteps,
          videoVerification: { completed: true }
        };
        state.success = 'Video uploaded successfully';
        state.error = null;
      })
      .addCase(uploadVideo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to upload video';
      })
      // Reset KYC Step
      .addCase(resetKYCStep.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetKYCStep.fulfilled, (state, action) => {
        state.loading = false;
        state.currentStep = action.payload.currentStep;
        state.completedSteps = action.payload.completedSteps;
        state.success = 'Step reset successfully';
        state.error = null;
      })
      .addCase(resetKYCStep.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to reset step';
      });
  }
});

export const { clearError, clearSuccess, resetKYCState } = kycSlice.actions;
export default kycSlice.reducer; 