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
  const [recordedChunks, setRecordedChunks] = useState([]);
  const verificationText = "Please verify this transaction";
  const [recordedAudio, setRecordedAudio] = useState(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        setRecordedAudio(file);
        handleVoiceVerification();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordedChunks([]);
    } catch (error) {
      toast.error("Error accessing microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceVerification = async () => {
    if (!transactionId || !recordedAudio) {
      toast.error("Missing required data");
      return;
    }

    try {
      const response = await dispatch(
        verifyTransactionVoice({
          transactionId,
          voiceSample: recordedAudio,
          text: verificationText,
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
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
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
