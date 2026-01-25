/**
 * AuthContext - zarządzanie stanem użytkownika i autoryzacją
 *
 * Bezpieczeństwo:
 * - Token JWT jest przechowywany w HttpOnly cookie (ustawiany przez backend)
 * - Wrażliwe dane (klucz prywatny) są w sessionStorage (kasowane po zamknięciu przeglądarki)
 * - Hasło jest szyfrowane kluczem sesyjnym przed zapisem do sessionStorage
 * - Klucz sesyjny jest tylko w pamięci (React ref) - znika po odświeżeniu strony
 */
import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

/**
 * Generuje losowy klucz AES-256 do szyfrowania wrażliwych danych w sesji
 */
const generateSessionKey = async () => {
  return await window.crypto.subtle.generateKey(
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

  // Klucz sesyjny przechowywany tylko w pamięci (nie w storage!)
  // useRef - nie powoduje re-renderów i zachowuje wartość między renderami
  const sessionKeyRef = useRef(null);

  useEffect(() => {
    // Wczytaj dane z sessionStorage przy montowaniu
    const storedUser = sessionStorage.getItem('user');
    const storedPrivateKey = sessionStorage.getItem('privateKey');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
      if (storedPrivateKey) {
        setPrivateKey(storedPrivateKey);
      }
    }
    setLoading(false);
  }, []);

  /**
   * Szyfruje i zapisuje hasło do sessionStorage
   */
  const saveEncryptedPassword = async (
    password,
    encryptedPrivateKey,
    keyDerivationSalt,
  ) => {
    // Wygeneruj nowy klucz sesyjny
    const sessionKey = await generateSessionKey();
    sessionKeyRef.current = sessionKey;

    // Zaszyfruj hasło kluczem sesyjnym
    const encryptedPassword = await encryptWithSessionKey(password, sessionKey);

    // Zapisz zaszyfrowane dane
    sessionStorage.setItem('encryptedSessionPassword', encryptedPassword);
    sessionStorage.setItem('encryptedPrivateKey', encryptedPrivateKey);
    sessionStorage.setItem('keyDerivationSalt', keyDerivationSalt);
  };

  /**
   * Pobiera odszyfrowane hasło (jeśli klucz sesyjny jest dostępny)
   */
  const getDecryptedPassword = async () => {
    if (!sessionKeyRef.current) {
      return null; // Klucz sesyjny nie istnieje (np. po odświeżeniu strony)
    }

    const encryptedPassword = sessionStorage.getItem(
      'encryptedSessionPassword',
    );
    if (!encryptedPassword) {
      return null;
    }

    try {
      return await decryptWithSessionKey(
        encryptedPassword,
        sessionKeyRef.current,
      );
    } catch (err) {
      console.error('Failed to decrypt password:', err);
      return null;
    }
  };

  const login = (token, userData, privateKeyPEM) => {
    // Token JWT jest ustawiany jako HttpOnly cookie przez backend
    setUser(userData);
    setPrivateKey(privateKeyPEM);
    setIsAuthenticated(true);

    // Dane użytkownika w sessionStorage
    sessionStorage.setItem('user', JSON.stringify(userData));
    if (privateKeyPEM) {
      sessionStorage.setItem('privateKey', privateKeyPEM);
    }
    // Token jako fallback
    if (token) {
      sessionStorage.setItem('token', token);
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Wyczyść klucz sesyjny z pamięci
    sessionKeyRef.current = null;

    // Wyczyść stan i sessionStorage
    setUser(null);
    setPrivateKey(null);
    setIsAuthenticated(false);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('privateKey');
    sessionStorage.removeItem('encryptedSessionPassword');
    sessionStorage.removeItem('encryptedPrivateKey');
    sessionStorage.removeItem('keyDerivationSalt');
  };

  const value = {
    user,
    privateKey,
    login,
    logout,
    isAuthenticated,
    loading,
    saveEncryptedPassword,
    getDecryptedPassword,
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
