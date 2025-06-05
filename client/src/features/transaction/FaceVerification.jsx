import { useState, useRef, useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { verifyTransactionFace } from "./transactionSlice";
import { toast } from "react-toastify";
import * as faceapi from "face-api.js";

const FaceVerification = ({ transactionId, onSuccess }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const MAX_RETRIES = 3;

  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setIsModelLoading(false);
      } catch (error) {
        console.error("Error loading face API models:", error);
        toast.error("Failed to load face verification models.");
        setIsModelLoading(false);
      }
    };
    loadModels();
  }, []);

  // Camera and face detection logic
  useEffect(() => {
    const videoElement = videoRef.current;
    const stream = streamRef.current;

    if (isCameraActive && videoElement && stream) {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(() => {
          startFaceDetection();
        }).catch(err => {
          console.error("Error playing video stream:", err);
          toast.error("Failed to display camera feed.");
          stopCamera();
        });
      };

      return () => {
        stopFaceDetection();
        if (videoElement) {
          videoElement.srcObject = null;
          videoElement.removeAttribute('src');
          videoElement.load();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
    }
  }, [isCameraActive]);

  const startCamera = async () => {
    if (isModelLoading) {
      toast.info("Loading face verification models...");
      return;
    }
    if (isCameraActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          facingMode: "user",
        },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Error accessing camera");
      setIsCameraActive(false);
      streamRef.current = null;
    }
  };

  const stopCamera = () => {
    setIsCameraActive(false);
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }

    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !isCameraActive) {
        return;
      }
      
      try {
        const detectionsWithLandmarks = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        if (!canvasRef.current) {
          stopFaceDetection();
          return;
        }

        const resizedDetections = faceapi.resizeResults(detectionsWithLandmarks, displaySize);
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (resizedDetections.length > 0) {
          setIsFaceDetected(true);
          const face = resizedDetections[0];
          const faceBox = face.detection.box;
          const centerX = faceBox.x + faceBox.width / 2;
          const centerY = faceBox.y + faceBox.height / 2;

          const targetX = videoRef.current.videoWidth / 2;
          const targetY = videoRef.current.videoHeight / 2;
          const distanceX = Math.abs(centerX - targetX) / (videoRef.current.videoWidth / 2);
          const distanceY = Math.abs(centerY - targetY) / (videoRef.current.videoHeight / 2);

          const isCentered = distanceX < 0.3 && distanceY < 0.3;
          setIsFaceCentered(isCentered);

          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
        } else {
          setIsFaceDetected(false);
          setIsFaceCentered(false);
        }
      } catch (error) {
        console.error("Error during face detection:", error);
      }
    }, 100);
  };

  const stopFaceDetection = () => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current && isCameraActive) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage({
            url: imageUrl,
            file: new File([blob], "face.jpg", { type: "image/jpeg" })
          });
          stopCamera();
          setIsPreviewMode(true);
        } else {
          toast.error("Failed to capture photo.");
        }
      }, "image/jpeg", 0.95);
    }
  };

  const retakePhoto = () => {
    if (capturedImage?.url) {
      URL.revokeObjectURL(capturedImage.url);
    }
    setCapturedImage(null);
    setIsPreviewMode(false);
    setIsCameraActive(false);
  };

  const handleFaceVerification = async () => {
    if (!transactionId || !capturedImage?.file) {
      toast.error("Missing required data");
      return;
    }

    try {
      const response = await dispatch(
        verifyTransactionFace({
          transactionId,
          faceImage: capturedImage.file,
        })
      ).unwrap();
      setRetryCount(0);
      toast.success("Face verification successful");
      if (capturedImage?.url) {
        URL.revokeObjectURL(capturedImage.url);
      }
      onSuccess(response.data.isVerified);
    } catch (error) {
      console.error("Face verification failed:", error);
      const errorMessage = error?.message || error?.toString() || "Face verification failed";
      
      if (errorMessage.toLowerCase().includes("kyc data not found")) {
        toast.error("Please complete KYC verification first");
        navigate("/kyc");
      } else if (errorMessage.toLowerCase().includes("expired")) {
        toast.error("Transaction has expired");
        navigate("/");
      } else {
        setRetryCount(prev => prev + 1);
        if (retryCount >= MAX_RETRIES - 1) {
          toast.error("Maximum retry attempts reached. Please try again later.");
          navigate("/");
        } else {
          toast.error(`Face verification failed. ${MAX_RETRIES - retryCount - 1} attempts remaining.`);
          retakePhoto();
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Face Verification</h3>
      {!isPreviewMode ? (
        <div className="relative">
          {!isCameraActive ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No camera active</h3>
              {isModelLoading && <p className="mt-1 text-sm text-gray-500">Loading face verification models...</p>}
              {!isModelLoading && (
                <p className="mt-1 text-sm text-gray-500">
                  Click the button below to start your camera
                </p>
              )}
              <div className="mt-6">
                <button
                  onClick={startCamera}
                  disabled={isModelLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isModelLoading ? "Loading Models..." : "Start Camera"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                />
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                  <div className="w-64 h-80 border-2 border-white rounded-full opacity-70"></div>
                </div>
              </div>
              <div className="mt-2 text-center">
                {isFaceDetected ? (
                  isFaceCentered ? (
                    <p className="text-green-600">Face detected and centered!</p>
                  ) : (
                    <p className="text-yellow-600">Face detected, please center it in the oval</p>
                  )
                ) : (
                  <p className="text-yellow-600">No face detected. Please ensure your face is clearly visible and centered.</p>
                )}
                <p className="text-sm text-gray-500">
                  Position your face within the frame.
                </p>
              </div>
              <button
                onClick={captureImage}
                disabled={!isFaceDetected || !isFaceCentered}
                className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Capture Photo
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
            <img
              src={capturedImage.url}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex space-x-4">
            <button
              onClick={retakePhoto}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Retake
            </button>
            <button
              onClick={handleFaceVerification}
              className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Confirm & Verify
            </button>
          </div>
        </div>
      )}
      {retryCount > 0 && !isPreviewMode && (
        <p className="mt-2 text-sm text-yellow-600">
          Attempt {retryCount + 1} of {MAX_RETRIES}
        </p>
      )}
    </div>
  );
};

export default FaceVerification; 