import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { uploadIDCard } from "../kycSlice";
import { toast } from 'react-toastify';

const IDCardUploadStep = ({ onNext, onError }) => {
  const dispatch = useDispatch();
  const { loading, error, success } = useSelector((state) => state.kyc);

  const [selectedType, setSelectedType] = useState("");
  const [frontPreviewUrl, setFrontPreviewUrl] = useState(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontImageQuality, setFrontImageQuality] = useState(null);
  const [backImageQuality, setBackImageQuality] = useState(null);

  const documentTypes = [
    { id: "national_id", label: "National ID" },
    { id: "passport", label: "Passport" },
    { id: "driving_license", label: "Driving License" }
  ];

  useEffect(() => {
    if (success) {
      onNext();
    }
  }, [success, onNext]);

  useEffect(() => {
    if (error) {
      onError(error);
    }
  }, [error, onError]);

  const handleDocumentTypeSelect = (type) => {
    setSelectedType(type);
    // Reset files when document type changes
    handleDeleteImage("front");
    handleDeleteImage("back");
    toast.info('Document type selected. Please upload clear images of both sides.');
  };

  const handleFileChange = (event, side) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size too large. Maximum size is 5MB.');
      return;
    }

    const url = URL.createObjectURL(file);
    if (side === "front") {
      setFrontPreviewUrl(url);
      setFrontFile(file);
      setFrontImageQuality(null);
    } else {
      setBackPreviewUrl(url);
      setBackFile(file);
      setBackImageQuality(null);
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const quality = checkImageQuality(imageData);
      if (side === "front") {
        setFrontImageQuality(quality);
        if (quality.score < 0.3) {
          toast.warning('Front image quality is low. Please retake the photo.');
        }
      } else {
        setBackImageQuality(quality);
        if (quality.score < 0.3) {
          toast.warning('Back image quality is low. Please retake the photo.');
        }
      }
    };
    img.src = url;
  };

  const checkImageQuality = (imageData) => {
    const data = imageData.data;
    let brightness = 0;
    let contrast = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightness += (r + g + b) / 3;
    }
    brightness = brightness / (data.length / 4);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const intensity = (r + g + b) / 3;
      contrast += Math.abs(intensity - brightness);
    }
    contrast = contrast / (data.length / 4);

    return {
      brightness: brightness / 255,
      contrast: contrast / 255,
      score: (brightness / 255 + contrast / 255) / 2,
    };
  };

  const handleUpload = async () => {
    if (!selectedType) {
      toast.error("Please select a document type");
      return;
    }

    if (!frontFile || !backFile) {
      toast.error("Please upload both sides of the document");
      return;
    }

    const formData = new FormData();
    formData.append("documentType", selectedType);
    formData.append("front", frontFile);
    formData.append("back", backFile);

    try {
      await dispatch(uploadIDCard(formData)).unwrap();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    }
  };

  const handleDeleteImage = (side) => {
    if (side === "front") {
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl);
      setFrontPreviewUrl(null);
      setFrontFile(null);
      setFrontImageQuality(null);
    } else {
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
      setBackPreviewUrl(null);
      setBackFile(null);
      setBackImageQuality(null);
    }
    toast.info(`${side === 'front' ? 'Front' : 'Back'} image removed. Please upload a new one.`);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 2: Upload ID Document</h2>
      <p className="text-gray-600 mb-4">
        Please select your document type and upload clear photos of both sides.
        Ensure all information is clearly visible for automatic extraction.
      </p>

      {/* Document Type Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">Select Document Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {documentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => handleDocumentTypeSelect(type.id)}
              className={`p-4 border rounded-lg text-center transition-colors ${
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
        <div className="mt-4 space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Front Side</h3>
            {frontPreviewUrl ? (
              <div className="mb-4 relative max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
                <img
                  src={frontPreviewUrl}
                  alt="Front Side Preview"
                  className="w-full h-auto"
                />
                {frontImageQuality && (
                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-md flex items-center">
                    {frontImageQuality.score > 0.3 ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                    )}
                    <span className="text-sm">
                      {Math.round(frontImageQuality.score * 100)}%
                    </span>
                  </div>
                )}
                {frontImageQuality?.score < 0.3 && (
                  <button
                    onClick={() => handleDeleteImage("front")}
                    className="absolute bottom-2 right-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                  >
                    Delete & Retake
                  </button>
                )}
              </div>
            ) : (
              <UploadArea side="front" onChange={handleFileChange} />
            )}
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Back Side</h3>
            {backPreviewUrl ? (
              <div className="mb-4 relative max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
                <img
                  src={backPreviewUrl}
                  alt="Back Side Preview"
                  className="w-full h-auto"
                />
                {backImageQuality && (
                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-md flex items-center">
                    {backImageQuality.score > 0.3 ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                    )}
                    <span className="text-sm">
                      {Math.round(backImageQuality.score * 100)}%
                    </span>
                  </div>
                )}
                {backImageQuality?.score < 0.3 && (
                  <button
                    onClick={() => handleDeleteImage("back")}
                    className="absolute bottom-2 right-2 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                  >
                    Delete & Retake
                  </button>
                )}
              </div>
            ) : (
              <UploadArea side="back" onChange={handleFileChange} />
            )}
          </div>

          {frontPreviewUrl && backPreviewUrl && (
            <button
              onClick={handleUpload}
              disabled={
                loading ||
                frontImageQuality?.score < 0.3 ||
                backImageQuality?.score < 0.3
              }
              className={`w-full py-2 px-4 rounded-md text-white ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Uploading..." : "Upload & Extract Information"}
            </button>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const UploadArea = ({ side, onChange }) => (
  <div className="flex flex-col items-center justify-center w-full cursor-pointer">
    <label htmlFor={`id-card-upload-${side}`} className="w-full">
      <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100">
        <DocumentTextIcon className="w-10 h-10 mb-3 text-gray-400" />
        <p className="mb-2 text-sm text-gray-500">
          <span className="font-semibold">Click to upload</span> or drag and
          drop
        </p>
        <p className="text-xs text-gray-500">
          {side === "front" ? "Front" : "Back"} side of document
        </p>
      </div>
    </label>
    <input
      id={`id-card-upload-${side}`}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => onChange(e, side)}
    />
  </div>
);

export default IDCardUploadStep;
