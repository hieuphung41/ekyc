import React from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import useKYC from "../../hooks/useKYC";
import Layout from "../../layouts/Layout";

const FaceVerificationPage = () => {
  const navigate = useNavigate();
  const {
    completedSteps,
    biometricData,
    loading,
    error
  } = useKYC();

  const faceData = biometricData?.faceData;

  const getStatusIcon = (status) => {
    switch (status) {
      case "verified":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "pending":
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case true:
        return "text-green-600 bg-green-50";
      default:
        return "text-yellow-600 bg-yellow-50";
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-white">
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center text-white hover:text-blue-100 mb-4"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Profile
            </button>
            <div className="flex items-center space-x-4">
              <UserCircleIcon className="h-20 w-20" />
              <div>
                <h1 className="text-2xl font-bold">Face Verification</h1>
                <p className="text-blue-100">Biometric verification details</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Status Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">
                Verification Status
              </h2>
              <div className="flex items-center space-x-2">
                {getStatusIcon(completedSteps?.faceVerification?.completed)}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    completedSteps?.faceVerification?.completed
                  )}`}
                >
                  {completedSteps?.faceVerification?.completed
                    ? "Approved"
                    : "Rejected"}
                </span>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Liveness Score */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Liveness Score
                  </h3>
                  <p className="text-lg font-semibold">
                    {faceData?.livenessScore
                      ? `${Math.round(faceData.livenessScore * 100)}%`
                      : "N/A"}
                  </p>
                </div>

                {/* Confidence Score */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Confidence Score
                  </h3>
                  <p className="text-lg font-semibold">
                    {faceData?.confidence
                      ? `${Math.round(faceData.confidence * 100)}%`
                      : "N/A"}
                  </p>
                </div>

                {/* Upload Date */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Upload Date
                  </h3>
                  <p className="text-lg font-semibold">
                    {faceData?.uploadedAt
                      ? new Date(faceData.uploadedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>

                {/* File Information */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    File Information
                  </h3>
                  <p className="text-sm">
                    {faceData?.fileType ? `Type: ${faceData.fileType}` : "N/A"}
                  </p>
                  <p className="text-sm">
                    {faceData?.fileSize
                      ? `Size: ${Math.round(faceData.fileSize / 1024)} KB`
                      : "N/A"}
                  </p>
                </div>
              </div>

              {/* Completion Status */}
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Step Completion
                </h3>
                <div className="flex items-center space-x-2">
                  {completedSteps?.faceVerification?.completed ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm">
                    {completedSteps?.faceVerification?.completed
                      ? `Completed on ${new Date(
                          completedSteps.faceVerification.completedAt
                        ).toLocaleDateString()}`
                      : "Not completed"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FaceVerificationPage;
