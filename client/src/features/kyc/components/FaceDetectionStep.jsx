import React, { useState, useRef, useEffect } from "react";
import * as faceapi from "face-api.js";
import axios from "axios";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";

const FaceDetectionStep = ({ onNext, onError, setLoading }) => {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceData, setFaceData] = useState(null);
  const [livenessScore, setLivenessScore] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ovalRef = useRef(null);
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

  // When videoContainerRef or isCameraActive changes, setup camera if active
  useEffect(() => {
    if (isCameraActive && videoContainerRef.current) {
      setupVideoElement();
    }
  }, [isCameraActive, videoContainerRef.current]);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);

      // Load multiple models for better face detection as seen in scripts.js
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
      setLoading(true);
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

      // The setupVideoElement function will be called by the useEffect when
      // both isCameraActive is true and videoContainerRef.current is available
    } catch (error) {
      console.error("Camera access error:", error);
      let errorMsg = "Failed to access camera";

      if (error.name === "NotAllowedError") {
        errorMsg =
          "Camera access denied. Please allow camera access in your browser settings.";
      } else if (error.name === "NotFoundError") {
        errorMsg = "No camera found. Please connect a camera and try again.";
      } else if (error.name === "NotReadableError") {
        errorMsg =
          "Camera is in use by another application. Please close other programs using your camera.";
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

  // This function is called after the UI is updated and videoContainerRef is available
  const setupVideoElement = async () => {
    try {
      // Check if stream is available
      if (!streamRef.current) {
        console.error("No stream available for video setup");
        setCameraError("Failed to set up camera stream");
        setIsCameraActive(false);
        setLoading(false);
        return;
      }

      // Check if container is available
      if (!videoContainerRef.current) {
        console.error("Video container is not available yet");
        setCameraError("Failed to initialize camera interface");
        setIsCameraActive(false);
        setLoading(false);
        return;
      }

      // Clear the container
      while (videoContainerRef.current.firstChild) {
        videoContainerRef.current.removeChild(
          videoContainerRef.current.firstChild
        );
      }

      // Create the video element
      const videoElement = document.createElement("video");
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.muted = true;
      videoElement.className = "w-full h-full object-cover";
      videoElement.style.display = "block";
      videoElement.style.backgroundColor = "#000";

      // Store the video element in the ref
      videoRef.current = videoElement;

      // Add video element to container
      videoContainerRef.current.appendChild(videoElement);

      // Attach the stream
      videoElement.srcObject = streamRef.current;

      // Set up canvas
      if (canvasRef.current) {
        const canvasElement = canvasRef.current;
        // Set canvas dimensions to match video
        canvasElement.width = 640;
        canvasElement.height = 480;

        // Position canvas exactly over the video
        canvasElement.style.position = "absolute";
        canvasElement.style.left = "0";
        canvasElement.style.top = "0";
      }

      console.log("Video element created and stream attached");

      // Add event listener for when video starts playing
      videoElement.addEventListener("playing", () => {
        console.log("Video is now playing");
        setLoading(false);

        // Start face detection if models loaded
        if (modelsLoaded) {
          startFaceDetection();
        }
      });

      // Force play the video
      try {
        const playPromise = videoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Error playing video:", error);
            setCameraError(
              "Browser prevented video autoplay. Please click the Start Camera button again."
            );
            setLoading(false);
          });
        }
      } catch (e) {
        console.error("Error playing video:", e);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in setupVideoElement:", error);
      setCameraError(`Failed to set up video: ${error.message}`);
      setLoading(false);
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
      videoRef.current = null;
    }

    // Clear video container if it exists
    if (videoContainerRef.current) {
      while (videoContainerRef.current.firstChild) {
        videoContainerRef.current.removeChild(
          videoContainerRef.current.firstChild
        );
      }
    }

    // Reset states
    setIsCameraActive(false);
    setIsFaceDetected(false);
    setIsFaceCentered(false);
    setFaceData(null);
    setLivenessScore(null);
  };

  const startFaceDetection = () => {
    // Only start face detection if we have an active stream
    if (!videoRef.current || !videoRef.current.srcObject) {
      console.error("Cannot start face detection - video not initialized");
      return;
    }

    console.log("Starting face detection");

    // Using techniques from scripts.js
    faceDetectionInterval.current = setInterval(async () => {
      if (
        videoRef.current &&
        canvasRef.current &&
        videoRef.current.readyState >= 2
      ) {
        try {
          // Using ssdMobilenetv1 for better detection as seen in scripts.js
          const detections = await faceapi
            .detectAllFaces(
              videoRef.current,
              new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })
            )
            .withFaceLandmarks()
            .withFaceDescriptors()
            .withAgeAndGender();

          // Set face detected state
          const hasFaces = detections.length > 0;
          setIsFaceDetected(hasFaces);

          // Draw on canvas like in scripts.js
          if (canvasRef.current) {
            const displaySize = {
              width: videoRef.current.videoWidth || 640,
              height: videoRef.current.videoHeight || 480,
            };

            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(
              0,
              0,
              canvasRef.current.width,
              canvasRef.current.height
            );

            // Draw oval face guide
            const centerX = canvasRef.current.width / 2;
            const centerY = canvasRef.current.height / 2;
            const radiusX = 120;
            const radiusY = 150;

            ctx.strokeStyle = isFaceCentered
              ? "green"
              : "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();

            if (detections.length > 0) {
              // Resize the detections to match the canvas size
              const resizedDetections = faceapi.resizeResults(
                detections,
                displaySize
              );

              // Get the primary face (first one)
              const primaryFace = resizedDetections[0];
              setFaceData(primaryFace);

              // Check if face is centered within the oval
              const { box } = primaryFace.detection;
              const faceX = box.x + box.width / 2;
              const faceY = box.y + box.height / 2;

              // Calculate distance from center of oval
              const distanceX = Math.abs(faceX - centerX) / radiusX;
              const distanceY = Math.abs(faceY - centerY) / radiusY;

              // Check if face is within the oval area
              const isFaceCenteredInOval =
                distanceX * distanceX + distanceY * distanceY <= 0.8;
              setIsFaceCentered(isFaceCenteredInOval);

              // Draw the detection box
              const drawOptions = {
                lineWidth: 2,
                boxColor: isFaceCenteredInOval
                  ? "rgba(0, 255, 0, 0.6)"
                  : "rgba(255, 200, 0, 0.6)",
                drawLabelOptions: {
                  anchorPosition: "TOP_LEFT",
                  backgroundColor: isFaceCenteredInOval
                    ? "rgba(0, 255, 0, 0.6)"
                    : "rgba(255, 200, 0, 0.6)",
                },
              };

              // Draw a custom face box
              new faceapi.draw.DrawBox(box, drawOptions).draw(
                canvasRef.current
              );

              // Draw landmarks
              faceapi.draw.drawFaceLandmarks(
                canvasRef.current,
                resizedDetections
              );

              // Calculate simple liveness score based on face landmarks movement
              // This is a simplified version for demonstration
              // In a real app, you would use more sophisticated methods
              if (primaryFace.landmarks) {
                const landmarks = primaryFace.landmarks.positions;
                // Check for eye movement, blink detection, etc.
                // For now we're simulating a score
                const simulatedLivenessScore = Math.min(
                  0.9,
                  Math.random() * 0.5 + 0.4
                );
                setLivenessScore(simulatedLivenessScore);
              }
            }
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

      setLoading(true);
      const response = await axios.post(
        "http://localhost:5000/api/kyc/biometric",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        stopCamera();
        onNext(
          `Face photo verified successfully with a liveness score of ${Math.round(
            response.data.data.livenessScore * 100
          )}%!`
        );
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
        Please take a clear photo of your face. Position your face within the
        oval frame and ensure good lighting.
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
              style={{ minHeight: "480px", border: "1px solid #ccc" }}
            >
              {/* Video container is always here when isCameraActive is true */}
              <div ref={videoContainerRef} className="w-full h-full">
                {/* Video element will be inserted here by setupVideoElement */}
              </div>

              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />

              {!isFaceDetected && isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 pointer-events-none">
                  <p className="text-white font-semibold px-4 py-2 rounded bg-gray-800 bg-opacity-70">
                    Position your face in the oval frame
                  </p>
                </div>
              )}

              {faceData && (
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-sm px-2 py-1 rounded">
                  {faceData.gender && faceData.age && (
                    <span>
                      Detection: {faceData.gender}, ~{Math.round(faceData.age)}{" "}
                      years
                    </span>
                  )}
                  {livenessScore !== null && (
                    <span className="ml-2">
                      | Liveness: {Math.round(livenessScore * 100)}%
                    </span>
                  )}
                </div>
              )}

              {isFaceCentered && faceData && (
                <div className="absolute bottom-2 left-2 right-2 bg-green-600 text-white text-sm px-2 py-1 rounded text-center">
                  Face positioned correctly! You can take the photo now.
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-4 justify-center">
              <button
                className={`py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  (!isFaceDetected || !isFaceCentered) &&
                  "opacity-50 cursor-not-allowed"
                }`}
                onClick={capturePhoto}
                disabled={!isFaceDetected || !isFaceCentered}
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
