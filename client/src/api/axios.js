import axios from 'axios';

export const BASE_URL = 'https://api-node-backend-uu9f.onrender.com';

const API = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 20000 // 20 seconds
});

API.interceptors.request.use((config) => {
  const user = JSON.parse(localStorage.getItem('campusconnect_user') || 'null');
  if (user?.token) {
    config.headers.Authorization = `Bearer ${user.token}`;
  }
  return config;
});

export default API;
