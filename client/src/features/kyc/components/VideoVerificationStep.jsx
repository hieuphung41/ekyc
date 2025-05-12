import React, { useState, useRef, useEffect } from "react";
import axios from "axios";

const VideoVerificationStep = ({ onComplete, onError, setLoading }) => {
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopRecording();
      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setLoading(true);
      
      // Reset recording state
      setRecordedChunks([]);
      setRecordingSeconds(0);
      setRecordingComplete(false);
      
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

      // Start the video
      await videoRef.current.play();
      
      // Create recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });
      
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
          setRecordingSeconds(prev => {
            const newValue = prev + 1;
            
            // Stop after 5 seconds
            if (newValue >= 5) {
              stopRecording();
            }
            
            return newValue;
          });
        }, 1000);
      }, 500);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      onError("Failed to start video recording. Please check camera permissions.");
      setLoading(false);
    }
  };

  const stopRecording = () => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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

      // Create video blob and append to form
      const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
      formData.append("faceVideo", videoBlob, "face.webm");

      const response = await axios.post("http://localhost:5000/api/kyc/submit", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        onComplete();
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      onError(error.response?.data?.message || "Failed to complete verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Step 3: Record Face Video</h2>
      <p className="text-gray-600 mb-4">
        Please record a short video of your face. The video will be 5 seconds long.
      </p>

      <div className="max-w-2xl mx-auto mb-8">
        <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: "300px" }}>
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
        </div>
        
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
              Stop Recording ({5 - recordingSeconds}s)
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
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="id-type">
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
            <option value="national_id">National ID</option>
            <option value="drivers_license">Driver's License</option>
          </select>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="id-number">
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
            (recordedChunks.length === 0 || !idNumber || !idType) && "opacity-50 cursor-not-allowed"
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