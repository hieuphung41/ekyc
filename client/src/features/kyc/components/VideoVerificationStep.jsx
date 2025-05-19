import React, { useState, useRef, useEffect } from "react";
import axiosInstance from "../../../utils/axios";
import * as faceapi from "face-api.js";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";

const VideoVerificationStep = ({ onComplete, onError, setLoading }) => {
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);

  const [livenessActions] = useState([
    { action: "center", text: "Keep your face centered in the oval" },
    { action: "left", text: "Turn your face to the left" },
    { action: "right", text: "Turn your face to the right" },
    { action: "up", text: "Look up" },
    { action: "down", text: "Look down" },
  ]);

  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [actionDetected, setActionDetected] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const faceDetectionInterval = useRef(null);

  useEffect(() => {
    loadModels();
    return () => {
      stopRecording();
      if (recordingPreviewUrl) URL.revokeObjectURL(recordingPreviewUrl);
    };
  }, []);

  const loadModels = async () => {
    try {
      setIsModelLoading(true);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      setModelsLoaded(true);
      setIsModelLoading(false);
    } catch (error) {
      console.error("Error loading face detection models:", error);
      onError("Failed to load face detection models");
      setIsModelLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      setLoading(true);
      setRecordedChunks([]);
      setRecordingComplete(false);
      setCurrentActionIndex(0);
      setCompletedActions([]);
      setActionDetected(false);

      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl);
        setRecordingPreviewUrl("");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      });

      videoRef.current.srcObject = stream;
      streamRef.current = stream;
      await videoRef.current.play();

      const mimeType = MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";
      const options = { mimeType };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          setRecordedChunks((prev) => [...prev, event.data]);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setLoading(false);
      startFaceDetection();
    } catch (error) {
      console.error("Error starting recording:", error);
      onError("Failed to start recording. Check camera/mic permissions.");
      setLoading(false);
    }
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) return;

    faceDetectionInterval.current = setInterval(async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks();

          const hasFaces = detections.length > 0;
          setFaceDetected(hasFaces);

          if (hasFaces && canvasRef.current) {
            const displaySize = {
              width: videoRef.current.videoWidth,
              height: videoRef.current.videoHeight,
            };

            faceapi.matchDimensions(canvasRef.current, displaySize);
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            const ctx = canvasRef.current.getContext("2d");
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            // Draw oval guide
            const centerX = canvasRef.current.width / 2;
            const centerY = canvasRef.current.height / 2;
            const radiusX = 120;
            const radiusY = 150;

            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();

            // Draw face landmarks
            faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);

            // Check current action and detect movement
            if (currentActionIndex < livenessActions.length) {
              const currentAction = livenessActions[currentActionIndex];
              const face = resizedDetections[0];
              
              if (face) {
                const landmarks = face.landmarks.positions;
                const nose = landmarks[30]; // Nose tip
                const leftEye = landmarks[36]; // Left eye
                const rightEye = landmarks[45]; // Right eye
                const mouth = landmarks[66]; // Mouth center

                let actionCompleted = false;

                switch (currentAction.action) {
                  case "center":
                    // Check if face is centered in oval
                    const distanceX = Math.abs(nose.x - centerX) / radiusX;
                    const distanceY = Math.abs(nose.y - centerY) / radiusY;
                    actionCompleted = distanceX * distanceX + distanceY * distanceY <= 0.8;
                    break;

                  case "left":
                    // Check if face is turned left (using eye positions)
                    actionCompleted = leftEye.x < rightEye.x - 30;
                    break;

                  case "right":
                    // Check if face is turned right (using eye positions)
                    actionCompleted = rightEye.x < leftEye.x - 30;
                    break;

                  case "up":
                    // Check if face is looking up (using nose position)
                    actionCompleted = nose.y < centerY - 30;
                    break;

                  case "down":
                    // Check if face is looking down (using nose position)
                    actionCompleted = nose.y > centerY + 30;
                    break;
                }

                if (actionCompleted && !actionDetected) {
                  setActionDetected(true);
                  setCompletedActions((prev) => [...prev, currentAction.action]);
                  setTimeout(() => {
                    setCurrentActionIndex((prev) => prev + 1);
                    setActionDetected(false);
                  }, 1000); // Wait 1 second before next action
                }
              }
            }
          }
        } catch (error) {
          console.error("Face detection error:", error);
        }
      }
    }, 100);
  };

  const stopRecording = () => {
    if (faceDetectionInterval.current) {
      clearInterval(faceDetectionInterval.current);
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordingPreviewUrl(url);
      setRecordingComplete(true);
    }

    setIsRecording(false);
  };

  const getCurrentAction = () => {
    if (currentActionIndex >= livenessActions.length) return null;
    return livenessActions[currentActionIndex];
  };

  const renderActionInstructions = () => {
    const currentAction = getCurrentAction();
    if (!currentAction) {
      return (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-4">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
            <p>All actions completed! You can now stop recording.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded mb-4 animate-pulse">
        <div className="flex items-center">
          <div className="mr-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
            {currentActionIndex + 1}
          </div>
          <p className="font-semibold">{currentAction.text}</p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 3: Record Face Video</h2>
      <p className="text-gray-600 mb-4">
        Please record a short video while keeping your face inside the oval.
      </p>

      <div className="max-w-2xl mx-auto mb-8">
        <div
          className="relative bg-gray-100 rounded-lg overflow-hidden"
          style={{ minHeight: "400px" }}
        >
          {recordingPreviewUrl ? (
            <video
              src={recordingPreviewUrl}
              className="w-full h-full object-cover"
              controls
            />
          ) : (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
              />
            </div>
          )}
          {isRecording && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-70">
              {renderActionInstructions()}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-500">
              {completedActions.length} / {livenessActions.length} actions
              completed
            </span>
          </div>
          <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{
                width: `${
                  (completedActions.length / livenessActions.length) * 100
                }%`,
              }}
            ></div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          {!isRecording && !recordingComplete ? (
            <button
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={startRecording}
            >
              Start Recording
            </button>
          ) : isRecording ? (
            <button
              className="w-full py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700"
              onClick={stopRecording}
            >
              Stop Recording
            </button>
          ) : (
            <button
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={startRecording}
            >
              Record Again
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Enter ID Information</h2>
        <div className="mb-4">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="id-type"
          >
            ID Type
          </label>
          <select
            id="id-type"
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select ID Type</option>
            <option value="passport">Passport</option>
            <option value="nationalId">National ID</option>
            <option value="drivingLicense">Driver's License</option>
          </select>
        </div>

        <div className="mb-6">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="id-number"
          >
            ID Number
          </label>
          <input
            id="id-number"
            type="text"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="Enter your ID number"
          />
        </div>

        <button
          className={`w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 ${
            (!recordedChunks.length || !idType || !idNumber) &&
            "opacity-50 cursor-not-allowed"
          }`}
          onClick={async () => {
            if (!recordedChunks.length || !idType || !idNumber) {
              onError("All fields are required and video must be recorded.");
              return;
            }
            try {
              setLoading(true);
              const formData = new FormData();
              formData.append("idNumber", idNumber);
              formData.append("idType", idType);
              const videoBlob = new Blob(recordedChunks, {
                type: "video/webm",
              });
              formData.append("faceVideo", videoBlob, "face_verification.webm");
              formData.append(
                "completedActions",
                JSON.stringify(completedActions)
              );
              await axiosInstance.post(
                "/kyc/submit",
                formData,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                  },
                }
              );
              onComplete();
            } catch (error) {
              onError(error.response?.data?.message || "Verification failed.");
            } finally {
              setLoading(false);
            }
          }}
          disabled={!recordedChunks.length || !idType || !idNumber}
        >
          Complete Verification
        </button>
      </div>
    </div>
  );
};

export default VideoVerificationStep;
