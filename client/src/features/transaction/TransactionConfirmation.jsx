import { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import {
  verifyTransactionFace,
  verifyTransactionVoice,
  getTransactionStatus,
  resetTransactionState,
} from "./transactionSlice";
import { getKYCStatus } from "../kyc/kycSlice";
import Layout from "../../layouts/Layout";
import { toast } from "react-toastify";
import * as faceapi from "face-api.js";

const TransactionConfirmation = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [verificationText, setVerificationText] = useState(
    "Please verify this transaction"
  );
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFaceCentered, setIsFaceCentered] = useState(false);
  const MAX_RETRIES = 3;

  const { currentTransaction, status, error, verificationStatus } = useSelector(
    (state) => state.transaction
  );
  const { user } = useSelector((state) => state.auth);
  const { biometricData, loading: kycLoading } = useSelector((state) => state.kyc);

  console.log(biometricData)

  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setIsModelLoading(false);
        console.log("Face API models loaded.");
      } catch (error) {
        console.error("Error loading face API models:", error);
        toast.error("Failed to load face verification models.");
        setIsModelLoading(false);
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        setIsLoading(true);
        try {
          // Fetch both transaction and KYC data
          await Promise.all([
            dispatch(getTransactionStatus(id)).unwrap(),
            dispatch(getKYCStatus()).unwrap()
          ]);
        } catch (error) {
          toast.error(error.message || "Failed to load data");
          navigate("/");
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      dispatch(resetTransactionState());
      stopCamera();
    };
  }, [dispatch, id, navigate]);

  useEffect(() => {
    if (error) {
      const errorMessage = error?.message || error?.toString() || "";
      if (errorMessage.toLowerCase().includes("expired")) {
        toast.error("Transaction has expired");
        navigate("/");
      } else if (errorMessage.toLowerCase().includes("kyc data not found")) {
        toast.error("Please complete KYC verification first");
        navigate("/kyc");
      } else {
        toast.error(errorMessage);
      }
    }
  }, [error, navigate]);

  // Effect to handle camera stream and face detection when camera is active and videoRef is available
  useEffect(() => {
    const videoElement = videoRef.current;
    const stream = streamRef.current;

    if (isCameraActive && videoElement && stream) {
      console.log("Attaching stream to video element and starting playback...");
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(() => {
          console.log("Video playback started. Starting face detection...");
          startFaceDetection();
        }).catch(err => {
          console.error("Error playing video stream:", err);
          toast.error("Failed to display camera feed.");
          stopCamera(); // Stop camera if playing fails
        });
      };

      // Cleanup function for this effect
      return () => {
        console.log("Cleaning up video stream and face detection.");
        stopFaceDetection(); // Stop the detection interval
        if (videoElement) {
          videoElement.srcObject = null;
          videoElement.removeAttribute('src');
          videoElement.load();
        }
        // Only stop stream tracks if the stream still exists in the ref
        if (streamRef.current) {
           streamRef.current.getTracks().forEach(track => track.stop());
           streamRef.current = null; // Clear streamRef after stopping tracks
        }
      };
    } else if (!isCameraActive && streamRef.current) { // Keep this block to explicitly stop stream if isCameraActive becomes false while stream exists
       console.log("isCameraActive is false, stopping stream tracks...");
       streamRef.current.getTracks().forEach(track => track.stop());
       streamRef.current = null; // Clear streamRef
    }

    // No cleanup needed if isCameraActive is false and no stream exists
    return () => {}; // Provide an empty cleanup function when the main condition is false

  }, [isCameraActive, videoRef.current, streamRef.current]); // Depend on isCameraActive, videoRef.current, and streamRef.current

  // Function to request camera access and set state
  const startCamera = async () => {
    console.log("Attempting to get camera stream...");
    if (isModelLoading) {
      toast.info("Loading face verification models...");
      return;
    }
    // If camera is already active, do nothing
    if (isCameraActive) {
        console.log("Camera is already active.");
        return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          facingMode: "user",
        },
      });
      console.log("Camera access granted, stream obtained.");
      streamRef.current = stream; // Store the stream in the ref
      setIsCameraActive(true); // Set state to activate camera view
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Error accessing camera");
      setIsCameraActive(false);
      streamRef.current = null;
    }
  };

  const stopCamera = () => {
    console.log("Stopping camera...");
    // Setting isCameraActive to false will trigger the useEffect cleanup
    setIsCameraActive(false);
    // No need to manually stop tracks here, useEffect cleanup handles it
    // streamRef.current = null; // useEffect cleanup handles clearing streamRef
  };

  const startFaceDetection = () => {
    if (!videoRef.current || !canvasRef.current) {
      console.error("Cannot start face detection: video or canvas ref is null.");
      return;
    }

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    // Clear any existing interval before starting a new one
    if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
    }

    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !isCameraActive) {
        return;
      }
      
      try {
         const detectionsWithLandmarks = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        // Ensure canvasRef.current is not null before proceeding with canvas operations
        if (!canvasRef.current) {
           console.log("Canvas ref is null, stopping detection interval.");
           stopFaceDetection(); // Stop the interval if canvas is gone
           return;
        }

        const resizedDetections = faceapi.resizeResults(detectionsWithLandmarks, displaySize);
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

        if (resizedDetections.length > 0) {
          setIsFaceDetected(true);

          // Check if face is centered (simple check)
          // Ensure videoRef.current is not null before accessing its properties
          if (videoRef.current) {
             const videoWidth = videoRef.current.videoWidth;
             const videoHeight = videoRef.current.videoHeight;
             const face = resizedDetections[0]; // Assume only one face for simplicity
             const faceBox = face.detection.box;
             const centerX = faceBox.x + faceBox.width / 2;
             const centerY = faceBox.y + faceBox.height / 2;

          const targetX = videoWidth / 2;
          const targetY = videoHeight / 2;
          const distanceX = Math.abs(centerX - targetX) / (videoWidth / 2);
          const distanceY = Math.abs(centerY - targetY) / (videoHeight / 2);

          const isCentered = distanceX < 0.3 && distanceY < 0.3; // Within 30% of center
          setIsFaceCentered(isCentered);

             // Draw detection, landmarks, and expressions
             faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
             faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
             faceapi.draw.drawFaceExpressions(canvasRef.current, resizedDetections);
          } else {
             // If videoRef is null, cannot determine centering or draw accurately
             setIsFaceDetected(false); // Consider face not detected for safety
             setIsFaceCentered(false);
          }

        } else {
          setIsFaceDetected(false);
          setIsFaceCentered(false); // Reset centered state if no face detected
        }
      } catch (error) {
         console.error("Error during face detection:", error);
         // Continue the interval even if one detection fails
      }
    }, 100); // Run detection every 100ms
  };

  const stopFaceDetection = () => {
    console.log("Stopping face detection interval.");
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
     // Also clear the canvas when stopping detection
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current && isCameraActive) { // Ensure video and canvas refs are available and camera is active
      console.log("Capturing image...");
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0);

      // Optional: Draw face detection results on the captured image as well
      // If you want the bounding box/landmarks on the captured image
      // const faceapiCanvas = canvasRef.current;
      // if (faceapiCanvas) {
      //   ctx.drawImage(faceapiCanvas, 0, 0, canvas.width, canvas.height);
      // }

      canvas.toBlob((blob) => {
        if (blob) {
          const imageUrl = URL.createObjectURL(blob);
          setCapturedImage({
            url: imageUrl,
            file: new File([blob], "face.jpg", { type: "image/jpeg" })
          });
          console.log("Image captured, showing preview.");
          stopCamera(); // Stop camera and detection after capturing
          setIsPreviewMode(true);
        } else {
           console.error("Failed to create blob from canvas.");
           toast.error("Failed to capture photo.");
        }
      }, "image/jpeg", 0.95);
    } else {
       console.error("Cannot capture image: camera is not active or video/canvas ref is null.");
       toast.error("Camera is not ready to capture.");
    }
  };

  const retakePhoto = () => {
    console.log("Retaking photo.");
    // Clean up previous captured image URL
    if (capturedImage?.url) {
        URL.revokeObjectURL(capturedImage.url);
    }
    setCapturedImage(null);
    setIsPreviewMode(false);
    // Set isCameraActive to false first to trigger useEffect cleanup, then start camera again
    setIsCameraActive(false);
    // startCamera() will be called by the button click after preview mode is off
  };

  const handleFaceVerification = async () => {
    if (!id) {
      toast.error("Transaction ID is missing");
      return;
    }

    if (!capturedImage?.file) {
      toast.error("No image captured");
      return;
    }

    console.log("Checking KYC status:", { isVerified: user?.isVerified, faceData: biometricData?.faceData });
    if (!user?.isVerified || !biometricData?.faceData) {
      toast.error("Please complete KYC verification first");
      navigate("/kyc");
      return;
    }

    console.log("Initiating face verification...");
    try {
      await dispatch(
        verifyTransactionFace({
          transactionId: id,
          faceImage: capturedImage.file,
        })
      ).unwrap();
      setStep(2);
      setRetryCount(0);
      toast.success("Face verification successful");
      console.log("Face verification successful, moving to step 2.");
       // Clean up captured image URL after successful verification
      if (capturedImage?.url) {
        URL.revokeObjectURL(capturedImage.url);
      }
    } catch (error) {
      console.error("Face verification failed:", error);
      const errorMessage = error?.message || error?.toString() || "Face verification failed";
      
      if (errorMessage.toLowerCase().includes("kyc data not found")) {
        toast.error("Please complete KYC verification first");
        navigate("/kyc");
      } else {
        setRetryCount(prev => prev + 1);
        if (retryCount >= MAX_RETRIES - 1) {
          toast.error("Maximum retry attempts reached. Please try again later.");
          navigate("/");
        } else {
          toast.error(`Face verification failed. ${MAX_RETRIES - retryCount - 1} attempts remaining.`);
          retakePhoto(); // Offer retake on verification failure
        }
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
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
        handleVoiceVerification(file);
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

  const handleVoiceVerification = async (file) => {
    if (!id) {
      toast.error("Transaction ID is missing");
      return;
    }

    try {
      await dispatch(
        verifyTransactionVoice({
          transactionId: id,
          voiceSample: file,
          text: verificationText,
        })
      ).unwrap();
      toast.success("Voice verification successful");
      navigate("/");
    } catch (error) {
      toast.error("Voice verification failed. Please try again.");
    }
  };

  const renderStep = () => {
    if (isLoading || kycLoading || isModelLoading || !currentTransaction) {
      return (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      );
    }

    console.log("Checking KYC status:", { isVerified: user?.isVerified, faceData: biometricData?.faceData });
    if (!user?.isVerified || !biometricData?.faceData) {
      return (
        <div className="text-center py-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  You need to complete KYC verification before proceeding with transaction verification.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate("/kyc")}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    Complete KYC Verification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">
              Face Verification
            </h3>
            {!isPreviewMode ? (
              <div className="relative">
                {!isCameraActive ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No camera active</h3>
                    {isModelLoading && <p className="mt-1 text-sm text-gray-500">Loading face verification models...</p>}
                    {!isModelLoading && (
                      <p className="mt-1 text-sm text-gray-500">
                        Click the button below to start your camera
                      </p>
                    )}
                    <div className="mt-6">
                      <button
                        onClick={startCamera}
                        disabled={isModelLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isModelLoading ? "Loading Models..." : "Start Camera"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ pointerEvents: 'none' }}
                      />
                      {/* Add the oval frame */}
                      <div className="absolute inset-0 flex justify-center items-center pointer-events-none">
                         <div className="w-64 h-80 border-2 border-white rounded-full opacity-70"></div>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                       {isFaceDetected ? (
                          isFaceCentered ? (
                             <p className="text-green-600">Face detected and centered!</p>
                          ) : (
                             <p className="text-yellow-600">Face detected, please center it in the oval</p>
                          )
                       ) : (
                          <p className="text-yellow-600">No face detected. Please ensure your face is clearly visible and centered.</p>
                       )}
                       <p className="text-sm text-gray-500">
                          Position your face within the frame.
                       </p>
                    </div>
                    <button
                      onClick={captureImage}
                      disabled={!isFaceDetected || !isFaceCentered || verificationStatus.face === "loading"}
                      className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                       {verificationStatus.face === "loading"
                        ? "Verifying..."
                        : "Capture Photo"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={capturedImage.url}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={retakePhoto}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Retake
                  </button>
                  <button
                    onClick={handleFaceVerification}
                    disabled={verificationStatus.face === "loading"}
                    className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {verificationStatus.face === "loading"
                      ? "Verifying..."
                      : "Confirm & Verify"}
                  </button>
                </div>
              </div>
            )}
            {retryCount > 0 && !isPreviewMode && (
              <p className="mt-2 text-sm text-yellow-600">
                Attempt {retryCount + 1} of {MAX_RETRIES}
              </p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">
              Voice Verification
            </h3>
            <p className="text-sm text-gray-500">
              Please read the following text clearly:
            </p>
            <p className="text-lg font-medium text-gray-900">
              {verificationText}
            </p>
            <div className="space-y-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={verificationStatus.voice === "loading"}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {verificationStatus.voice === "loading"
                  ? "Verifying..."
                  : isRecording
                  ? "Stop Recording"
                  : "Start Recording"}
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

      default:
        return null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </Layout>
    );
  }

  if (!currentTransaction) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Transaction Not Found
            </h2>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to 
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Transaction Verification
              </h2>
              {currentTransaction && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">
                        Transaction ID
                      </p>
                      <p className="mt-1 text-sm text-gray-900">
                        {currentTransaction.transactionId}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Amount</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {currentTransaction.amount} {currentTransaction.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Type</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {currentTransaction.type}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Status</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {currentTransaction.status}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {renderStep()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TransactionConfirmation;