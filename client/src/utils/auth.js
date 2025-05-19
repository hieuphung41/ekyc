import axiosInstance from './axios';

export const checkAuthStatus = async () => {
  try {
    const response = await axiosInstance.get('/users/me');
    return response.data.data;
  } catch (error) {
    return null;
  }
}; 