import React, { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/solid';
import { processVoiceVerification } from '../kycSlice';

const VoiceVerificationStep = ({ onNext, onError }) => {
  const dispatch = useDispatch();
  const { loading, error } = useSelector((state) => state.kyc);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const timerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Text to be spoken by the user
  const expectedText = "My name is FPT and I confirm this is my voice";

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(audioBlob);
      };

      // Start recording with 1-second timeslices
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 30) { // Stop recording after 30 seconds
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onError('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      clearInterval(timerRef.current);
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      onError('Please record your voice first');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audioFile', audioBlob, 'recording.webm');
      formData.append('expectedText', expectedText);

      const result = await dispatch(processVoiceVerification(formData)).unwrap();
      
      if (result.success) {
        if (result.isFirstRecording) {
          // For first recording, show success message and stay on the same step
          onError('Voice template created successfully. Please record again to verify.');
          setAudioBlob(null); // Clear the recording to allow another one
        } else {
          // For verification attempt, check if it was successful
          if (result.completedSteps.voiceVerification?.completed) {
            onNext();
          } else {
            onError('Voice verification failed. Please try again.');
          }
        }
      } else {
        onError(result.message || 'Voice verification failed');
      }
    } catch (error) {
      onError(error.message || 'Voice verification failed');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Step 4: Voice Verification</h2>
        <p className="text-gray-600 mb-4">
          Please read the following text clearly into your microphone:
        </p>
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <p className="text-lg font-medium">{expectedText}</p>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-4">
        {!isRecording && !audioBlob && (
          <button
            onClick={startRecording}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <MicrophoneIcon className="h-5 w-5 mr-2" />
            Start Recording
          </button>
        )}

        {isRecording && (
          <div className="flex items-center space-x-4">
            <button
              onClick={stopRecording}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <StopIcon className="h-5 w-5 mr-2" />
              Stop Recording
            </button>
            <span className="text-gray-600">{formatTime(recordingTime)}</span>
          </div>
        )}

        {audioBlob && !isRecording && (
          <div className="space-y-4">
            <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setAudioBlob(null);
                  setRecordingTime(0);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Record Again
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Submit Recording'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="text-sm text-gray-500 text-center mt-4">
        <p>Make sure you're in a quiet environment and speak clearly.</p>
        <p>Maximum recording duration: 30 seconds</p>
      </div>
    </div>
  );
};

export default VoiceVerificationStep; 