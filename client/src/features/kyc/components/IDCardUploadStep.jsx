import React, { useState } from "react";
import axios from "axios";

const IDCardUploadStep = ({ onNext, onError, setLoading }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Create a preview URL
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      onError("Please select a file to upload");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("idCard", selectedFile);

      const response = await axios.post("http://localhost:5000/api/kyc/verify", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        onNext("ID card verified successfully!");
      }
    } catch (error) {
      console.error("Error uploading ID card:", error);
      onError(error.response?.data?.message || "Failed to verify ID card");
    } finally {
      setLoading(false);
    }
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
      <h2 className="text-xl font-semibold mb-2">Step 2: Upload ID Card</h2>
      <p className="text-gray-600 mb-4">
        Please upload a clear photo of your ID card. Make sure all information is visible and not blurry.
      </p>

      <div className="mt-4">
        {previewUrl && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Preview:</p>
            <div className="relative w-full max-w-md mx-auto border border-gray-300 rounded-lg overflow-hidden">
              <img 
                src={previewUrl} 
                alt="ID Card Preview" 
                className="w-full h-auto" 
              />
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center w-full">
          <label htmlFor="id-card-upload" className="w-full">
            <div className={`flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 ${
              previewUrl ? 'border-green-300 bg-green-50 hover:bg-green-100' : ''
            }`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (MAX. 5MB)</p>
                {previewUrl && <p className="mt-2 text-sm text-green-600">File selected!</p>}
              </div>
            </div>
          </label>
          <input
            id="id-card-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="mt-4">
          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              !selectedFile && "opacity-50 cursor-not-allowed"
            }`}
          >
            Upload ID Card
          </button>
        </div>
      </div>
    </div>
  );
};

export default IDCardUploadStep; 