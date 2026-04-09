import axios from 'axios';

const API_KEY_STORAGE_KEY = 'fm_api_key';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL ?? 'http://localhost:3001',
});

// Attach the API key from localStorage to every request
apiClient.interceptors.request.use((config) => {
  const key = localStorage.getItem(API_KEY_STORAGE_KEY);
  if (key) {
    config.headers['x-api-key'] = key;
  }
  return config;
});

export { API_KEY_STORAGE_KEY };
export default apiClient;
