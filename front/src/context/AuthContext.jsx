/**
 * AuthContext - zarządzanie stanem użytkownika i autoryzacją
 */
import { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [privateKey, setPrivateKey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wczytaj dane z localStorage przy montowaniu
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedPrivateKey = localStorage.getItem('privateKey');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (storedPrivateKey) {
        setPrivateKey(storedPrivateKey);
      }
    }
    setLoading(false);
  }, []);

  const login = (token, userData, privateKeyPEM) => {
    setToken(token);
    setUser(userData);
    setPrivateKey(privateKeyPEM);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (privateKeyPEM) {
      localStorage.setItem('privateKey', privateKeyPEM);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPrivateKey(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('privateKey');
    localStorage.removeItem('password');
    localStorage.removeItem('encryptedPrivateKey');
    localStorage.removeItem('keyDerivationSalt');
  };

  const value = {
    user,
    token,
    privateKey,
    login,
    logout,
    isAuthenticated: !!token,
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
