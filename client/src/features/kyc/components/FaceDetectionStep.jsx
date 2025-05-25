import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import * as faceapi from "face-api.js";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ovalRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectionInterval = useRef(null);
  const videoContainerRef = useRef(null);

  useEffect(() => {
    // Check device availability on mount
    checkDeviceAvailability().then(devices => {
      setHasCamera(devices.camera);
      if (!devices.camera) {
        setCameraError("No camera detected. You can skip this step and proceed with document verification.");
      }
    });

    // Clean up on unmount
    return () => {
      stopCamera();
    };
  }, []);

  // When videoContainerRef or isCameraActive changes, setup camera if active
  useEffect(() => {
    if (isCameraActive && videoContainerRef.current) {
      setupVideoElement();
    }
  }, [isCameraActive, videoContainerRef.current]);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);

      // Load multiple models for better face detection
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        faceapi.nets.ageGenderNet.loadFromUri("/models"),
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
      setCameraError("");
      setFaceData(null);
      setLivenessScore(null);

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

    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().then(() => {
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
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    faceDetectionInterval.current = setInterval(async () => {
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        try {
          const detections = await faceapi.detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          ).withFaceLandmarks().withAgeAndGender();

          if (detections.length > 0) {
            const primaryFace = detections[0];
            setIsFaceDetected(true);

            // Check if face is centered
            const videoWidth = videoRef.current.videoWidth;
            const videoHeight = videoRef.current.videoHeight;
            const faceBox = primaryFace.detection.box;
            const centerX = faceBox.x + faceBox.width / 2;
            const centerY = faceBox.y + faceBox.height / 2;

            const isCentered = 
              centerX > videoWidth * 0.3 && 
              centerX < videoWidth * 0.7 && 
              centerY > videoHeight * 0.3 && 
              centerY < videoHeight * 0.7;

            setIsFaceCentered(isCentered);

            // Store face data for later use
            setFaceData({
              age: primaryFace.age,
              gender: primaryFace.gender,
              detection: primaryFace.detection,
              landmarks: primaryFace.landmarks
            });

            // Draw face detection results
            const canvas = canvasRef.current;
            const displaySize = { width: videoWidth, height: videoHeight };
            faceapi.matchDimensions(canvas, displaySize);

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

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

            // Calculate simple liveness score based on face landmarks movement
            if (primaryFace.landmarks) {
              const landmarks = primaryFace.landmarks.positions;
              // Check for eye movement, blink detection, etc.
              // For now we're simulating a score
              const simulatedLivenessScore = Math.min(0.9, Math.random() * 0.5 + 0.4);
              setLivenessScore(simulatedLivenessScore);
            }
          } else {
            setIsFaceDetected(false);
            setIsFaceCentered(false);
            setFaceData(null);
            setLivenessScore(null);
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

      const formData = new FormData();
      formData.append("file", blob, "face.jpg");
      formData.append("type", "face");

      // If we have face data, include it for improved verification
      if (faceData) {
        formData.append(
          "faceMetadata",
          JSON.stringify({
            age: faceData.age,
            gender: faceData.gender,
            confidence: faceData.detection ? faceData.detection.score : null,
            isCentered: isFaceCentered,
            livenessScore: livenessScore,
          })
        );
      }

      const result = await dispatch(uploadFacePhoto(formData));
      if (!result.error) {
        stopCamera();
        onNext(
          `Face photo verified successfully with a liveness score of ${Math.round(
            result.payload.livenessScore * 100
          )}%!`
        );
      }
    } catch (error) {
      console.error("Error capturing or uploading face photo:", error);
      onError(error.response?.data?.message || "Failed to verify face photo");
    }
  };

  const handleSkipStep = () => {
    // Simply call onNext to move to the next step
    onNext("Face verification step skipped. Proceeding to document verification.");
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 1: Take Face Photo</h2>
      <p className="text-gray-600 mb-4">
        Please take a clear photo of your face. Position your face within the
        oval frame and ensure good lighting.
      </p>

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

          {!isCameraActive && !isModelLoading && (
            <div className="text-center py-4">
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Start Camera
              </button>
            </div>
          )}

          {isCameraActive && (
            <div className="relative" ref={videoContainerRef}>
              <div className="relative w-full max-w-2xl mx-auto">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                />
                <div
                  ref={ovalRef}
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-80 border-2 border-white rounded-full opacity-50"
                ></div>
              </div>

              <div className="mt-4 text-center">
                {isFaceDetected ? (
                  isFaceCentered ? (
                    <p className="text-green-600">Face detected and centered!</p>
                  ) : (
                    <p className="text-yellow-600">Face detected, please center it in the oval</p>
                  )
                ) : (
                  <p className="text-red-600">No face detected</p>
                )}
              </div>

              <div className="mt-4 text-center">
                <button
                  onClick={capturePhoto}
                  disabled={!isFaceDetected || !isFaceCentered || loading}
                  className={`px-4 py-2 rounded-md text-white ${
                    isFaceDetected && isFaceCentered && !loading
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
    </div>
  );
};

export default FaceDetectionStep;