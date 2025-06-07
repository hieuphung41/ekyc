import React, { useState, useRef, useEffect } from 'react';
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
  const startTimeRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);

  // Text to be spoken by the user
  const expectedText = "hello and goodbye";

  const convertToWav = async (webmBlob) => {
    try {
      // Create audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      // Convert blob to array buffer
      const arrayBuffer = await webmBlob.arrayBuffer();
      
      // Decode the audio data
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Create a new audio buffer for WAV
      const wavBuffer = audioContext.createBuffer(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      // Copy the audio data
      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        wavBuffer.copyToChannel(audioBuffer.getChannelData(channel), channel);
      }
      
      // Convert to WAV format
      const wavBlob = await new Promise((resolve) => {
        const wavData = audioBufferToWav(wavBuffer);
        resolve(new Blob([wavData], { type: 'audio/wav' }));
      });
      
      return wavBlob;
    } catch (error) {
      console.error('Error converting to WAV:', error);
      throw new Error('Failed to convert audio format');
    }
  };

  // Helper function to convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer) => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * numChannels * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const offset = 44;
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    let pos = 0;
    while (pos < buffer.length) {
      for (let i = 0; i < numChannels; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i][pos]));
        const value = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (pos * blockAlign) + (i * bytesPerSample), value, true);
      }
      pos++;
    }
    
    return arrayBuffer;
  };

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
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

      mediaRecorder.onstop = async () => {
        const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        try {
          const wavBlob = await convertToWav(webmBlob);
          setAudioBlob(wavBlob);
        } catch (error) {
          console.error('Error converting audio:', error);
          onError('Failed to process audio recording');
        }
      };

      // Start recording with 1-second timeslices
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      // Start timer using requestAnimationFrame for smoother updates
      const updateTimer = () => {
        if (!isRecording) return;
        
        const elapsedTime = Math.floor((Date.now() - startTimeRef.current) / 1000);
        if (elapsedTime >= 30) { // Stop recording after 30 seconds
          stopRecording();
          return;
        }
        
        setRecordingTime(elapsedTime);
        timerRef.current = requestAnimationFrame(updateTimer);
      };
      
      timerRef.current = requestAnimationFrame(updateTimer);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      onError('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      cancelAnimationFrame(timerRef.current);
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      onError('Please record your voice first');
      return;
    }

    try {
      // Create a File object from the Blob
      const audioFile = new File([audioBlob], 'recording.wav', {
        type: 'audio/wav'
      });

      const formData = new FormData();
      formData.append('audioFile', audioFile);
      formData.append('expectedText', expectedText);

      const result = await dispatch(processVoiceVerification(formData)).unwrap();
      
      if (result.success) {
        if (result.isMatch) {
          if (result.isFirstRecording) {
            // For first recording, show success message and stay on the same step
            onError('Voice template created successfully. Please record again to verify.');
            setAudioBlob(null); // Clear the recording to allow another one
          } else {
            // For verification attempt, proceed to next step
            onNext();
          }
        } else {
          // If voice doesn't match, show error and stay on the same step
          onError(`Voice verification failed. Please try again and make sure to speak clearly. Expected: "${expectedText}"`);
          setAudioBlob(null); // Clear the recording to allow another attempt
        }
      } else {
        onError(result.message || 'Voice verification failed');
        setAudioBlob(null); // Clear the recording on error
      }
    } catch (error) {
      onError(error.message || 'Voice verification failed');
      setAudioBlob(null); // Clear the recording on error
    }
  };

  // Add cleanup for audio context and recorder
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && isRecording) {
        stopRecording();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [isRecording]);

  // Add cleanup for audio blob
  useEffect(() => {
    return () => {
      if (audioBlob) {
        setAudioBlob(null);
      }
    };
  }, []);

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