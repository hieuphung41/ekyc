import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/solid";
import { uploadVideo } from "../kycSlice";
import { checkDeviceAvailability } from "../../../utils/deviceCheck";

const VideoVerificationStep = ({ onComplete, onError }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.kyc);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    camera: true,
    microphone: true
  });
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");
  const [recordingTime, setRecordingTime] = useState(0);
  const [idCardImage, setIdCardImage] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    checkDeviceAvailability().then(devices => {
      setDeviceStatus(devices);
      if (!devices.camera || !devices.microphone) {
        onError("Some required devices are not available. You can skip this step if needed.");
      }
    });

    return () => {
      stopRecording();
      if (recordingPreviewUrl) URL.revokeObjectURL(recordingPreviewUrl);
      if (idCardImage) URL.revokeObjectURL(idCardImage);
    };
  }, []);

  const startRecording = async () => {
    try {
      setRecordedChunks([]);
      setRecordingComplete(false);
      setRecordingTime(0);

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
      setIsCameraActive(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      onError("Failed to start recording. Check camera/mic permissions.");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
    setIsCameraActive(false);
  };

  const handleRetake = () => {
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl);
    }
    setRecordingPreviewUrl("");
    setRecordingComplete(false);
    setRecordedChunks([]);
    startRecording();
  };

  const handleUpload = async () => {
    if (!recordedChunks.length) {
      onError("No video to upload");
      return;
    }

    try {
      const formData = new FormData();
      const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
      formData.append("videoFile", videoBlob, "face_verification.webm");

      const result = await dispatch(uploadVideo(formData));
      if (!result.error) {
        onComplete();
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      onError(error.response?.data?.message || "Failed to upload video");
    }
  };

  const handleSkipStep = () => {
    onComplete("Video verification step skipped. Proceeding to completion.");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 3: Record Face Video</h2>
      <p className="text-gray-600 mb-4">
        Please record a short video of your face. Keep your face centered in the frame
        and ensure good lighting. The video should be at least 5 seconds long.
      </p>

      {(!deviceStatus.camera || !deviceStatus.microphone) && (
        <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
            <div>
              <p>Required devices not available:</p>
              <ul className="list-disc list-inside mt-1">
                {!deviceStatus.camera && <li>Camera</li>}
                {!deviceStatus.microphone && <li>Microphone</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto mb-8">
        {(!deviceStatus.camera || !deviceStatus.microphone) ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-4">
              You can skip this step and proceed with manual verification.
            </p>
            <button
              onClick={handleSkipStep}
              className="px-6 py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
            >
              Skip Video Verification
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: "400px" }}>
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
                  {isRecording && (
                    <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full">
                      {formatTime(recordingTime)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center space-x-4">
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
                <>
                  <button
                    className="w-full py-2 px-4 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    onClick={handleRetake}
                  >
                    Retake
                  </button>
                  <button
                    className="w-full py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
                    onClick={handleUpload}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Use Video"}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VideoVerificationStep;
