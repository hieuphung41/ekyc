import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  VideoCameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../layouts/Layout';

const VideoVerificationPage = () => {
  const navigate = useNavigate();
  const { biometricData, completedSteps } = useSelector((state) => state.kyc);
  const videoData = biometricData?.videoData;

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
      case "verified":
        return "text-green-600 bg-green-50";
      case "rejected":
        return "text-red-600 bg-red-50";
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-white">
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center text-white hover:text-blue-100 mb-4"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Profile
            </button>
            <div className="flex items-center space-x-4">
              <VideoCameraIcon className="h-20 w-20" />
              <div>
                <h1 className="text-2xl font-bold">Video Verification</h1>
                <p className="text-blue-100">Liveness detection verification details</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Status Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Verification Status</h2>
              <div className="flex items-center space-x-2">
                {getStatusIcon(videoData?.verificationStatus)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(videoData?.verificationStatus)}`}>
                  {videoData?.verificationStatus?.toUpperCase() || 'PENDING'}
                </span>
              </div>
            </div>

            {/* Video Details */}
            {videoData && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Liveness Score */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Liveness Score</h3>
                    <p className="text-lg font-semibold">
                      {videoData.livenessScore 
                        ? `${Math.round(videoData.livenessScore * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Confidence Score */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Confidence Score</h3>
                    <p className="text-lg font-semibold">
                      {videoData.confidence 
                        ? `${Math.round(videoData.confidence * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Face Match Score */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Face Match Score</h3>
                    <p className="text-lg font-semibold">
                      {videoData.faceMatchScore 
                        ? `${Math.round(videoData.faceMatchScore * 100)}%`
                        : 'N/A'}
                    </p>
                  </div>

                  {/* Upload Date */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Upload Date</h3>
                    <p className="text-lg font-semibold">
                      {videoData.uploadedAt 
                        ? new Date(videoData.uploadedAt).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>

                  {/* File Information */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">File Information</h3>
                    <p className="text-sm">
                      {videoData.fileType 
                        ? `Type: ${videoData.fileType}`
                        : 'N/A'}
                    </p>
                    <p className="text-sm">
                      {videoData.fileSize 
                        ? `Size: ${Math.round(videoData.fileSize / (1024 * 1024))} MB`
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Completion Status */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Step Completion</h3>
                  <div className="flex items-center space-x-2">
                    {completedSteps?.videoVerification?.completed ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {completedSteps?.videoVerification?.completed
                        ? `Completed on ${new Date(completedSteps.videoVerification.completedAt).toLocaleDateString()}`
                        : 'Not completed'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VideoVerificationPage; 