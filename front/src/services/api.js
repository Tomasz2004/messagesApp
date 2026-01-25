// API configuration - używa zmiennej środowiskowej lub domyślnie /api dla Dockera
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Axios instance
import axios from 'axios';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Wysyłaj cookies z każdym żądaniem (dla HttpOnly JWT cookie)
});

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
        // Token wygasł lub jest nieprawidłowy
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
  logout: () => api.post('/auth/logout'),
  getTotpSetup: () => api.get('/auth/totp/setup'),
  enableTotp: (totpCode) => api.post('/auth/totp/enable', { totpCode }),
  disableTotp: () => api.post('/auth/totp/disable'),
  getPrivateKey: () => api.get('/auth/private-key'),
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
  markAsRead: (messageId) => api.post(`/messages/${messageId}/read`),
  getUnreadCount: () => api.get('/messages/unread/count'),
};

export default api;
