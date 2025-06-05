import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "../../utils/axios";
import { toast } from "react-toastify";

// Async thunk to get KYC status for a specific user
export const getUserKYCStatus = createAsyncThunk(
  "kyc/getUserKYCStatus",
  async (userId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/kyc/users/status", {
        params: { id: userId },
      });
      return { userId, status: response.data.data };
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch KYC status" }
      );
    }
  }
);

// Async thunks for KYC operations
export const getKYCStatus = createAsyncThunk(
  "kyc/getStatus",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/kyc/status");
      return response.data.data;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to fetch KYC status"
      );
      return rejectWithValue(
        error.response?.data || { message: "Failed to fetch KYC status" }
      );
    }
  }
);

export const uploadFacePhoto = createAsyncThunk(
  "kyc/uploadFacePhoto",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/kyc/face", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Face photo uploaded successfully");
      return response.data.data;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Failed to upload face photo"
      );
      return rejectWithValue(
        error.response?.data || { message: "Failed to upload face photo" }
      );
    }
  }
);

export const uploadIDCard = createAsyncThunk(
  "kyc/uploadIDCard",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/kyc/document", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("ID document uploaded successfully");
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload ID card");
      return rejectWithValue(
        error.response?.data || { message: "Failed to upload ID card" }
      );
    }
  }
);

export const uploadVideo = createAsyncThunk(
  "kyc/uploadVideo",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/kyc/video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Video uploaded successfully");
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload video");
      return rejectWithValue(
        error.response?.data || { message: "Failed to upload video" }
      );
    }
  }
);

export const resetKYCStep = createAsyncThunk(
  "kyc/resetStep",
  async (stepKey, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/kyc/reset-step", {
        step: stepKey,
      });
      toast.success("KYC step reset successfully");
      return response.data.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reset KYC step");
      return rejectWithValue(
        error.response?.data || { message: "Failed to reset KYC step" }
      );
    }
  }
);

export const processVoiceVerification = createAsyncThunk(
  "kyc/processVoiceVerification",
  async (formData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/kyc/speech", formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Voice verification failed"
      );
    }
  }
);

const initialState = {
  status: null,
  completedSteps: {
    faceVerification: { completed: false },
    documentVerification: { completed: false },
    videoVerification: { completed: false },
    voiceVerification: { completed: false },
  },
  documents: [],
  personalInfo: null,
  biometricData: {
    faceData: null,
    videoData: null,
    voiceData: null,
  },
  loading: false,
  error: null,
  success: null,
};

const kycSlice = createSlice({
  name: "kyc",
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
    },
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
        state.completedSteps = action.payload.completedSteps;
        state.documents = action.payload.documents || [];
        state.personalInfo = action.payload.personalInfo;
        state.biometricData = action.payload.biometricData || {
          faceData: null,
          videoData: null,
          voiceData: null,
        };
        state.error = null;
      })
      .addCase(getUserKYCStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getUserKYCStatus.fulfilled, (state, action) => {
        const { userId, status } = action.payload;
        state.loading = false;
        // Cập nhật trạng thái KYC cho userId
        state.kycStatus = {
          ...state.kycStatus,
          [userId]: status,
        };
        state.error = null;
      })
      .addCase(getUserKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch KYC status";
      })
      .addCase(getKYCStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to fetch KYC status";
      })
      // Upload Face Photo
      .addCase(uploadFacePhoto.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadFacePhoto.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = action.payload.completedSteps;
        state.biometricData.faceData = action.payload.faceData;
        state.success = "Face photo uploaded successfully";
        state.error = null;
      })
      .addCase(uploadFacePhoto.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to upload face photo";
      })
      // Upload ID Card
      .addCase(uploadIDCard.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadIDCard.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = action.payload.completedSteps;
        state.documents = action.payload.documents || [];
        state.success = "ID card uploaded successfully";
        state.error = null;
      })
      .addCase(uploadIDCard.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to upload ID card";
      })
      // Upload Video
      .addCase(uploadVideo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(uploadVideo.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = action.payload.completedSteps;
        state.biometricData.videoData = action.payload.videoData;
        state.success = "Video uploaded successfully";
        state.error = null;
      })
      .addCase(uploadVideo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to upload video";
      })
      // Reset KYC Step
      .addCase(resetKYCStep.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetKYCStep.fulfilled, (state, action) => {
        state.loading = false;
        state.completedSteps = action.payload.completedSteps;
        state.success = "Step reset successfully";
        state.error = null;
      })
      .addCase(resetKYCStep.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || "Failed to reset step";
      })
      // Process Voice Verification
      .addCase(processVoiceVerification.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = null;
      })
      .addCase(processVoiceVerification.fulfilled, (state, action) => {
        state.loading = false;
        state.success = "Voice verification completed successfully";
        state.completedSteps.voiceVerification = {
          completed: true,
          completedAt: new Date().toISOString(),
        };
        state.biometricData.voiceData = action.payload.data;
      })
      .addCase(processVoiceVerification.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Voice verification failed";
      });
  },
});

export const { clearError, clearSuccess, resetKYCState, resetKycState } =
  kycSlice.actions;
export default kycSlice.reducer;
