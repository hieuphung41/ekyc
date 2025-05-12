import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

const FaceDetectionStep = ({ onNext, onError, setLoading }) => {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectionInterval = useRef(null);
  const videoContainerRef = useRef(null);

  useEffect(() => {
    // Try to load models on component mount
    loadModels();
    
    // Clean up on unmount
    return () => {
      stopCamera();
    };
  }, []);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);
      
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      
      console.log("Face detection model loaded successfully");
      setModelsLoaded(true);
      setIsModelLoading(false);
    } catch (error) {
      console.error("Error loading face detection models:", error);
      onError(`Failed to load face detection models: ${error.message}`);
      setIsModelLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError("");
      setLoading(true);
      
      // Stop any existing stream first
      stopCamera();
      
      console.log("Requesting camera access...");
      // Use simpler camera constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      console.log("Camera access granted, stream received:", stream.active);
      
      // Use direct ref access instead of getElementById
      const videoContainer = videoContainerRef.current;
      if (!videoContainer) {
        throw new Error("Video container reference is not available");
      }
      
      // Clear the container
      while (videoContainer.firstChild) {
        videoContainer.removeChild(videoContainer.firstChild);
      }
      
      // Create new video element
      const videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = 'w-full h-full object-cover';
      videoElement.style.display = 'block';
      videoElement.style.backgroundColor = '#000';
      
      // Attach the stream
      videoElement.srcObject = stream;
      videoContainer.appendChild(videoElement);
      
      // Update the ref
      videoRef.current = videoElement;
      streamRef.current = stream;
      
      // Set up canvas
      if (canvasRef.current) {
        const canvasElement = canvasRef.current;
        canvasElement.width = 640;
        canvasElement.height = 480;
      }
      
      console.log("Video element created and stream attached");
      
      // Set camera as active
      setIsCameraActive(true);
      setLoading(false);
      
      // Add event listener for when video starts playing
      videoElement.addEventListener('playing', () => {
        console.log("Video is now playing");
        
        // Start face detection if models loaded
        if (modelsLoaded) {
          startFaceDetection();
        }
      });
      
      // Force play the video
      try {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Error playing video:", error);
            setCameraError("Browser prevented video autoplay. Please click the Start Camera button again.");
          });
        }
      } catch (e) {
        console.error("Error playing video:", e);
      }
      
    } catch (error) {
      console.error("Camera access error:", error);
      let errorMsg = "Failed to access camera";
      
      if (error.name === "NotAllowedError") {
        errorMsg = "Camera access denied. Please allow camera access in your browser settings.";
      } else if (error.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera and try again.";
      } else if (error.name === "NotReadableError") {
        errorMsg = "Camera is in use by another application. Please close other programs using your camera.";
      } else if (error.name === "AbortError") {
        errorMsg = "Camera initialization was aborted. Please try again.";
      } else if (error.name === "TypeError") {
        errorMsg = "Camera API not available. Please use a modern browser.";
      } else {
        errorMsg = `Camera error: ${error.message || "Unknown error"}`;
      }
      
      setCameraError(errorMsg);
      setLoading(false);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera");
    
    // Stop stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear face detection interval
    if (faceDetectionInterval.current) {
      clearInterval(faceDetectionInterval.current);
      faceDetectionInterval.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Reset states
    setIsCameraActive(false);
    setIsFaceDetected(false);
  };

  const startFaceDetection = () => {
    // Only start face detection if we have an active stream
    if (!videoRef.current || !videoRef.current.srcObject) {
      console.error("Cannot start face detection - video not initialized");
      return;
    }
    
    console.log("Starting face detection");
    
    // Use a more generous interval to reduce CPU usage
    faceDetectionInterval.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
        try {
          const detections = await faceapi.detectAllFaces(
            videoRef.current, 
            new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
          );
          
          // Simply set face detected state - don't draw landmarks to save CPU
          setIsFaceDetected(detections.length > 0);
          
          // Draw bounding box
          if (canvasRef.current) {
            const displaySize = {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight
            };
            
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            
            if (detections.length > 0) {
              faceapi.matchDimensions(canvasRef.current, displaySize);
              const resizedDetections = faceapi.resizeResults(detections, displaySize);
              faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
            }
          }
        } catch (err) {
          console.error("Face detection error:", err);
        }
      }
    }, 200); // Slower interval of 200ms instead of 100ms
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      
      const context = canvas.getContext("2d");
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise((resolve) => 
        canvas.toBlob(resolve, "image/jpeg", 0.9)
      );
      
      if (!blob) {
        throw new Error("Failed to capture photo");
      }
      
      const formData = new FormData();
      formData.append("faceImage", blob, "face.jpg");

      setLoading(true);
      const response = await axios.post("http://localhost:5000/api/kyc/verify", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        stopCamera();
        onNext("Face photo verified successfully!");
      }
    } catch (error) {
      console.error("Error capturing or uploading face photo:", error);
      onError(error.response?.data?.message || "Failed to verify face photo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 1: Take Face Photo</h2>
      <p className="text-gray-600 mb-4">
        Please take a clear photo of your face. Make sure your face is well-lit and centered in the frame.
      </p>

      <div className="relative w-full max-w-2xl mx-auto">
        {!isCameraActive ? (
          <div>
            <button
              className={`w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isModelLoading && "opacity-50 cursor-not-allowed"
              }`}
              onClick={startCamera}
              disabled={isModelLoading}
            >
              {isModelLoading ? "Loading Models..." : "Start Camera"}
            </button>
            
            {cameraError && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                <div className="flex">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                  <span>{cameraError}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div 
              className="relative bg-gray-100 rounded-lg overflow-hidden" 
              style={{ minHeight: "300px", border: "1px solid #ccc" }}
            >
              {/* Use ref for video container instead of ID */}
              <div ref={videoContainerRef} className="w-full h-full">
                {/* Video element will be inserted here */}
              </div>
              
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
              />
              
              {!isFaceDetected && isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 pointer-events-none">
                  <p className="text-white font-semibold px-4 py-2 rounded bg-gray-800 bg-opacity-70">
                    Position your face in the frame
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-4 flex gap-4 justify-center">
              <button
                className={`py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  (!isFaceDetected) && "opacity-50 cursor-not-allowed"
                }`}
                onClick={capturePhoto}
                disabled={!isFaceDetected}
              >
                Take Photo
              </button>
              <button
                className="py-2 px-4 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                onClick={stopCamera}
              >
                Stop Camera
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FaceDetectionStep; 