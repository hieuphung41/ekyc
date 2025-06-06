import { useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { verifyTransactionVoice } from "./transactionSlice";
import { toast } from "react-toastify";

const VoiceVerification = ({ transactionId, onSuccess }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioChunksRef = useRef([]);
  const verificationText = "please verify this transaction";
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create a single blob from all chunks
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([audioBlob], "voice.webm", { type: "audio/webm" });
        setRecordedAudio(file);
      };

      // Start recording without timeslice to get the complete audio
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Error accessing microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Request the final data chunk
      mediaRecorderRef.current.requestData();
      // Stop recording
      mediaRecorderRef.current.stop();
      // Stop all tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const handleVoiceVerification = async () => {
    if (!transactionId || !recordedAudio) {
      toast.error("Missing required data");
      return;
    }

    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("voiceSample", recordedAudio);
      formData.append("text", verificationText);

      const response = await dispatch(
        verifyTransactionVoice({
          transactionId,
          formData,
        })
      ).unwrap();
      
      toast.success("Voice verification successful");
      onSuccess(response.data.isVerified);
    } catch (error) {
      console.error("Voice verification failed:", error);
      const errorMessage = error?.message || error?.toString() || "Voice verification failed";
      
      if (errorMessage.toLowerCase().includes("kyc data not found")) {
        toast.error("Please complete KYC verification first");
        navigate("/kyc");
      } else if (errorMessage.toLowerCase().includes("expired")) {
        toast.error("Transaction has expired");
        navigate("/");
      } else {
        toast.error("Voice verification failed. Please try again.");
        setRecordedAudio(null);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Voice Verification</h3>
      <p className="text-sm text-gray-500">
        Please read the following text clearly:
      </p>
      <p className="text-lg font-medium text-gray-900">{verificationText}</p>
      <div className="space-y-4">
        {!recordedAudio ? (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isRecording ? "Stop Recording" : "Start Recording"}
          </button>
        ) : (
          <div className="space-y-4">
            <audio src={URL.createObjectURL(recordedAudio)} controls className="w-full" />
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setRecordedAudio(null);
                  audioChunksRef.current = [];
                }}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Record Again
              </button>
              <button
                onClick={handleVoiceVerification}
                disabled={isProcessing}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Verify Voice"}
              </button>
            </div>
          </div>
        )}
        {isRecording && (
          <div className="text-center">
            <div className="animate-pulse text-sm text-indigo-600">
              Recording in progress...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceVerification;
