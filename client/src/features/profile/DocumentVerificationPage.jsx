import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IdentificationIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import useKYC from "../../hooks/useKYC";
import Layout from "../../layouts/Layout";

const DocumentVerificationPage = () => {
  const navigate = useNavigate();
  const {
    documents,
    completedSteps,
    loading,
    error
  } = useKYC();

  const [selectedType, setSelectedType] = useState("");
  const [frontImage, setFrontImage] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const document = documents?.[0]; // Get the first document

  const documentTypes = [
    { id: "nationalId", label: "National ID" },
    { id: "passport", label: "Passport" },
    { id: "drivingLicense", label: "Driving License" }
  ];

  const handleDocumentTypeSelect = (type) => {
    setSelectedType(type);
  };

  const handleImageChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      if (type === 'front') {
        setFrontImage(file);
      } else {
        setBackImage(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedType || !frontImage || !backImage) {
      setUploadError("Please select document type and upload both front and back images");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('documentType', selectedType);
    formData.append('frontImage', frontImage);
    formData.append('backImage', backImage);

    try {
      const response = await fetch('/api/kyc/document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      // Refresh KYC data
      window.location.reload();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (isCompleted) => {
    return isCompleted ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <ClockIcon className="h-5 w-5 text-yellow-500" />
    );
  };

  const getStatusColor = (isCompleted) => {
    return isCompleted ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50";
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
            <XCircleIcon className="h-5 w-5 text-red-400 mr-2" />
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
                {getStatusIcon(completedSteps?.documentVerification?.completed)}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                    completedSteps?.documentVerification?.completed
                  )}`}
                >
                  {completedSteps?.documentVerification?.completed
                    ? "Verified"
                    : "Pending"}
                </span>
              </div>
            </div>

            {/* Document Upload Section */}
            {!document && (
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Select Document Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {documentTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => handleDocumentTypeSelect(type.id)}
                        className={`p-4 border rounded-lg text-center ${
                          selectedType === type.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedType && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">
                          Front Image
                        </h3>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'front')}
                          className="w-full"
                        />
                      </div>
                      <div className="p-4 border rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">
                          Back Image
                        </h3>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e, 'back')}
                          className="w-full"
                        />
                      </div>
                    </div>

                    {uploadError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600">{uploadError}</p>
                      </div>
                    )}

                    <button
                      onClick={handleUpload}
                      disabled={uploading || !frontImage || !backImage}
                      className={`w-full py-2 px-4 rounded-lg ${
                        uploading || !frontImage || !backImage
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-blue-500 hover:bg-blue-600 text-white"
                      }`}
                    >
                      {uploading ? "Uploading..." : "Upload Document"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Document Details */}
            {document && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Document Type */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Document Type
                    </h3>
                    <p className="text-lg font-semibold capitalize">
                      {document.type?.replace(/([A-Z])/g, " $1").trim() ||
                        "N/A"}
                    </p>
                  </div>

                  {/* Document Number */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Document Number
                    </h3>
                    <p className="text-lg font-semibold">
                      {document.documentNumber || "N/A"}
                    </p>
                  </div>

                  {/* Issuing Country */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Issuing Country
                    </h3>
                    <p className="text-lg font-semibold">
                      {document?.ocrData?.extractedFields?.nationality || "N/A"}
                    </p>
                  </div>

                  {/* Expiry Date */}
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Expiry Date
                    </h3>
                    <p className="text-lg font-semibold">
                      {document?.ocrData?.extractedFields?.doe
                        ? new Date(document?.ocrData?.extractedFields?.doe).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* OCR Data */}
                {document.ocrData && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      OCR Data
                    </h3>
                    <div className="space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">Confidence Score: </span>
                        {document.ocrData.confidence
                          ? `${Math.round(document.ocrData.confidence * 100)}%`
                          : "N/A"}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Processed At: </span>
                        {document.ocrData.processedAt
                          ? new Date(
                              document.ocrData.processedAt
                            ).toLocaleDateString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Completion Status */}
                <div className="p-4 border rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Step Completion
                  </h3>
                  <div className="flex items-center space-x-2">
                    {completedSteps?.documentVerification?.completed ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {completedSteps?.documentVerification?.completed
                        ? `Completed on ${new Date(
                            completedSteps.documentVerification.completedAt
                          ).toLocaleDateString()}`
                        : "Not completed"}
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
