import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import cryptoService from '../services/cryptoService';
import { useAuth } from '../context/AuthContext';
import './PasswordModal.css';

const PasswordModal = ({ onSuccess, onCancel }) => {
  const { unlockPrivateKey, privateKeyDecrypt, privateKeySign } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Jeśli klucze prywatne zostały już odszyfrowane gdzie indziej, zamknij modal automatycznie
  useEffect(() => {
    if ((privateKeyDecrypt || privateKeySign) && !loading) {
      onCancel();
    }
  }, [privateKeyDecrypt, privateKeySign, loading, onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Pobierz zaszyfrowany klucz prywatny z serwera
      const response = await authAPI.getPrivateKey();
      const { encryptedPrivateKey, keyDerivationSalt } = response.data;

      // Odszyfruj klucz prywatny hasłem (zwraca PEM string)
      const privateKeyPEM = await cryptoService.decryptPrivateKey(
        encryptedPrivateKey,
        password,
        keyDerivationSalt,
      );

      // Importuj jako dwa CryptoKey z extractable: false
      const privateKeyDecrypt =
        await cryptoService.importPrivateKey(privateKeyPEM);
      const privateKeySign =
        await cryptoService.importPrivateKeyForSigning(privateKeyPEM);

      // Zapisz klucze w kontekście (tylko w pamięci)
      unlockPrivateKey(privateKeyDecrypt, privateKeySign);

      // Powiadom rodzica o sukcesie i zamknij modal (obsłuż asynchroniczne onSuccess)
      try {
        await Promise.resolve(onSuccess?.(privateKeyDecrypt, privateKeySign));
      } catch (cbErr) {
        console.error('onSuccess callback error:', cbErr);
      }

      // Zawsze zamknij modal po sukcesie
      onCancel();
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
