import axios from "axios";

const API_URL = `https://ekyc-server.onrender.com/api`;

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Enable sending cookies
  headers: {
    "Content-Type": "application/json",
  },
});

export default axiosInstance;
