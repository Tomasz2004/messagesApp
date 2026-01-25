import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
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
      await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      // Rejestracja udana - przekieruj do logowania
      navigate('/login', { 
        state: { message: 'Konto zostało utworzone. Możesz się teraz zalogować.' } 
      });
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

  return (
    <div className='register-container'>
      <div className='register-card'>
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
      </div>
    </div>
  );
};

export default Register;
