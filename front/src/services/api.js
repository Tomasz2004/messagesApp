// API configuration - używa zmiennej środowiskowej lub domyślnie /api dla Dockera
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

import axios from 'axios';

/**
 * Odczytuje token CSRF z ciasteczka XSRF-TOKEN
 * Spring Security automatycznie ustawia to ciasteczko przy użyciu CookieCsrfTokenRepository
 */
const getCsrfToken = () => {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

/**
 * Cache dla promise pobierającego token CSRF
 * Zapobiega wielokrotnemu pobieraniu tokenu jednocześnie
 */
let csrfTokenPromise = null;

/**
 * Pobiera token CSRF z serwera jeśli jeszcze go nie ma
 */
const ensureCsrfToken = async () => {
  // Jeśli już mamy token w cookie, nie pobieraj ponownie
  if (getCsrfToken()) {
    return;
  }

  // Jeśli już trwa pobieranie, poczekaj na ten sam promise
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  // Pobierz token z serwera
  csrfTokenPromise = axios
    .get(`${API_BASE_URL}/csrf`, { withCredentials: true })
    .then(() => {})
    .catch((err) => {
      csrfTokenPromise = null; // Reset przy błędzie
      throw err;
    });

  return csrfTokenPromise;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Wysyłaj cookies z każdym żądaniem (dla HttpOnly JWT cookie)
});

// Request interceptor - dodaj token CSRF do każdego żądania modyfikującego dane
api.interceptors.request.use(
  async (config) => {
    const needsCsrf = ['post', 'delete'].includes(config.method?.toLowerCase());

    if (needsCsrf) {
      // Wyjątki: login i register nie wymagają CSRF (są w ignoringRequestMatchers)
      const isAuthEndpoint =
        config.url?.includes('/auth/login') ||
        config.url?.includes('/auth/register');

      if (!isAuthEndpoint) {
        // Upewnij się, że mamy token CSRF
        await ensureCsrfToken();

        const csrfToken = getCsrfToken();
        if (csrfToken) {
          config.headers['X-XSRF-TOKEN'] = csrfToken;
        }
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - obsługa błędów autoryzacji i CSRF
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Obsługa 403 - możliwy problem z tokenem CSRF
    if (error.response?.status === 403 && !originalRequest._csrfRetry) {
      // Zaznacz, że już próbowaliśmy odświeżyć token (zapobiega pętli)
      originalRequest._csrfRetry = true;

      try {
        // Wymuś ponowne pobranie tokenu
        csrfTokenPromise = null;
        await ensureCsrfToken();

        const newToken = getCsrfToken();
        if (newToken) {
          originalRequest.headers['X-XSRF-TOKEN'] = newToken;
          return api(originalRequest);
        }
      } catch (retryError) {}
    }

    // Obsługa 401 - wygasły JWT lub brak autoryzacji
    if (error.response?.status === 401) {
      // Nie przekierowuj jeśli to błąd logowania/rejestracji
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register');

      if (!isAuthEndpoint) {
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
  getUserByUsername: (username) =>
    api.get(`/users/lookup?username=${encodeURIComponent(username)}`),
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
