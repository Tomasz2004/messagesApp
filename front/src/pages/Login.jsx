import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import cryptoService from '../services/cryptoService';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, saveEncryptedPassword } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    totpCode: '',
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);

  // Sprawdź czy jest wiadomość z rejestracji
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      // Wyczyść state z historii
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login({
        username: formData.username,
        password: formData.password,
        totpCode: formData.totpCode || null,
      });

      const data = response.data;

      // Sprawdź czy wymaga TOTP
      if (data.totpRequired) {
        setTotpRequired(true);
        setLoading(false);
        return;
      }

      // Odszyfruj klucz prywatny
      const privateKeyPEM = await cryptoService.decryptPrivateKey(
        data.encryptedPrivateKey,
        formData.password,
        data.keyDerivationSalt,
      );

      // Zaszyfruj i zapisz hasło kluczem sesyjnym (klucz tylko w pamięci)
      // Hasło w sessionStorage będzie zaszyfrowane - nie widoczne jako plaintext
      await saveEncryptedPassword(
        formData.password,
        data.encryptedPrivateKey,
        data.keyDerivationSalt,
      );

      // Zapisz dane użytkownika (token JWT jest w HttpOnly cookie)
      login(
        data.token,
        {
          id: data.userId,
          username: data.username,
          email: data.email,
          publicKey: data.publicKey,
        },
        privateKeyPEM,
      );

      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const errorMessage =
        err.response?.data?.message || 'Błąd logowania. Sprawdź dane.';
      setError(errorMessage);

      // Jeśli był błąd TOTP (ale użytkownik/hasło poprawne), zostaw panel 2FA
      // Wyczyść tylko pole TOTP, nie resetuj całego formularza
      if (totpRequired || formData.totpCode) {
        setFormData({
          ...formData,
          totpCode: '', // Wyczyść tylko kod TOTP
        });
        // Upewnij się, że panel TOTP pozostaje widoczny
        if (!totpRequired && formData.totpCode) {
          setTotpRequired(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='login-container'>
      <div className='login-card'>
        <h1>🔐 Secure Messages</h1>
        <h2>Zaloguj się</h2>

        {successMessage && (
          <div className='success-message'>{successMessage}</div>
        )}
        {error && <div className='error-message'>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor='username'>Nazwa użytkownika</label>
            <input
              type='text'
              id='username'
              name='username'
              value={formData.username}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete='username'
            />
          </div>

          <div className='form-group'>
            <label htmlFor='password'>Hasło</label>
            <input
              type='password'
              id='password'
              name='password'
              value={formData.password}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete='current-password'
            />
          </div>

          {totpRequired && (
            <div className='form-group totp-group'>
              <label htmlFor='totpCode'>Kod 2FA (6 cyfr)</label>
              <input
                type='text'
                id='totpCode'
                name='totpCode'
                value={formData.totpCode}
                onChange={handleChange}
                placeholder='123456'
                maxLength='6'
                pattern='[0-9]{6}'
                required
                disabled={loading}
                autoComplete='one-time-code'
              />
              <small>Wprowadź kod z aplikacji Google Authenticator</small>
            </div>
          )}

          <button type='submit' className='btn-primary' disabled={loading}>
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <div className='login-footer'>
          <p>
            Nie masz konta? <Link to='/register'>Zarejestruj się</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
