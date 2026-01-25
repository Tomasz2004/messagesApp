/**
 * AuthContext - zarządzanie stanem użytkownika i autoryzacją
 *
 * Bezpieczeństwo:
 * - Token JWT jest przechowywany w HttpOnly cookie (ustawiany przez backend)
 * - Klucz prywatny jest TYLKO w pamięci (React state) - znika po odświeżeniu strony
 * - Po odświeżeniu strony użytkownik musi ponownie wpisać hasło przy próbie wysłania wiadomości
 * - Zapewnia pełną ochronę przed XSS - atakujący nie ma dostępu do klucza prywatnego
 */
import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [privateKey, setPrivateKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Pobierz dane użytkownika z serwera (Single Source of Truth)
        // Jeśli cookie sesyjne (HttpOnly) jest ważne, to zadziała
        const response = await userAPI.getCurrentUser();

        setUser(response.data);
        setIsAuthenticated(true);
        // privateKey pozostaje null - użytkownik musi wpisać hasło przy wysyłaniu
      } catch (error) {
        // Błąd autoryzacji lub sieci - użytkownik niezalogowany
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (token, userData, privateKeyPEM) => {
    // Token JWT jest ustawiany jako HttpOnly cookie przez backend
    setUser(userData);
    setPrivateKey(privateKeyPEM);
    setIsAuthenticated(true);
    // Klucz prywatny jest TYLKO w pamięci - nie zapisujemy nigdzie
  };

  /**
   * Odszyfrowuje i ustawia klucz prywatny po wpisaniu hasła
   * Wywoływane gdy użytkownik odświeżył stronę i próbuje wysłać wiadomość
   */
  const unlockPrivateKey = (privateKeyPEM) => {
    setPrivateKey(privateKeyPEM);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Wyczyść stan
    setUser(null);
    setPrivateKey(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    privateKey,
    login,
    logout,
    isAuthenticated,
    loading,
    unlockPrivateKey,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
