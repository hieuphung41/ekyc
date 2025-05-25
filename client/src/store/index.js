import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import kycReducer from '../features/kyc/kycSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    kyc: kycReducer,
  },
}); 