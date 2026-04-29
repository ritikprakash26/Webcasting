import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_URL || 'https://pulse-video-upload-and-streaming.onrender.com';

// Normalize base URL so we don't end up with /api/api/... if env already contains /api
API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
API_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me')
};

// Video API
export const videoAPI = {
  getAll: (params) => api.get('/api/videos', { params }),
  getById: (id) => api.get(`/api/videos/${id}`),
  upload: (formData, onUploadProgress) => {
    return api.post('/api/videos/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onUploadProgress(percentCompleted);
        }
      }
    });
  },
  update: (id, data) => api.put(`/api/videos/${id}`, data),
  delete: (id) => api.delete(`/api/videos/${id}`),
  stream: (videoId) => `${API_BASE_URL}/api/videos/stream/${videoId}`
};

// User API (Admin only)
export const userAPI = {
  getAll: () => api.get('/api/users'),
  getById: (id) => api.get(`/api/users/${id}`),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`)
};

export default api;
