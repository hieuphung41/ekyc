import React from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../layouts/Layout';

const DocumentVerificationPage = () => {
  const navigate = useNavigate();
  const { documents, completedSteps } = useSelector((state) => state.kyc);

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
              <IdentificationIcon className="h-20 w-20" />
              <div>
                <h1 className="text-2xl font-bold">Document Verification</h1>
                <p className="text-blue-100">ID document verification details</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Status Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Verification Status</h2>
              <div className="flex items-center space-x-2">
                {getStatusIcon(documents?.[0]?.verificationStatus)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(documents?.[0]?.verificationStatus)}`}>
                  {documents?.[0]?.verificationStatus?.toUpperCase() || 'PENDING'}
                </span>
              </div>
            </div>

            {/* Document Details */}
            {documents && documents.length > 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Document Type */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Document Type</h3>
                    <p className="text-lg font-semibold capitalize">
                      {documents[0].type?.replace(/([A-Z])/g, ' $1').trim() || 'N/A'}
                    </p>
                  </div>

                  {/* Document Number */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Document Number</h3>
                    <p className="text-lg font-semibold">
                      {documents[0].documentNumber || 'N/A'}
                    </p>
                  </div>

                  {/* Issuing Country */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Issuing Country</h3>
                    <p className="text-lg font-semibold">
                      {documents[0].issuingCountry || 'N/A'}
                    </p>
                  </div>

                  {/* Expiry Date */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Expiry Date</h3>
                    <p className="text-lg font-semibold">
                      {documents[0].expiryDate 
                        ? new Date(documents[0].expiryDate).toLocaleDateString()
                        : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* OCR Data */}
                {documents[0].ocrData && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">OCR Data</h3>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Confidence Score: </span>
                        {documents[0].ocrData.confidence 
                          ? `${Math.round(documents[0].ocrData.confidence * 100)}%`
                          : 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Processed At: </span>
                        {documents[0].ocrData.processedAt 
                          ? new Date(documents[0].ocrData.processedAt).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Completion Status */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Step Completion</h3>
                  <div className="flex items-center space-x-2">
                    {completedSteps?.documentVerification?.completed ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {completedSteps?.documentVerification?.completed
                        ? `Completed on ${new Date(completedSteps.documentVerification.completedAt).toLocaleDateString()}`
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

export default DocumentVerificationPage; 