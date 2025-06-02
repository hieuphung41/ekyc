import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getKYCStatus } from '../features/kyc/kycSlice';

const useKYC = () => {
  const dispatch = useDispatch();
  const {
    status,
    completedSteps,
    documents,
    personalInfo,
    biometricData,
    loading,
    error
  } = useSelector((state) => state.kyc);

  useEffect(() => {
    dispatch(getKYCStatus());
  }, [dispatch]);

  return {
    status,
    completedSteps,
    documents,
    personalInfo,
    biometricData,
    loading,
    error,
    refetch: () => dispatch(getKYCStatus())
  };
};

export default useKYC; 