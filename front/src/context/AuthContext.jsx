/**
 * AuthContext - zarządzanie stanem użytkownika i autoryzacją
 *
 * Bezpieczeństwo:
 * - Token JWT jest przechowywany w HttpOnly cookie (ustawiany przez backend)
 * - W sessionStorage przechowywany jest ZASZYFROWANY klucz prywatny oraz klucz szyfrujący go
 *   (klucz szyfrujący jest generowany losowo dla sesji).
 * - Pozwala to na odnowienie stanu po odświeżeniu strony bez trzymania plaintext klucza prywatnego w storage.
 * - Brak plaintext klucza prywatnego w sessionStorage.
 */
import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI, userAPI } from '../services/api';

const AuthContext = createContext(null);

/**
 * Generuje losowy klucz AES-256
 */
const generateSessionKey = async () => {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
};

/**
 * Eksportuje klucz sesyjny do JWK (JSON)
 */
const exportSessionKey = async (key) => {
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
};

/**
 * Importuje klucz sesyjny z JWK (JSON)
 */
const importSessionKey = async (jwkString) => {
  const jwk = JSON.parse(jwkString);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
};

/**
 * Szyfruje tekst kluczem sesyjnym AES-GCM
 */
const encryptWithSessionKey = async (plaintext, key) => {
  const encoder = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  );
  // Zwróć IV + zaszyfrowane dane jako base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
};

/**
 * Odszyfrowuje tekst kluczem sesyjnym AES-GCM
 */
const decryptWithSessionKey = async (ciphertext, key) => {
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
};

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

        // Próba odtworzenia klucza prywatnego z bezpiecznego storage sesji
        const storedEncKey = sessionStorage.getItem('p_enc'); // Encrypted Private Key
        const storedSKey = sessionStorage.getItem('s_k'); // Session Key (JWK)

        if (storedEncKey && storedSKey) {
          try {
            const sessionKey = await importSessionKey(storedSKey);
            const keyPEM = await decryptWithSessionKey(
              storedEncKey,
              sessionKey,
            );
            setPrivateKey(keyPEM);
          } catch (e) {
            console.error('Failed to restore private key from session', e);
          }
        }
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

    // Bezpieczniejsze przetrzymywanie klucza prywatnego w sessionStorage

    // Bezpieczniejsze przetrzymywanie klucza prywatnego w sessionStorage
    if (privateKeyPEM) {
      try {
        const sessionKey = await generateSessionKey();
        const encryptedKey = await encryptWithSessionKey(
          privateKeyPEM,
          sessionKey,
        );
        const exportedSKey = await exportSessionKey(sessionKey);

        sessionStorage.setItem('p_enc', encryptedKey);
        sessionStorage.setItem('s_k', exportedSKey);

        // Upewniamy się, że nie ma starego śmiecia
        sessionStorage.removeItem('privateKey');
        sessionStorage.removeItem('encryptedSessionPassword');
        sessionStorage.removeItem('encryptedPrivateKey');
        sessionStorage.removeItem('keyDerivationSalt');
      } catch (e) {
        console.error('Failed to secure private key in session', e);
      }
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Wyczyść stan i sessionStorage
    setUser(null);
    setPrivateKey(null);
    setIsAuthenticated(false);
    sessionStorage.clear();
  };

  const value = {
    user,
    privateKey,
    login,
    logout,
    isAuthenticated,
    loading,
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
