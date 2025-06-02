import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  UserCircleIcon,
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { checkAuthStatus } from "../../utils/auth";
import useKYC from "../../hooks/useKYC";
import Layout from "../../layouts/Layout";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    status,
    completedSteps,
    documents,
    personalInfo,
    biometricData,
    loading: kycLoading,
    error: kycError,
    refetch: refetchKYC
  } = useKYC();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userData = await checkAuthStatus();
        if (!userData) {
          navigate("/login");
          return;
        }
        setUser(userData);
      } catch (err) {
        setError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading || kycLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  if (error || kycError) {
    return (
      <Layout>
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-700">{error || kycError}</p>
          </div>
        </div>
      </Layout>
    );
  }

  const getStatusColor = (isCompleted) => {
    return isCompleted ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50";
  };

  const getStatusIcon = (isCompleted) => {
    return isCompleted ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <ClockIcon className="h-5 w-5 text-yellow-500" />
    );
  };

  const getOverallStatus = () => {
    const allStepsCompleted = 
      completedSteps?.faceVerification?.completed &&
      completedSteps?.documentVerification?.completed &&
      completedSteps?.videoVerification?.completed;

    return {
      isCompleted: allStepsCompleted,
      text: allStepsCompleted ? "COMPLETED" : "IN PROGRESS"
    };
  };

  const overallStatus = getOverallStatus();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-white">
            <div className="flex items-center space-x-4">
              <UserCircleIcon className="h-20 w-20" />
              <div>
                <h1 className="text-2xl font-bold">
                  {user?.firstName} {user?.lastName}
                </h1>
                <p className="text-blue-100">{user?.email}</p>
                <p className="text-blue-100">{user?.phoneNumber}</p>
              </div>
            </div>
          </div>

          {/* KYC Status Section */}
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold mb-4">KYC Status</h2>
            <div className="flex items-center space-x-2 mb-4">
              {getStatusIcon(overallStatus.isCompleted)}
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(overallStatus.isCompleted)}`}>
                {overallStatus.text}
              </span>
            </div>

            {/* Verification Steps */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Verification Steps</h3>
              <div className="space-y-2">
                <Link
                  to="/profile/face-verification"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(completedSteps?.faceVerification?.completed)}
                    <span>Face Verification</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {completedSteps?.faceVerification?.completed
                      ? `Completed on ${new Date(completedSteps.faceVerification.completedAt).toLocaleDateString()}`
                      : 'Not completed'}
                  </span>
                </Link>

                <Link
                  to="/profile/document-verification"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(completedSteps?.documentVerification?.completed)}
                    <span>Document Verification</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {completedSteps?.documentVerification?.completed
                      ? `Completed on ${new Date(completedSteps.documentVerification.completedAt).toLocaleDateString()}`
                      : 'Not completed'}
                  </span>
                </Link>

                <Link
                  to="/profile/video-verification"
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(completedSteps?.videoVerification?.completed)}
                    <span>Video Verification</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {completedSteps?.videoVerification?.completed
                      ? `Completed on ${new Date(completedSteps.videoVerification.completedAt).toLocaleDateString()}`
                      : 'Not completed'}
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Document Information */}
          {documents && documents.length > 0 && (
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold mb-4">Document Information</h2>
              <div className="space-y-4">
                {documents.map((doc, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <IdentificationIcon className="h-5 w-5 text-blue-500" />
                        <span className="font-medium capitalize">
                          {doc.type.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                          completedSteps?.documentVerification?.completed
                        )}`}
                      >
                        {completedSteps?.documentVerification?.completed ? "VERIFIED" : "PENDING"}
                      </span>
                    </div>
                    {doc.documentNumber && (
                      <p className="text-sm text-gray-600">
                        Document Number: {doc.documentNumber}
                      </p>
                    )}
                    {doc.issuingCountry && (
                      <p className="text-sm text-gray-600">
                        Issuing Country: {doc.issuingCountry}
                      </p>
                    )}
                    {doc.expiryDate && (
                      <p className="text-sm text-gray-600">
                        Expiry Date: {new Date(doc.expiryDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Information */}
          {personalInfo && (
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {personalInfo.dateOfBirth && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium text-gray-500">Date of Birth</p>
                    <p className="text-gray-900">
                      {new Date(personalInfo.dateOfBirth).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {personalInfo.nationality && (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm font-medium text-gray-500">Nationality</p>
                    <p className="text-gray-900">{personalInfo.nationality}</p>
                  </div>
                )}
                {personalInfo.address && (
                  <div className="p-4 border rounded-lg col-span-2">
                    <p className="text-sm font-medium text-gray-500">Address</p>
                    <p className="text-gray-900">
                      {[
                        personalInfo.address.street,
                        personalInfo.address.city,
                        personalInfo.address.state,
                        personalInfo.address.country,
                        personalInfo.address.postalCode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 