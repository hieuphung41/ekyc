import React, { useState } from "react";
import axiosInstance from "../../../utils/axios";
import {
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { uploadIDCard } from "../kycSlice";
import { useDispatch } from "react-redux";

const IDCardUploadStep = ({ onNext, onError, setLoading }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [processingOcr, setProcessingOcr] = useState(false);
  const dispatch = useDispatch();

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create a preview URL
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
    setOcrData(null); // Reset OCR data when a new file is selected
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      onError("Please select a file to upload");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("frontImage", selectedFile);

      const result = await dispatch(uploadIDCard(formData));

      if (!result.error) {
        // After successful upload, trigger OCR processing (if needed based on backend response)
        // Assuming OCR is triggered on the backend after successful upload, or requires a separate step
        // If OCR needs a separate frontend trigger after upload, call processOCR here.
        // For now, we proceed assuming the upload is sufficient for this step.
        onNext("ID document uploaded. Processing..."); // Indicate upload is done and processing will follow
      } else {
        onError(result.payload?.message || "Failed to upload ID card");
      }
    } catch (error) {
      console.error("Error uploading ID card:", error);
      onError(error.message || "Failed to upload ID card");
    } finally {
      setLoading(false);
    }
  };

  const processOCR = async () => {
    try {
      setProcessingOcr(true);

      const response = await axiosInstance.post("/kyc/ocr");

      if (response.data.success) {
        setOcrData(response.data.data);
      }
    } catch (error) {
      console.error("Error processing OCR:", error);
      onError(
        error.response?.data?.message || "Failed to process document with OCR"
      );
    } finally {
      setProcessingOcr(false);
      setLoading(false);
    }
  };

  const confirmAndProceed = () => {
    onNext("ID document verified successfully!");
  };

  // Release memory when the component is removed
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 2: Upload ID Document</h2>
      <p className="text-gray-600 mb-4">
        Please upload a clear photo of your ID card, passport, or driver's
        license. Ensure all information is clearly visible for the system to
        automatically extract your details.
      </p>

      <div className="mt-4">
        {previewUrl && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Document Preview:</p>
            <div className="relative w-full max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
              <img
                src={previewUrl}
                alt="ID Document Preview"
                className="w-full h-auto"
              />
            </div>
          </div>
        )}

        {!ocrData && (
          <div className="flex flex-col items-center justify-center w-full">
            <label htmlFor="id-card-upload" className="w-full">
              <div
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 ${
                  previewUrl
                    ? "border-green-300 bg-green-50 hover:bg-green-100"
                    : ""
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <DocumentTextIcon className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or
                    drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG, or PDF (MAX. 10MB)
                  </p>
                  {previewUrl && (
                    <p className="mt-2 text-sm text-green-600">
                      File selected!
                    </p>
                  )}
                </div>
              </div>
            </label>
            <input
              id="id-card-upload"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {ocrData ? (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <CheckCircleIcon className="h-6 w-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-medium text-blue-800">
                Document Information Extracted
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Document Number
                </p>
                <p className="text-md font-semibold">
                  {ocrData.documentNumber}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Name</p>
                <p className="text-md font-semibold">{ocrData.name}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Date of Birth
                </p>
                <p className="text-md font-semibold">
                  {new Date(ocrData.dateOfBirth).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Expiry Date</p>
                <p className="text-md font-semibold">
                  {new Date(ocrData.expiryDate).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Issue Date</p>
                <p className="text-md font-semibold">
                  {new Date(ocrData.issueDate).toLocaleDateString()}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Issuing Country
                </p>
                <p className="text-md font-semibold">
                  {ocrData.issuingCountry}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                Please review the extracted information for accuracy. If
                everything looks correct, click continue.
              </p>
              <button
                onClick={confirmAndProceed}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || processingOcr}
              className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (!selectedFile || processingOcr) &&
                "opacity-50 cursor-not-allowed"
              }`}
            >
              {processingOcr
                ? "Processing Document..."
                : "Upload & Scan Document"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default IDCardUploadStep;
