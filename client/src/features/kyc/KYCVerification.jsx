import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as faceapi from 'face-api.js';
import { createWorker } from 'tesseract.js';

const KYCVerification = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    idNumber: '',
    idType: 'national_id',
    faceImage: null,
    idCardImage: null,
    faceVideo: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [faceDetection, setFaceDetection] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const canvasRef = useRef(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((state) => state.auth);

  useEffect(() => {
    loadFaceDetectionModels();
  }, []);

  const loadFaceDetectionModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    } catch (error) {
      console.error('Error loading face detection models:', error);
      setError('Failed to load face detection models');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Failed to access camera');
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
  };

  const startRecording = () => {
    if (!videoStream) return;

    const mediaRecorder = new MediaRecorder(videoStream);
    mediaRecorderRef.current = mediaRecorder;
    setRecordedChunks([]);

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks(prev => [...prev, event.data]);
      }
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      stopCamera();
    }
  };

  const handleFaceImageCapture = async (file) => {
    try {
      const image = await faceapi.bufferToImage(file);
      const detections = await faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setError('No face detected in the image. Please try again.');
        return false;
      }

      if (detections.length > 1) {
        setError('Multiple faces detected. Please ensure only one face is visible.');
        return false;
      }

      setFaceDetection(detections[0]);
      return true;
    } catch (error) {
      console.error('Face detection error:', error);
      setError('Failed to process face image');
      return false;
    }
  };

  const handleIdCardCapture = async (file) => {
    try {
      const worker = await createWorker();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      setOcrResult(text);
      
      // Extract ID number using regex (adjust pattern based on your ID format)
      const idPattern = /\b[A-Z0-9]{8,}\b/;
      const match = text.match(idPattern);
      
      if (match) {
        setFormData(prev => ({ ...prev, idNumber: match[0] }));
      }

      return true;
    } catch (error) {
      console.error('OCR error:', error);
      setError('Failed to process ID card image');
      return false;
    }
  };

  const handleChange = async (e) => {
    if (e.target.name === 'faceImage') {
      const file = e.target.files[0];
      if (await handleFaceImageCapture(file)) {
        setFormData(prev => ({ ...prev, faceImage: file }));
      }
    } else if (e.target.name === 'idCardImage') {
      const file = e.target.files[0];
      if (await handleIdCardCapture(file)) {
        setFormData(prev => ({ ...prev, idCardImage: file }));
      }
    } else {
      setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }
  };

  const handleNext = () => {
    setStep(prev => prev + 1);
    setError(null);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('idNumber', formData.idNumber);
      formDataToSend.append('idType', formData.idType);
      formDataToSend.append('faceImage', formData.faceImage);
      formDataToSend.append('idCardImage', formData.idCardImage);
      
      const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
      formDataToSend.append('faceVideo', videoBlob);

      const response = await axios.post('http://localhost:3000/api/kyc/verify', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Step 1: Take Face Photo</h3>
            <div className="flex flex-col items-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-md rounded-lg"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="mt-4">
                <input
                  type="file"
                  name="faceImage"
                  accept="image/*"
                  capture="user"
                  onChange={handleChange}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-indigo-50 file:text-indigo-700
                    hover:file:bg-indigo-100"
                />
              </div>
              {faceDetection && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ Face detected successfully
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Step 2: Take ID Card Photo</h3>
            <div>
              <label htmlFor="idType" className="block text-sm font-medium text-gray-700">
                ID Type
              </label>
              <select
                id="idType"
                name="idType"
                value={formData.idType}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
                <option value="drivers_license">Driver's License</option>
              </select>
            </div>
            <div>
              <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700">
                ID Number
              </label>
              <input
                id="idNumber"
                name="idNumber"
                type="text"
                required
                value={formData.idNumber}
                onChange={handleChange}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <input
                type="file"
                name="idCardImage"
                accept="image/*"
                capture="environment"
                onChange={handleChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
              />
            </div>
            {ocrResult && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                <p className="font-medium">Extracted Text:</p>
                <p className="text-gray-600">{ocrResult}</p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Step 3: Face Video Verification</h3>
            <div className="flex flex-col items-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-md rounded-lg"
              />
              <div className="mt-4 space-x-4">
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Start Camera
                </button>
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={!videoStream || recording}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Start Recording
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  disabled={!recording}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gray-600 hover:bg-gray-700"
                >
                  Stop Recording
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">KYC Verification</h2>
          <p className="mt-2 text-sm text-gray-600">
            Please follow the steps to complete your verification
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              Verification successful! Redirecting...
            </div>
          )}

          {renderStep()}

          <div className="flex justify-between">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? 'Verifying...' : 'Submit Verification'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default KYCVerification; 