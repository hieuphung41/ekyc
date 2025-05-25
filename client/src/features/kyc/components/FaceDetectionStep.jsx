import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as faceapi from "face-api.js";
import { ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { uploadFacePhoto } from "../kycSlice";
import { checkDeviceAvailability } from "../../../utils/deviceCheck";

const FaceDetectionStep = ({ onNext, onError }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.kyc);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceData, setFaceData] = useState(null);
  const [livenessScore, setLivenessScore] = useState(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [detectionTime, setDetectionTime] = useState(0);
  const [lastExpression, setLastExpression] = useState(null);
  const [expressionChanges, setExpressionChanges] = useState(0);
  const [hasPassedInitialCheck, setHasPassedInitialCheck] = useState(false);
  const [canTakePhoto, setCanTakePhoto] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isPhotoCaptured, setIsPhotoCaptured] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ovalRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectionInterval = useRef(null);
  const videoContainerRef = useRef(null);
  const detectionStartTime = useRef(null);

  useEffect(() => {
    // Check device availability on mount
    checkDeviceAvailability().then(devices => {
      setHasCamera(devices.camera);
      if (!devices.camera) {
        setCameraError("No camera detected. You can skip this step and proceed with document verification.");
      }
    });

    // Load models on mount
    loadModels();

    // Clean up on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // When videoContainerRef or isCameraActive changes, setup camera if active
  useEffect(() => {
    if (isCameraActive && videoContainerRef.current && modelsLoaded) {
      setupVideoElement();
    }
  }, [isCameraActive, videoContainerRef.current, modelsLoaded]);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);
      console.log("Starting to load face detection models...");

      // Load multiple models for better face detection
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.ageGenderNet.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);

      console.log("Face detection models loaded successfully");
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
      // Ensure models are loaded before starting camera
      if (!modelsLoaded) {
        console.log("Models not loaded yet, loading models first...");
        await loadModels();
      }

      setCameraError("");
      setFaceData(null);
      setLivenessScore(null);
      setDetectionTime(0);
      setExpressionChanges(0);
      setLastExpression(null);

      // Stop any existing stream first
      stopCamera();

      console.log("Requesting camera access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      console.log("Camera access granted, stream received:", stream.active);

      // Store the stream so we can use it once the UI is ready
      streamRef.current = stream;

      // First activate the camera UI
      setIsCameraActive(true);
    } catch (error) {
      console.error("Camera access error:", error);
      let errorMsg = "Failed to access camera";
      if (error.name === "NotAllowedError") {
        errorMsg = "Camera access was denied. Please allow camera access to continue.";
      } else if (error.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera and try again.";
      }
      setCameraError(errorMsg);
      onError(errorMsg);
    }
  };

  const setupVideoElement = () => {
    if (!videoRef.current || !streamRef.current) return;

    console.log("Setting up video element...");
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().then(() => {
      console.log("Video started playing, starting face detection...");
      startFaceDetection();
    }).catch(error => {
      console.error("Error playing video:", error);
      setCameraError("Failed to start video stream");
      onError("Failed to start video stream");
    });
  };

  const stopCamera = () => {
    if (faceDetectionInterval.current) {
      clearInterval(faceDetectionInterval.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraActive(false);
    setIsFaceDetected(false);
    setIsFaceCentered(false);
    setDetectionTime(0);
    detectionStartTime.current = null;
  };

  const calculateLivenessScore = (face, previousExpression) => {
    let score = 0;
    const weights = {
      expressionChange: 0.2,
      faceMovement: 0.2,
      detectionConfidence: 0.3,
      faceSize: 0.2,
      faceQuality: 0.1
    };

    // Expression change score
    if (previousExpression && face.expressions) {
      const currentExpression = Object.entries(face.expressions)
        .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
      
      if (currentExpression !== previousExpression) {
        score += weights.expressionChange;
      }
    }

    // Face movement score (based on landmarks)
    const landmarks = face.landmarks.positions;
    const nose = landmarks[30];
    const leftEye = landmarks[36];
    const rightEye = landmarks[45];
    const mouth = landmarks[66];
    
    // Check for natural face movement
    const eyeDistance = Math.abs(leftEye.x - rightEye.x);
    const faceSize = face.detection.box.width;
    const faceRatio = faceSize / videoRef.current.videoWidth;
    
    // Face size score - prefer faces that are not too close or too far
    if (faceRatio > 0.2 && faceRatio < 0.8) {
      score += weights.faceSize;
    }

    // Face quality score - check if face is well-lit and clear
    const faceBox = face.detection.box;
    const faceArea = faceBox.width * faceBox.height;
    const videoArea = videoRef.current.videoWidth * videoRef.current.videoHeight;
    const faceCoverage = faceArea / videoArea;
    
    // Ideal face coverage is between 15% and 40% of the frame
    if (faceCoverage > 0.15 && faceCoverage < 0.4) {
      score += weights.faceQuality;
    }

    // Detection confidence score - weighted more heavily
    score += face.detection.score * weights.detectionConfidence;

    // Boost score if face is well-centered
    const centerX = faceBox.x + faceBox.width / 2;
    const centerY = faceBox.y + faceBox.height / 2;
    const targetX = videoRef.current.videoWidth / 2;
    const targetY = videoRef.current.videoHeight / 2;
    const distanceX = Math.abs(centerX - targetX) / (videoRef.current.videoWidth / 2);
    const distanceY = Math.abs(centerY - targetY) / (videoRef.current.videoHeight / 2);
    
    if (distanceX < 0.2 && distanceY < 0.2) {
      score *= 1.2; // 20% boost for well-centered faces
    }

    return Math.min(1, score);
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Video or canvas reference not available");
      return;
    }

    console.log("Starting face detection interval...");
    faceDetectionInterval.current = setInterval(async () => {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        try {
          console.log("Attempting face detection...");
          const detections = await faceapi.detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 416 })
          ).withFaceLandmarks().withAgeAndGender().withFaceExpressions();

          console.log("Face detection results:", detections.length > 0 ? "Face detected" : "No face detected");
          
          if (detections.length > 0) {
            const primaryFace = detections[0];
            setIsFaceDetected(true);

            // Start detection timer if not started
            if (!detectionStartTime.current) {
              detectionStartTime.current = Date.now();
            }

            // Update detection time
            const currentDetectionTime = Math.floor((Date.now() - detectionStartTime.current) / 1000);
            setDetectionTime(currentDetectionTime);

            // Check if we've passed the initial 3-second check
            if (currentDetectionTime >= 3 && !hasPassedInitialCheck) {
              setHasPassedInitialCheck(true);
            }

            // Check if face is centered
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            const faceBox = primaryFace.detection.box;
            const centerX = faceBox.x + faceBox.width / 2;
            const centerY = faceBox.y + faceBox.height / 2;

            // Calculate distance from center
            const targetX = videoWidth / 2;
            const targetY = videoHeight / 2;
            const distanceX = Math.abs(centerX - targetX) / (videoWidth / 2);
            const distanceY = Math.abs(centerY - targetY) / (videoHeight / 2);

            // Face is centered if within 30% of the center
            const isCentered = distanceX < 0.3 && distanceY < 0.3;
            setIsFaceCentered(isCentered);

            // Calculate liveness score
            const currentLivenessScore = calculateLivenessScore(primaryFace, lastExpression);
            setLivenessScore(currentLivenessScore);

            // Update canTakePhoto state
            if (isCentered && currentLivenessScore >= 0.5) {
              setCanTakePhoto(true);
            } else {
              setCanTakePhoto(false);
            }

            // Track expression changes
            if (primaryFace.expressions) {
              const currentExpression = Object.entries(primaryFace.expressions)
                .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
              
              if (lastExpression && currentExpression !== lastExpression) {
                setExpressionChanges(prev => prev + 1);
              }
              setLastExpression(currentExpression);
            }

            // Store face data for later use
            setFaceData({
              age: primaryFace.age,
              gender: primaryFace.gender,
              detection: primaryFace.detection,
              landmarks: primaryFace.landmarks,
              expressions: primaryFace.expressions
            });

            // Draw face detection results
            const canvas = canvasRef.current;
            const displaySize = { width: videoWidth, height: videoHeight };
            faceapi.matchDimensions(canvas, displaySize);

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw face box
            const drawOptions = new faceapi.draw.DrawOptions({
              labelSize: 20,
              lineWidth: 2,
              boxColor: isCentered ? '#00ff00' : '#ff0000'
            });

            // Draw a custom face box
            new faceapi.draw.DrawBox(faceBox, drawOptions).draw(canvas);

            // Draw landmarks
            faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

            // Draw expressions
            faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
          } else {
            setIsFaceDetected(false);
            setIsFaceCentered(false);
            setFaceData(null);
            setLivenessScore(null);
            setDetectionTime(0);
            detectionStartTime.current = null;
            setHasPassedInitialCheck(false);
            setCanTakePhoto(false);

            // Clear canvas when no face is detected
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        } catch (err) {
          console.error("Face detection error:", err);
        }
      }
    }, 100); // Faster interval for better responsiveness
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

      // Create a preview URL for the captured photo
      const previewUrl = URL.createObjectURL(blob);
      setCapturedPhoto({ blob, previewUrl });
      setIsPhotoCaptured(true);
      stopCamera();

    } catch (error) {
      console.error("Error capturing photo:", error);
      onError("Failed to capture photo");
    }
  };

  const handleRetake = () => {
    if (capturedPhoto?.previewUrl) {
      URL.revokeObjectURL(capturedPhoto.previewUrl);
    }
    setCapturedPhoto(null);
    setIsPhotoCaptured(false);
    startCamera();
  };

  const handleUpload = async () => {
    if (!capturedPhoto?.blob) {
      onError("No photo to upload");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", capturedPhoto.blob, "face.jpg");
      formData.append("type", "face");

      // Include comprehensive face metadata
      if (faceData) {
        formData.append(
          "faceMetadata",
          JSON.stringify({
            age: faceData.age,
            gender: faceData.gender,
            confidence: faceData.detection ? faceData.detection.score : null,
            isCentered: isFaceCentered,
            livenessScore: livenessScore,
            detectionTime: detectionTime,
            expressionChanges: expressionChanges,
            expressions: faceData.expressions,
            landmarks: faceData.landmarks.positions.map(p => ({ x: p.x, y: p.y }))
          })
        );
      }

      const result = await dispatch(uploadFacePhoto(formData));
      if (!result.error) {
        // Clean up the preview URL
        if (capturedPhoto?.previewUrl) {
          URL.revokeObjectURL(capturedPhoto.previewUrl);
        }
        setIsUploadSuccess(true);
      }
    } catch (error) {
      console.error("Error uploading face photo:", error);
      onError(error.response?.data?.message || "Failed to verify face photo");
    }
  };

  const handleSkipStep = () => {
    onNext("Face verification step skipped. Proceeding to document verification.");
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (capturedPhoto?.previewUrl) {
        URL.revokeObjectURL(capturedPhoto.previewUrl);
      }
      stopCamera();
    };
  }, [capturedPhoto]);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 1: Take Face Photo</h2>
      <p className="text-gray-600 mb-4">
        Please take a clear photo of your face. Position your face within the
        oval frame and ensure good lighting. Keep your face steady for at least 3 seconds.
      </p>

      {isUploadSuccess ? (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-center">
            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
            <div>
              <h3 className="text-lg font-medium text-green-800">Face Verification Complete!</h3>
              <p className="text-green-700">Your face photo has been successfully verified.</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-4">
            <button
              onClick={() => {
                setIsUploadSuccess(false);
                setCapturedPhoto(null);
                setIsPhotoCaptured(false);
                startCamera();
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Back
            </button>
            <button
              onClick={() => onNext("Face photo verified successfully!")}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Next Step
            </button>
          </div>
        </div>
      ) : (
        <>
          {cameraError && (
            <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
                <span>{cameraError}</span>
              </div>
            </div>
          )}

          {!hasCamera && (
            <div className="mt-4">
              <button
                onClick={handleSkipStep}
                className="w-full py-2 px-4 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
              >
                Skip Face Verification
              </button>
              <p className="mt-2 text-sm text-gray-600">
                You can proceed with document verification and complete face verification later.
              </p>
            </div>
          )}

          {hasCamera && (
            <>
              {isModelLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading face detection models...</p>
                </div>
              )}

              {!isCameraActive && !isModelLoading && !isPhotoCaptured && (
                <div className="text-center py-4">
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Start Camera
                  </button>
                </div>
              )}

              {isPhotoCaptured ? (
                <div className="relative w-full max-w-2xl mx-auto">
                  <div className="relative">
                    <img
                      src={capturedPhoto.previewUrl}
                      alt="Captured face"
                      className="w-full rounded-lg"
                    />
                  </div>
                  <div className="mt-4 flex justify-center space-x-4">
                    <button
                      onClick={handleRetake}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Retake Photo
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={loading}
                      className={`px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                        loading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {loading ? "Processing..." : "Use Photo"}
                    </button>
                  </div>
                </div>
              ) : isCameraActive && (
                <div className="relative" ref={videoContainerRef}>
                  <div className="relative w-full max-w-2xl mx-auto">
                    <video
                      ref={videoRef}
                      className="w-full rounded-lg"
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: 'auto' }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 w-full h-full"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div
                      ref={ovalRef}
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white rounded-full opacity-50"
                      style={{ pointerEvents: 'none' }}
                    ></div>
                  </div>

                  <div className="mt-4 text-center">
                    {isFaceDetected ? (
                      isFaceCentered ? (
                        <p className="text-green-600">
                          Face detected and centered! {!hasPassedInitialCheck && detectionTime > 0 && `(${detectionTime}s)`}
                        </p>
                      ) : (
                        <p className="text-yellow-600">Face detected, please center it in the oval</p>
                      )
                    ) : (
                      <p className="text-red-600">No face detected</p>
                    )}
                    {livenessScore && !hasPassedInitialCheck && (
                      <p className="text-sm text-gray-600 mt-1">
                        Liveness Score: {Math.round(livenessScore * 100)}%
                      </p>
                    )}
                  </div>

                  <div className="mt-4 text-center">
                    <button
                      onClick={capturePhoto}
                      disabled={!canTakePhoto || loading}
                      className={`px-4 py-2 rounded-md text-white ${
                        canTakePhoto && !loading
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-400 cursor-not-allowed"
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500`}
                    >
                      {loading ? "Processing..." : "Capture Photo"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FaceDetectionStep;