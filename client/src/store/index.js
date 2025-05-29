import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import kycReducer from '../features/kyc/kycSlice';
import apiClientReducer from "../features/apiClient/apiClientSlice"

export const store = configureStore({
  reducer: {
    auth: authReducer,
    kyc: kycReducer,
    apiClient: apiClientReducer
  },
}); 