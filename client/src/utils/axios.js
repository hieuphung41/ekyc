import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Enable sending cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

export default axiosInstance; 