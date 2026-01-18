import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: formularz, 2: QR kod
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [registrationData, setRegistrationData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const validatePassword = () => {
    if (formData.password.length < 12) {
      return 'Hasło musi mieć co najmniej 12 znaków';
    }
    if (!/[A-Z]/.test(formData.password)) {
      return 'Hasło musi zawierać wielką literę';
    }
    if (!/[a-z]/.test(formData.password)) {
      return 'Hasło musi zawierać małą literę';
    }
    if (!/[0-9]/.test(formData.password)) {
      return 'Hasło musi zawierać cyfrę';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      return 'Hasło musi zawierać znak specjalny';
    }
    if (formData.password !== formData.confirmPassword) {
      return 'Hasła nie są identyczne';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Walidacja hasła
    const passwordError = validatePassword();
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      setRegistrationData(response.data);
      setStep(2);
    } catch (err) {
      console.error('Registration error:', err);
      setError(
        err.response?.data?.message ||
          'Błąd rejestracji. Użytkownik może już istnieć.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/login');
  };

  return (
    <div className='register-container'>
      <div className='register-card'>
        {step === 1 ? (
          <>
            <h1>🔐 Secure Messages</h1>
            <h2>Utwórz konto</h2>

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
                  minLength='3'
                />
              </div>

              <div className='form-group'>
                <label htmlFor='email'>Email</label>
                <input
                  type='email'
                  id='email'
                  name='email'
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete='email'
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
                  autoComplete='new-password'
                />
                <small className='password-hint'>
                  Min. 12 znaków, wielka/mała litera, cyfra i znak specjalny
                </small>
              </div>

              <div className='form-group'>
                <label htmlFor='confirmPassword'>Potwierdź hasło</label>
                <input
                  type='password'
                  id='confirmPassword'
                  name='confirmPassword'
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  autoComplete='new-password'
                />
              </div>

              <button type='submit' className='btn-primary' disabled={loading}>
                {loading ? 'Rejestracja...' : 'Zarejestruj się'}
              </button>
            </form>

            <div className='register-footer'>
              <p>
                Masz już konto? <Link to='/login'>Zaloguj się</Link>
              </p>
            </div>
          </>
        ) : (
          <div className='qr-section'>
            <h2>✅ Konto utworzone!</h2>
            <div className='success-message'>
              <p>Twoje konto zostało pomyślnie utworzone.</p>
            </div>

            <div className='totp-setup'>
              <h3>Skonfiguruj 2FA (opcjonalnie)</h3>
              <p>Zeskanuj poniższy kod QR w aplikacji Google Authenticator:</p>

              <div className='qr-code'>
                {registrationData?.totpQrCode && (
                  <QRCodeSVG
                    value={registrationData.totpQrCode}
                    size={200}
                    level='H'
                  />
                )}
              </div>

              <div className='totp-secret'>
                <p>Lub wprowadź kod ręcznie:</p>
                <code>{registrationData?.totpSecret}</code>
              </div>

              <div className='info-box'>
                <strong>ℹ️ Ważne:</strong>
                <p>
                  Po zalogowaniu możesz włączyć 2FA w ustawieniach. Zapisz kod
                  QR lub sekret TOTP w bezpiecznym miejscu.
                </p>
              </div>
            </div>

            <button onClick={handleContinue} className='btn-primary'>
              Przejdź do logowania
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
