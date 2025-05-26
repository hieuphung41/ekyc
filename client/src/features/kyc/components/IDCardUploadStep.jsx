import React, { useState, useEffect } from "react";
import axiosInstance from "../../../utils/axios";
import {
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { uploadIDCard } from "../kycSlice";
import { useDispatch } from "react-redux";
import Tesseract from "tesseract.js";

const IDCardUploadStep = ({ onNext, onError }) => {
  const [frontPreviewUrl, setFrontPreviewUrl] = useState(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError, setOcrError] = useState(null);
  const [frontImageQuality, setFrontImageQuality] = useState(null);
  const [backImageQuality, setBackImageQuality] = useState(null);
  const [currentSide, setCurrentSide] = useState("front"); // 'front' or 'back'
  const dispatch = useDispatch();

  const handleFileChange = (event, side) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create a preview URL
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
    setOcrData(null);
    setOcrError(null);

    // Check image quality
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Get image data for quality check
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const quality = checkImageQuality(imageData);
      if (side === "front") {
        setFrontImageQuality(quality);
      } else {
        setBackImageQuality(quality);
      }
    };
    img.src = url;
  };

  const checkImageQuality = (imageData) => {
    const data = imageData.data;
    let brightness = 0;
    let contrast = 0;

    // Calculate brightness and contrast
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      brightness += (r + g + b) / 3;
    }
    brightness = brightness / (data.length / 4);

    // Calculate contrast
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const intensity = (r + g + b) / 3;
      contrast += Math.abs(intensity - brightness);
    }
    contrast = contrast / (data.length / 4);

    // Return quality score (0-1)
    return {
      brightness: brightness / 255,
      contrast: contrast / 255,
      score: (brightness / 255 + contrast / 255) / 2,
    };
  };

  const extractDocumentNumber = (text) => {
    const patterns = [
      /(?:Số|No)[:\s]*(\d{12})/i, // Vietnamese ID format (12 digits)
      /(?:Số|No)[:\s]*(\d{9})/i, // Old ID format (9 digits)
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const extractName = (text) => {
    const namePatterns = [
      /(?:Họ và tên|Full name)[:\s]*([A-Za-zÀ-ỹ\s]{2,})/i,
      /(?:Họ và tên|Full name)[:\s]*([A-Za-zÀ-ỹ\s]{2,})\s*(?:\([A-Za-zÀ-ỹ\s]{2,}\))?/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        const name = match[1].trim();
        if (name.split(/\s+/).length >= 2) {
          return name;
        }
      }
    }
    return null;
  };

  const extractDateOfBirth = (text) => {
    const dobPatterns = [
      /(?:Ngày sinh|Date of birth)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:Ngày sinh|Date of birth)[:\s]*(\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{2,4})/i,
    ];

    for (const pattern of dobPatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = match[1].replace(/\s+/g, "");
        if (date.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/)) {
          return date;
        }
      }
    }
    return null;
  };

  const extractGender = (text) => {
    const genderPatterns = [
      /(?:Giới tính|Sex)[:\s]*([A-Za-zÀ-ỹ]+)/i,
      /(?:Giới tính|Sex)[:\s]*(Nam|Nữ|Male|Female)/i,
    ];

    for (const pattern of genderPatterns) {
      const match = text.match(pattern);
      if (match) {
        const gender = match[1].trim();
        return gender;
      }
    }
    return null;
  };

  const extractNationality = (text) => {
    const nationalityPatterns = [
      /(?:Quốc tịch|Nationality)[:\s]*([A-Za-zÀ-ỹ\s]+)/i,
    ];

    for (const pattern of nationalityPatterns) {
      const match = text.match(pattern);
      if (match) {
        const nationality = match[1].trim();
        return nationality;
      }
    }
    return null;
  };

  const extractPlaceOfOrigin = (text) => {
    const originPatterns = [
      /(?:Quê quán|Place of origin)[:\s]*([A-Za-zÀ-ỹ0-9\s,.-]{5,})/i,
    ];

    for (const pattern of originPatterns) {
      const match = text.match(pattern);
      if (match) {
        const origin = match[1].trim();
        if (origin.length >= 5) {
          return origin;
        }
      }
    }
    return null;
  };

  const extractPlaceOfResidence = (text) => {
    const residencePatterns = [
      /(?:Nơi thường trú|Place of residence)[:\s]*([A-Za-zÀ-ỹ0-9\s,.-]{5,})/i,
    ];

    for (const pattern of residencePatterns) {
      const match = text.match(pattern);
      if (match) {
        const residence = match[1].trim();
        if (residence.length >= 5) {
          return residence;
        }
      }
    }
    return null;
  };

  const extractExpiryDate = (text) => {
    const expiryPatterns = [
      /(?:Có giá trị đến|Date of expiry)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:Có giá trị đến|Date of expiry)[:\s]*(\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{2,4})/i,
    ];

    for (const pattern of expiryPatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = match[1].replace(/\s+/g, "");
        if (date.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/)) {
          return date;
        }
      }
    }
    return null;
  };

  const extractPersonalIdentification = (text) => {
    const identificationPatterns = [
      /(?:Đặc điểm nhận dạng|Personal identification)[:\s]*([A-Za-zÀ-ỹ0-9\s,.-]{2,})/i,
    ];

    for (const pattern of identificationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const identification = match[1].trim();
        return identification;
      }
    }
    return null;
  };

  const extractIssueDate = (text) => {
    const issuePatterns = [
      /(?:Ngày,\s*tháng,\s*năm|Date,\s*month,\s*year)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
      /(?:Ngày,\s*tháng,\s*năm|Date,\s*month,\s*year)[:\s]*(\d{1,2}\s*[-/]\s*\d{1,2}\s*[-/]\s*\d{2,4})/i,
    ];

    for (const pattern of issuePatterns) {
      const match = text.match(pattern);
      if (match) {
        const date = match[1].replace(/\s+/g, "");
        if (date.match(/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/)) {
          return date;
        }
      }
    }
    return null;
  };

  const processOCR = async () => {
    if (!frontFile || !backFile) {
      setOcrError("Please upload both sides of the ID card");
      return;
    }

    try {
      setProcessingOcr(true);
      setOcrError(null);
      setOcrProgress(0);

      // Create workers for front and back
      const frontWorker = await Tesseract.createWorker("eng+vie");
      const backWorker = await Tesseract.createWorker("eng+vie");

      try {
        // Process front side
        const frontResult = await frontWorker.recognize(frontFile);
        setOcrProgress(0.5);

        // Process back side
        const backResult = await backWorker.recognize(backFile);
        setOcrProgress(1);

        // Combine and extract information from both sides
        const frontText = frontResult.data.text;
        const backText = backResult.data.text;
        const combinedText = frontText + "\n" + backText;

        const extractedData = {
          documentNumber: extractDocumentNumber(combinedText),
          name: extractName(frontText),
          dateOfBirth: extractDateOfBirth(frontText),
          gender: extractGender(frontText),
          nationality: extractNationality(frontText),
          placeOfOrigin: extractPlaceOfOrigin(frontText),
          placeOfResidence: extractPlaceOfResidence(frontText),
          expiryDate: extractExpiryDate(frontText),
          personalIdentification: extractPersonalIdentification(backText),
          issueDate: extractIssueDate(backText),
          rawText: {
            front: frontText,
            back: backText,
          },
        };

        setOcrData(extractedData);
      } finally {
        // Always terminate workers
        await frontWorker.terminate();
        await backWorker.terminate();
      }
    } catch (error) {
      console.error("OCR processing error:", error);
      setOcrError(error.message || "Failed to process document with OCR");
    } finally {
      setProcessingOcr(false);
    }
  };

  const handleUpload = async () => {
    if (!frontFile || !backFile) {
      onError("Please upload both sides of the ID card");
      return;
    }

    if (!ocrData) {
      onError("Please wait for OCR processing to complete");
      return;
    }

    try {
      true;
      const formData = new FormData();
      formData.append("frontImage", frontFile);
      formData.append("backImage", backFile);
      formData.append("documentType", "nationalId"); // Hardcoded for testing

      const result = await dispatch(uploadIDCard(formData));

      if (!result.error) {
        onNext("ID document uploaded and verified successfully!");
      } else {
        onError(result.payload?.message || "Failed to upload ID card");
      }
    } catch (error) {
      console.error("Error uploading ID card:", error);
      onError(error.message || "Failed to upload ID card");
    } finally {
      false;
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
    setOcrData(null);
    setOcrError(null);
  };

  // Release memory when the component is removed
  useEffect(() => {
    return () => {
      if (frontPreviewUrl) URL.revokeObjectURL(frontPreviewUrl);
      if (backPreviewUrl) URL.revokeObjectURL(backPreviewUrl);
    };
  }, [frontPreviewUrl, backPreviewUrl]);

  const renderUploadArea = (side) => {
    const isFront = side === "front";
    const previewUrl = isFront ? frontPreviewUrl : backPreviewUrl;
    const imageQuality = isFront ? frontImageQuality : backImageQuality;
    const file = isFront ? frontFile : backFile;

    return (
      <div className="flex flex-col items-center justify-center w-full">
        <label htmlFor={`id-card-upload-${side}`} className="w-full">
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
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500">
                {isFront ? "Front" : "Back"} side of ID card
              </p>
              {previewUrl && (
                <p className="mt-2 text-sm text-green-600">File selected!</p>
              )}
            </div>
          </div>
        </label>
        <input
          id={`id-card-upload-${side}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange(e, side)}
        />
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 2: Upload ID Document</h2>
      <p className="text-gray-600 mb-4">
        Please upload clear photos of both sides of your ID card, passport, or
        driver's license. Ensure all information is clearly visible for the
        system to automatically extract your details.
      </p>

      <div className="mt-4 space-y-6">
        {/* Front Side Upload */}
        <div>
          <h3 className="text-lg font-medium mb-2">Front Side</h3>
          {frontPreviewUrl && (
            <div className="mb-4">
              <div className="relative w-full max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
                <img
                  src={frontPreviewUrl}
                  alt="ID Front Preview"
                  className="w-full h-auto"
                />
                {frontImageQuality && (
                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-md">
                    <p className="text-sm font-medium">Image Quality:</p>
                    <div className="flex items-center">
                      {frontImageQuality.score > 0.3 ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                      )}
                      <span className="text-sm">
                        {Math.round(frontImageQuality.score * 100)}%
                      </span>
                    </div>
                  </div>
                )}
                {frontImageQuality?.score < 0.3 && (
                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={() => handleDeleteImage("front")}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Delete & Retake
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {!frontPreviewUrl && renderUploadArea("front")}
        </div>

        {/* Back Side Upload */}
        <div>
          <h3 className="text-lg font-medium mb-2">Back Side</h3>
          {backPreviewUrl && (
            <div className="mb-4">
              <div className="relative w-full max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
                <img
                  src={backPreviewUrl}
                  alt="ID Back Preview"
                  className="w-full h-auto"
                />
                {backImageQuality && (
                  <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-2 rounded-lg shadow-md">
                    <p className="text-sm font-medium">Image Quality:</p>
                    <div className="flex items-center">
                      {backImageQuality.score > 0.3 ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mr-1" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-red-500 mr-1" />
                      )}
                      <span className="text-sm">
                        {Math.round(backImageQuality.score * 100)}%
                      </span>
                    </div>
                  </div>
                )}
                {backImageQuality?.score < 0.3 && (
                  <div className="absolute bottom-2 right-2">
                    <button
                      onClick={() => handleDeleteImage("back")}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      Delete & Retake
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {!backPreviewUrl && renderUploadArea("back")}
        </div>

        {frontPreviewUrl && backPreviewUrl && !ocrData && !processingOcr && (
          <div className="mt-4">
            <button
              onClick={processOCR}
              disabled={
                !frontFile ||
                !backFile ||
                frontImageQuality?.score < 0.3 ||
                backImageQuality?.score < 0.3
              }
              className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                (!frontFile ||
                  !backFile ||
                  frontImageQuality?.score < 0.3 ||
                  backImageQuality?.score < 0.3) &&
                "opacity-50 cursor-not-allowed"
              }`}
            >
              {frontImageQuality?.score < 0.3 || backImageQuality?.score < 0.3
                ? "Image quality too low - Please retake"
                : "Process Document"}
            </button>
          </div>
        )}

        {processingOcr && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress * 100}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Processing document... {Math.round(ocrProgress * 100)}%
            </p>
          </div>
        )}

        {ocrError && (
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
            <div className="flex">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <span>{ocrError}</span>
            </div>
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
                <p className="text-sm font-medium text-gray-500">ID Number</p>
                <p className="text-md font-semibold">
                  {ocrData.documentNumber}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Full Name</p>
                <p className="text-md font-semibold">{ocrData.name}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Date of Birth
                </p>
                <p className="text-md font-semibold">{ocrData.dateOfBirth}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Gender</p>
                <p className="text-md font-semibold">{ocrData.gender}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Nationality</p>
                <p className="text-md font-semibold">{ocrData.nationality}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Place of Origin
                </p>
                <p className="text-md font-semibold">{ocrData.placeOfOrigin}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm md:col-span-2">
                <p className="text-sm font-medium text-gray-500">
                  Place of Residence
                </p>
                <p className="text-md font-semibold">
                  {ocrData.placeOfResidence}
                </p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">
                  Date of Expiry
                </p>
                <p className="text-md font-semibold">{ocrData.expiryDate}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm">
                <p className="text-sm font-medium text-gray-500">Issue Date</p>
                <p className="text-md font-semibold">{ocrData.issueDate}</p>
              </div>

              <div className="bg-white p-3 rounded-md shadow-sm md:col-span-2">
                <p className="text-sm font-medium text-gray-500">
                  Personal Identification
                </p>
                <p className="text-md font-semibold">
                  {ocrData.personalIdentification}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">
                Please review the extracted information for accuracy. If
                everything looks correct, click continue.
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={() => {
                    setOcrData(null);
                    setOcrError(null);
                  }}
                  className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Retry
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default IDCardUploadStep;
