// API configuration
const API_BASE_URL = 'http://localhost:8080/api';

// Axios instance
import axios from 'axios';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - dodaje token do każdego zapytania
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - obsługa błędów autoryzacji
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Nie przekierowuj jeśli to błąd logowania/rejestracji - pozwól komponentowi obsłużyć
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register');

      if (!isAuthEndpoint) {
        // Token wygasł lub jest nieprawidłowy - tylko dla chronionych zasobów
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('privateKey');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Auth endpoints
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getTotpSetup: () => api.get('/auth/totp/setup'),
  enableTotp: (totpCode) => api.post('/auth/totp/enable', { totpCode }),
  disableTotp: () => api.post('/auth/totp/disable'),
};

// User endpoints
export const userAPI = {
  getAllUsers: () => api.get('/users'),
  getUserById: (userId) => api.get(`/users/${userId}`),
  getCurrentUser: () => api.get('/users/me'),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
};

// Message endpoints
export const messageAPI = {
  sendMessage: (data) => api.post('/messages', data),
  getInbox: () => api.get('/messages/inbox'),
  getSentMessages: () => api.get('/messages/sent'),
  getMessageById: (messageId) => api.get(`/messages/${messageId}`),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
};

export default api;
