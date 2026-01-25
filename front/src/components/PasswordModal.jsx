import { useState } from 'react';
import { authAPI } from '../services/api';
import cryptoService from '../services/cryptoService';
import { useAuth } from '../context/AuthContext';
import './PasswordModal.css';

const PasswordModal = ({ onSuccess, onCancel }) => {
  const { unlockPrivateKey } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Pobierz zaszyfrowany klucz prywatny z serwera
      const response = await authAPI.getPrivateKey();
      const { encryptedPrivateKey, keyDerivationSalt } = response.data;

      // Odszyfruj klucz prywatny hasłem
      const privateKeyPEM = await cryptoService.decryptPrivateKey(
        encryptedPrivateKey,
        password,
        keyDerivationSalt,
      );

      // Zapisz klucz w kontekście (tylko w pamięci)
      unlockPrivateKey(privateKeyPEM);

      // Powiadom rodzica o sukcesie
      onSuccess(privateKeyPEM);
    } catch (err) {
      console.error('Password unlock error:', err);
      setError('Nieprawidłowe hasło. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='password-modal-overlay'>
      <div className='password-modal'>
        <h2>🔐 Odblokuj klucz prywatny</h2>
        <p className='password-modal-info'>
          Po odświeżeniu strony klucz prywatny został usunięty z pamięci dla
          Twojego bezpieczeństwa. Wpisz hasło, aby odszyfrować klucz i
          kontynuować.
        </p>

        {error && <div className='password-modal-error'>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className='form-group'>
            <label htmlFor='password'>Hasło</label>
            <input
              type='password'
              id='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Wprowadź hasło do konta'
              autoFocus
              disabled={loading}
            />
          </div>

          <div className='password-modal-buttons'>
            <button
              type='button'
              className='btn-cancel'
              onClick={onCancel}
              disabled={loading}
            >
              Anuluj
            </button>
            <button
              type='submit'
              className='btn-unlock'
              disabled={loading || !password}
            >
              {loading ? 'Odszyfrowywanie...' : 'Odblokuj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordModal;
