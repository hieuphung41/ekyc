import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import FaceDetectionStep from "./components/FaceDetectionStep";
import IDCardUploadStep from "./components/IDCardUploadStep";
import VideoVerificationStep from "./components/VideoVerificationStep";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/solid";

const KYCVerification = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Progress to next step
  const handleNextStep = (successMessage = "") => {
    if (successMessage) {
      setSuccess(successMessage);
    }
    setStep(prevStep => prevStep + 1);
  };

  // Go to dashboard after completion
  const handleCompletion = () => {
    setSuccess("Verification completed successfully!");
    navigate("/dashboard");
  };

  // Handle errors across components
  const handleError = (errorMessage) => {
    setError(errorMessage);
  };

  // Update loading state across components
  const setLoadingState = (isLoading) => {
    setLoading(isLoading);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto mt-8">
      <div className="mb-6 flex justify-between">
        <h2 className="text-xl font-semibold">Step {step} of 3</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
            <span>{success}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center my-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {step === 1 && (
        <FaceDetectionStep 
          onNext={handleNextStep}
          onError={handleError}
          setLoading={setLoadingState}
        />
      )}
      
      {step === 2 && (
        <IDCardUploadStep 
          onNext={handleNextStep}
          onError={handleError}
          setLoading={setLoadingState}
        />
      )}
      
      {step === 3 && (
        <VideoVerificationStep 
          onComplete={handleCompletion}
          onError={handleError}
          setLoading={setLoadingState}
        />
      )}
    </div>
  );
};

export default KYCVerification;
