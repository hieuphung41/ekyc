import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/solid";

const VideoVerificationStep = ({ onComplete, onError, setLoading }) => {
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");

  // Liveness challenge states
  const [livnessChallengeId, setLivenessChallengeId] = useState(null);
  const [livenessActions, setLivenessActions] = useState([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [completedActions, setCompletedActions] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const actionTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
      clearActionTimer();
      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl);
      }
    };
  }, []);

  const clearActionTimer = () => {
    if (actionTimerRef.current) {
      clearInterval(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  };

  const fetchLivenessChallenge = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://localhost:5000/api/kyc/liveness-challenge",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        const { challengeId, actions } = response.data.data;
        setLivenessChallengeId(challengeId);
        setLivenessActions(actions);
        setCurrentActionIndex(0);
        setCompletedActions([]);
      }
    } catch (error) {
      console.error("Error fetching liveness challenge:", error);
      onError("Failed to get liveness challenge. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      setLoading(true);

      // Reset recording state
      setRecordedChunks([]);
      setRecordingSeconds(0);
      setRecordingComplete(false);
      setCurrentActionIndex(0);
      setCompletedActions([]);

      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl);
        setRecordingPreviewUrl("");
      }

      // Fetch liveness challenge
      await fetchLivenessChallenge();

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

      // Start the video
      await videoRef.current.play();

      // Determine supported mime types for video recording
      let mimeType = "video/webm;codecs=vp9";
      const supportedMimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
        "video/mp4",
      ];

      // Find the first supported mime type
      for (const type of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Create recorder with supported mime type
      const options = { mimeType };

      try {
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;

        // Set up data handlers
        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };

        // Start recording after a short delay to allow video to initialize
        setTimeout(() => {
          mediaRecorder.start(1000); // Collect data every second
          setIsRecording(true);
          setLoading(false);

          // Set up timer
          timerRef.current = setInterval(() => {
            setRecordingSeconds((prev) => {
              const newValue = prev + 1;

              // Stop after 20 seconds or if all actions completed
              if (newValue >= 20) {
                stopRecording();
              }

              return newValue;
            });
          }, 1000);

          // Start the action sequence timer
          startActionSequence();
        }, 500);
      } catch (err) {
        console.error("MediaRecorder error:", err);
        onError(
          `MediaRecorder error: ${err.message}. Please try a different browser.`
        );
        setLoading(false);

        // Clean up stream in case of error
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      onError(
        "Failed to start video recording. Please check camera permissions."
      );
      setLoading(false);
    }
  };

  const startActionSequence = () => {
    // Clear any existing timer
    clearActionTimer();

    // Set a 5-second interval for each action
    actionTimerRef.current = setInterval(() => {
      setCurrentActionIndex((prevIndex) => {
        // If we've completed all actions, stop the interval
        if (prevIndex >= livenessActions.length) {
          clearActionTimer();
          return prevIndex;
        }

        // Add the current action to completed actions
        setCompletedActions((prev) => [
          ...prev,
          livenessActions[prevIndex].action,
        ]);

        // Move to the next action
        return prevIndex + 1;
      });
    }, 5000); // Each action takes 5 seconds
  };

  const stopRecording = () => {
    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    clearActionTimer();

    // Stop media recorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Generate preview if we have chunks
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordingPreviewUrl(url);
      setRecordingComplete(true);
    }

    setIsRecording(false);
  };

  const submitVerification = async () => {
    if (!idNumber || !idType) {
      onError("Please fill in all required fields");
      return;
    }

    if (recordedChunks.length === 0) {
      onError("Please record a verification video");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("idNumber", idNumber);
      formData.append("idType", idType);

      // Create video blob and append to form with explicit mime type
      // Using video/webm is more compatible with most browsers
      const videoBlob = new Blob(recordedChunks, {
        type: "video/webm",
      });

      // Add file extension to filename to help server identify it as video
      formData.append("faceVideo", videoBlob, "face_verification.webm");

      // Add the liveness challenge ID and completed actions
      if (livnessChallengeId) {
        formData.append("challengeId", livnessChallengeId);
        formData.append("completedActions", JSON.stringify(completedActions));
      }

      const response = await axios.post(
        "http://localhost:5000/api/kyc/submit",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        onComplete();
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      // Show the exact error message to help debugging
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to complete verification";
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentAction = () => {
    if (
      !livenessActions.length ||
      currentActionIndex >= livenessActions.length
    ) {
      return null;
    }
    return livenessActions[currentActionIndex];
  };

  const renderActionInstructions = () => {
    const currentAction = getCurrentAction();

    if (!currentAction) {
      if (completedActions.length >= livenessActions.length) {
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded mb-4">
            <div className="flex">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
              <p>All actions completed! You can now stop recording.</p>
            </div>
          </div>
        );
      }
      return null;
    }

    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded mb-4 animate-pulse">
        <div className="flex items-center">
          <div className="mr-2 bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
            {currentActionIndex + 1}
          </div>
          <p className="font-semibold">{currentAction.text}</p>
        </div>
        <div className="mt-1 ml-8">
          <p className="text-sm">
            Time remaining: {5 - (recordingSeconds % 5)} seconds
          </p>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 3: Record Face Video</h2>
      <p className="text-gray-600 mb-4">
        Please record a short video of your face while following the on-screen
        instructions. This helps us verify your identity and ensure you're a
        real person.
      </p>

      <div className="max-w-2xl mx-auto mb-8">
        <div
          className="relative bg-gray-100 rounded-lg overflow-hidden"
          style={{ minHeight: "400px" }}
        >
          {isRecording && (
            <div className="absolute top-4 right-4 bg-red-600 text-white px-3 py-1 rounded-full z-10 flex items-center">
              <div className="w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></div>
              Recording: {recordingSeconds}s
            </div>
          )}

          {recordingPreviewUrl ? (
            <video
              src={recordingPreviewUrl}
              className="w-full h-full object-cover"
              controls
            />
          ) : (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
          )}

          {isRecording && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-black bg-opacity-70">
              {renderActionInstructions()}
            </div>
          )}
        </div>

        {isRecording && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Progress
              </span>
              <span className="text-sm text-gray-500">
                {completedActions.length} / {livenessActions.length} actions
                completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{
                  width: `${
                    livenessActions.length
                      ? (completedActions.length / livenessActions.length) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          {!isRecording && !recordingComplete ? (
            <button
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={startRecording}
            >
              Start Recording
            </button>
          ) : isRecording ? (
            <button
              className="w-full py-2 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              onClick={stopRecording}
            >
              Stop Recording ({Math.max(0, 20 - recordingSeconds)}s)
            </button>
          ) : (
            <button
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
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
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your ID number"
          />
        </div>

        <button
          className={`w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
            (recordedChunks.length === 0 || !idNumber || !idType) &&
            "opacity-50 cursor-not-allowed"
          }`}
          onClick={submitVerification}
          disabled={recordedChunks.length === 0 || !idNumber || !idType}
        >
          Complete Verification
        </button>
      </div>
    </div>
  );
};

export default VideoVerificationStep;
