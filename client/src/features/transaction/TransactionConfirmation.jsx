import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTransactionStatus,
  resetTransactionState,
  verifyTransactionBoth,
} from "./transactionSlice";
import { getKYCStatus } from "../kyc/kycSlice";
import Layout from "../../layouts/Layout";
import { toast } from "react-toastify";
import FaceVerification from "./FaceVerification";
import VoiceVerification from "./VoiceVerification";

const TransactionConfirmation = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [faceVerificationData, setFaceVerificationData] = useState(null);
  const [voiceVerificationData, setVoiceVerificationData] = useState(null);

  const { currentTransaction, status, error } = useSelector(
    (state) => state.transaction
  );
  const { user } = useSelector((state) => state.auth);
  const { biometricData, loading: kycLoading } = useSelector(
    (state) => state.kyc
  );
  
  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        setIsLoading(true);
        try {
          await Promise.all([
            dispatch(getTransactionStatus(id)).unwrap(),
            dispatch(getKYCStatus()).unwrap(),
          ]);
        } catch (error) {
          toast.error(error.message || "Failed to load data");
          navigate("/");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      dispatch(resetTransactionState());
    };
  }, [dispatch, id, navigate]);

  useEffect(() => {
    if (error) {
      const errorMessage = error?.message || error?.toString() || "";
      if (errorMessage.toLowerCase().includes("expired")) {
        toast.error("Transaction has expired");
        navigate("/");
      } else if (errorMessage.toLowerCase().includes("kyc data not found")) {
        toast.error("Please complete KYC verification first");
        navigate("/kyc");
      } else {
        toast.error(errorMessage);
      }
    }
  }, [error, navigate]);

  const handleFaceVerificationSuccess = (isVerified, data) => {
    if (currentTransaction?.verificationMethod === "both") {
      if (isVerified) {
        setFaceVerificationData(data);
        toast.success("Face verification successful");
        // Check if both verifications are complete
        if (voiceVerificationData) {
          handleBothVerificationsComplete();
        }
      } else {
        toast.error("Face verification failed. Please try again.");
      }
    } else {
      if (isVerified) {
        toast.success("Transaction verified successfully");
        navigate("/");
      } else {
        toast.error("Face verification failed. Please try again.");
      }
    }
  };

  const handleVoiceVerificationSuccess = (isVerified, data) => {
    if (currentTransaction?.verificationMethod === "both") {
      if (isVerified) {
        setVoiceVerificationData(data);
        toast.success("Voice verification successful");
        // Check if both verifications are complete
        if (faceVerificationData) {
          handleBothVerificationsComplete();
        }
      } else {
        toast.error("Voice verification failed. Please try again.");
      }
    } else {
      if (isVerified) {
        toast.success("Transaction verified successfully");
        navigate("/");
      } else {
        toast.error("Voice verification failed. Please try again.");
      }
    }
  };

  const handleBothVerificationsComplete = async () => {
    try {
      // Send both verifications to the server
      const response = await dispatch(
        verifyTransactionBoth({
          transactionId: id,
          faceData: faceVerificationData,
          voiceData: voiceVerificationData,
        })
      ).unwrap();
      
      toast.success("Transaction verified successfully");
      navigate("/");
    } catch (error) {
      toast.error("Failed to complete verification. Please try again.");
      // Reset verification data to allow retry
      setFaceVerificationData(null);
      setVoiceVerificationData(null);
    }
  };

  const renderVerificationStep = () => {
    if (isLoading || kycLoading || !currentTransaction) {
      return (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      );
    }

    if (!user?.isVerified || !biometricData?.faceData) {
      return (
        <div className="text-center py-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to complete KYC verification before proceeding with
                  transaction verification.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate("/kyc")}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    Complete KYC Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (currentTransaction.status === "expired" || currentTransaction.status === "approved") {
      return (
        <div className="text-center py-4">
          <div className={`p-4 rounded-lg ${
            currentTransaction.status === "approved" 
              ? "bg-green-50 border-l-4 border-green-400" 
              : "bg-red-50 border-l-4 border-red-400"
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {currentTransaction.status === "approved" ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">
                  {currentTransaction.status === "approved" 
                    ? "Transaction has been successfully verified and approved."
                    : "This transaction has expired and can no longer be verified."}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (currentTransaction.verificationMethod) {
      case "face":
        return (
          <FaceVerification
            transactionId={id}
            onSuccess={handleFaceVerificationSuccess}
          />
        );
      case "voice":
        return (
          <VoiceVerification
            transactionId={id}
            onSuccess={handleVoiceVerificationSuccess}
          />
        );
      case "both":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <FaceVerification
                transactionId={id}
                onSuccess={handleFaceVerificationSuccess}
                isVerified={!!faceVerificationData}
              />
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <VoiceVerification
                transactionId={id}
                onSuccess={handleVoiceVerificationSuccess}
                isVerified={!!voiceVerificationData}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (!currentTransaction) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Transaction Not Found
            </h2>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Transaction Verification
              </h2>
              <div className="mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Transaction ID
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentTransaction.transactionId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Amount</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentTransaction.amount} {currentTransaction.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Type</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentTransaction.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <p className="mt-1 text-sm text-gray-900">
                      {currentTransaction.status}
                    </p>
                  </div>
                </div>
              </div>
              {renderVerificationStep()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TransactionConfirmation;
