import axiosInstance from './axios';

export const checkAuthStatus = async () => {
  try {
    const response = await axiosInstance.get('/users/profile');
    return response.data.data;
  } catch (error) {
    return null;
  }
}; 