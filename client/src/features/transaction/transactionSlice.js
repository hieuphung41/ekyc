import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from '../../utils/axios';

// Create new transaction
export const createTransaction = createAsyncThunk(
  "transaction/create",
  async (transactionData, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/transactions", transactionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Get all transactions
export const getTransactions = createAsyncThunk(
  "transaction/getAll",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get("/transactions");
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Get transaction status
export const getTransactionStatus = createAsyncThunk(
  "transaction/getStatus",
  async (transactionId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.get(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Verify transaction with face
export const verifyTransactionFace = createAsyncThunk(
  "transaction/verifyFace",
  async ({ transactionId, faceImage }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("faceImage", faceImage);

      const response = await axiosInstance.post(
        `/transactions/${transactionId}/verify/face`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Verify transaction with voice
export const verifyTransactionVoice = createAsyncThunk(
  "transaction/verifyVoice",
  async ({ transactionId, formData }, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post(
        `/transactions/${transactionId}/verify/voice`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

// Delete transaction
export const deleteTransaction = createAsyncThunk(
  "transaction/delete",
  async (transactionId, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.delete(`/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response.data);
    }
  }
);

const initialState = {
  transactions: [],
  currentTransaction: null,
  status: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  error: null,
  verificationStatus: {
    face: "pending", // 'pending' | 'loading' | 'succeeded' | 'failed'
    voice: "pending",
  },
};

const transactionSlice = createSlice({
  name: "transaction",
  initialState,
  reducers: {
    resetTransactionState: (state) => {
      state.currentTransaction = null;
      state.status = "idle";
      state.error = null;
      state.verificationStatus = {
        face: "pending",
        voice: "pending",
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.status = "loading";
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentTransaction = action.payload.data;
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload.message;
      })
      // Get all transactions
      .addCase(getTransactions.pending, (state) => {
        state.status = "loading";
      })
      .addCase(getTransactions.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.transactions = action.payload.data;
      })
      .addCase(getTransactions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload.message;
      })
      // Get transaction status
      .addCase(getTransactionStatus.pending, (state) => {
        state.status = "loading";
      })
      .addCase(getTransactionStatus.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.currentTransaction = action.payload.data;
      })
      .addCase(getTransactionStatus.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload.message;
      })
      // Verify face
      .addCase(verifyTransactionFace.pending, (state) => {
        state.verificationStatus.face = "loading";
      })
      .addCase(verifyTransactionFace.fulfilled, (state, action) => {
        state.verificationStatus.face = "succeeded";
        state.currentTransaction = action.payload.data;
      })
      .addCase(verifyTransactionFace.rejected, (state, action) => {
        state.verificationStatus.face = "failed";
        state.error = action.payload.message;
      })
      // Verify voice
      .addCase(verifyTransactionVoice.pending, (state) => {
        state.verificationStatus.voice = "loading";
      })
      .addCase(verifyTransactionVoice.fulfilled, (state, action) => {
        state.verificationStatus.voice = "succeeded";
        state.currentTransaction = action.payload.data;
      })
      .addCase(verifyTransactionVoice.rejected, (state, action) => {
        state.verificationStatus.voice = "failed";
        state.error = action.payload.message;
      })
      // Delete transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.status = "loading";
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.transactions = state.transactions.filter(
          (t) => t.transactionId !== action.payload.data.transactionId
        );
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload.message;
      });
  },
});

export const { resetTransactionState } = transactionSlice.actions;
export default transactionSlice.reducer; 