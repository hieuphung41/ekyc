import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import Layout from "../../layouts/Layout";
import FaceDetectionStep from "./components/FaceDetectionStep";
import IDCardUploadStep from "./components/IDCardUploadStep";
import VideoVerificationStep from "./components/VideoVerificationStep";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import {
  UserCircleIcon,
  IdentificationIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";
import { getKYCStatus, resetKYCStep, clearError, clearSuccess } from "./kycSlice";

const KYCVerification = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { status, completedSteps, loading, error, success } = useSelector((state) => state.kyc);

  // Determine current step based on completedSteps
  const getCurrentStep = () => {
    if (!completedSteps) return 1;
    if (!completedSteps.faceVerification?.completed) return 1;
    if (!completedSteps.documentVerification?.completed) return 2;
    if (!completedSteps.videoVerification?.completed) return 3;
    return 4;
  };

  const currentStep = getCurrentStep();

  // Step information
  const steps = [
    {
      number: 1,
      title: "Face Detection & Liveness",
      description: "Take a photo of your face with liveness detection",
      icon: UserCircleIcon,
      key: "faceVerification",
    },
    {
      number: 2,
      title: "ID Document Verification",
      description: "Upload your ID document for OCR processing",
      icon: IdentificationIcon,
      key: "documentVerification",
    },
    {
      number: 3,
      title: "Video Verification",
      description: "Record a short video with interactive instructions",
      icon: VideoCameraIcon,
      key: "videoVerification",
    },
  ];

  // Fetch KYC status on component mount
  useEffect(() => {
    dispatch(getKYCStatus());
  }, [dispatch]);

  // Handle navigation when KYC is approved
  useEffect(() => {
    if (status === "approved") {
      navigate("/");
    }
  }, [status, navigate]);

  // Progress to next step
  const handleNextStep = () => {
    dispatch(clearError());
    dispatch(clearSuccess());
    dispatch(getKYCStatus()); // Refresh KYC status after step completion
  };

  // Handle errors across components
  const handleError = (errorMessage) => {
    dispatch(clearSuccess());
  };

  // Reset a step to try again
  const handleResetStep = async (stepKey) => {
    try {
      await dispatch(resetKYCStep(stepKey));
      dispatch(getKYCStatus()); // Refresh KYC status after reset
    } catch (error) {
      console.error("Error resetting step:", error);
    }
  };

  // Show loading indicator while fetching status
  if (loading && !completedSteps) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  // If all steps are completed, show completion screen
  if (currentStep === 4) {
    return (
      <Layout>
        <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
          <div className="text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-center mb-2">
              KYC Verification Complete
            </h1>
            <p className="text-gray-600 mb-6">
              Your verification is being reviewed. We'll notify you once it's
              approved.
            </p>

            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
      <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-center mb-6">
          eKYC Verification
        </h1>

        {/* Progress Tracker */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((s, index) => {
              const isCompleted = completedSteps?.[s.key]?.completed || false;
              const isCurrentStep = s.number === currentStep;

              return (
                <React.Fragment key={s.number}>
                  {/* Step Circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`relative flex items-center justify-center w-12 h-12 rounded-full ${
                        isCompleted
                          ? "bg-green-500"
                          : isCurrentStep
                          ? "bg-blue-600"
                          : "bg-gray-200"
                      }`}
                    >
                      <s.icon
                        className={`h-6 w-6 ${
                          isCompleted || isCurrentStep
                            ? "text-white"
                            : "text-gray-500"
                        }`}
                      />

                      {/* Reset button for completed steps */}
                      {isCompleted && (
                        <button
                          onClick={() => handleResetStep(s.key)}
                          className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                          title="Reset this step"
                        >
                          <ArrowPathIcon className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                    </div>
                    <div className="text-center mt-2">
                      <p
                        className={`text-sm font-medium ${
                          isCompleted
                            ? "text-green-600"
                            : isCurrentStep
                            ? "text-blue-600"
                            : "text-gray-500"
                        }`}
                      >
                        Step {s.number}
                      </p>
                      <p
                        className={`text-xs ${
                          isCurrentStep ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {s.title}
                      </p>
                    </div>
                  </div>

                  {/* Connector Line (don't show after last step) */}
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        isCompleted || s.number < currentStep
                          ? "bg-green-500"
                          : "bg-gray-200"
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 text-green-700">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" />
              <span>{success}</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          {currentStep === 1 && (
            <FaceDetectionStep
              onNext={handleNextStep}
              onError={handleError}
            />
          )}

          {currentStep === 2 && (
            <IDCardUploadStep
              onNext={handleNextStep}
              onError={handleError}
            />
          )}

          {currentStep === 3 && (
            <VideoVerificationStep
              onComplete={handleNextStep}
              onError={handleError}
            />
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Your data is secured with end-to-end encryption and is only used for
            identity verification.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default KYCVerification;
