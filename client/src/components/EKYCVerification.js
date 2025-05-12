import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as faceapi from "face-api.js";
import Tesseract from "tesseract.js";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext";
import {
  Button,
  Card,
  Typography,
  Box,
  CircularProgress,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(3),
  maxWidth: 800,
  margin: "0 auto",
  marginTop: theme.spacing(4),
}));

const VideoContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  width: "100%",
  maxWidth: 640,
  margin: "0 auto",
  "& video": {
    width: "100%",
    borderRadius: theme.shape.borderRadius,
  },
  "& canvas": {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
}));

const EKYCVerification = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idType, setIdType] = useState("");
  const [ocrResult, setOcrResult] = useState("");
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const faceDetectionInterval = useRef(null);

  useEffect(() => {
    loadModels();
    return () => {
      stopCamera();
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
      setIsModelLoading(false);
    } catch (error) {
      console.error("Error loading models:", error);
      setError("Failed to load face detection models");
      setIsModelLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraActive(true);
        startFaceDetection();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setError(
        "Failed to access camera. Please ensure you have granted camera permissions."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (faceDetectionInterval.current) {
      clearInterval(faceDetectionInterval.current);
      faceDetectionInterval.current = null;
    }
    setIsCameraActive(false);
    setIsFaceDetected(false);
  };

  const startFaceDetection = () => {
    faceDetectionInterval.current = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks();

        const canvas = canvasRef.current;
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        };
        faceapi.matchDimensions(canvas, displaySize);

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        setIsFaceDetected(detections.length > 0);
      }
    }, 100);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const context = canvas.getContext("2d");
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.95)
      );
      const formData = new FormData();
      formData.append("faceImage", blob, "face.jpg");

      setLoading(true);
      const response = await axios.post(
        "http://localhost:3000/api/kyc/verify",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess("Face photo verified successfully!");
        setStep(2);
        stopCamera();
      }
    } catch (error) {
      console.error("Error uploading face photo:", error);
      setError(error.response?.data?.message || "Failed to verify face photo");
    } finally {
      setLoading(false);
    }
  };

  const handleIdCardUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("idCard", file);

      const response = await axios.post(
        "http://localhost:3000/api/kyc/verify",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess("ID card verified successfully!");
        setStep(3);
      }
    } catch (error) {
      console.error("Error uploading ID card:", error);
      setError(error.response?.data?.message || "Failed to verify ID card");
    } finally {
      setLoading(false);
    }
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsVideoRecording(true);

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "video/webm",
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setRecordedChunks((prev) => [...prev, event.data]);
          }
        };

        mediaRecorder.start();
        setTimeout(() => {
          mediaRecorder.stop();
          stopVideoRecording();
        }, 5000); // Record for 5 seconds
      }
    } catch (error) {
      console.error("Error starting video recording:", error);
      setError("Failed to start video recording");
    }
  };

  const stopVideoRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsVideoRecording(false);
  };

  const submitVerification = async () => {
    if (!idNumber || !idType) {
      setError("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("idNumber", idNumber);
      formData.append("idType", idType);

      if (recordedChunks.length > 0) {
        const videoBlob = new Blob(recordedChunks, { type: "video/webm" });
        formData.append("faceVideo", videoBlob, "face.webm");
      }

      const response = await axios.post(
        "http://localhost:3000/api/kyc/verify",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setSuccess("Verification completed successfully!");
        updateUser({ ...user, isVerified: true });
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Error submitting verification:", error);
      setError(
        error.response?.data?.message || "Failed to complete verification"
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 1: Take Face Photo
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Please take a clear photo of your face. Make sure your face is well-lit
        and centered in the frame.
      </Typography>

      <VideoContainer>
        {!isCameraActive ? (
          <Button
            variant="contained"
            onClick={startCamera}
            disabled={loading || isModelLoading}
            fullWidth
          >
            {isModelLoading ? "Loading Models..." : "Start Camera"}
          </Button>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: "100%", borderRadius: "8px" }}
            />
            <canvas ref={canvasRef} />
            <Box
              sx={{ mt: 2, display: "flex", gap: 2, justifyContent: "center" }}
            >
              <Button
                variant="contained"
                onClick={capturePhoto}
                disabled={!isFaceDetected || loading}
              >
                {loading ? "Processing..." : "Take Photo"}
              </Button>
              <Button
                variant="outlined"
                onClick={stopCamera}
                disabled={loading}
              >
                Stop Camera
              </Button>
            </Box>
          </>
        )}
      </VideoContainer>

      {!isFaceDetected && isCameraActive && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          No face detected. Please position your face in the frame.
        </Alert>
      )}
    </Box>
  );

  const renderStep2 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 2: Upload ID Card
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Please upload a clear photo of your ID card. Make sure all information
        is visible and not blurry.
      </Typography>

      <Box sx={{ mt: 2 }}>
        <input
          accept="image/*"
          style={{ display: "none" }}
          id="id-card-upload"
          type="file"
          onChange={handleIdCardUpload}
          disabled={loading}
        />
        <label htmlFor="id-card-upload">
          <Button
            variant="contained"
            component="span"
            disabled={loading}
            fullWidth
          >
            {loading ? "Uploading..." : "Upload ID Card"}
          </Button>
        </label>
      </Box>
    </Box>
  );

  const renderStep3 = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Step 3: Record Face Video
      </Typography>
      <Typography variant="body2" color="textSecondary" paragraph>
        Please record a short video of your face. The video will be 5 seconds
        long.
      </Typography>

      <VideoContainer>
        {!isVideoRecording ? (
          <Button
            variant="contained"
            onClick={startVideoRecording}
            disabled={loading}
            fullWidth
          >
            Start Recording
          </Button>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: "100%", borderRadius: "8px" }}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="textSecondary" align="center">
                Recording... Please look at the camera
              </Typography>
            </Box>
          </>
        )}
      </VideoContainer>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Enter ID Information
        </Typography>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>ID Type</InputLabel>
          <Select
            value={idType}
            onChange={(e) => setIdType(e.target.value)}
            label="ID Type"
            disabled={loading}
          >
            <MenuItem value="passport">Passport</MenuItem>
            <MenuItem value="national_id">National ID</MenuItem>
            <MenuItem value="drivers_license">Driver's License</MenuItem>
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label="ID Number"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />
        <Button
          variant="contained"
          onClick={submitVerification}
          disabled={loading || !idNumber || !idType}
          fullWidth
        >
          {loading ? "Submitting..." : "Submit Verification"}
        </Button>
      </Box>
    </Box>
  );

  return (
    <StyledCard>
      <Stepper activeStep={step - 1} sx={{ mb: 4 }}>
        <Step>
          <StepLabel>Face Photo</StepLabel>
        </Step>
        <Step>
          <StepLabel>ID Card</StepLabel>
        </Step>
        <Step>
          <StepLabel>Face Video</StepLabel>
        </Step>
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </StyledCard>
  );
};

export default EKYCVerification;
