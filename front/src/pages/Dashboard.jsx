import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageAPI, userAPI, authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SendMessage from '../components/SendMessage';
import MessageList from '../components/MessageList';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inbox');
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null); // QR code i secret
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [loadingTotp, setLoadingTotp] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await userAPI.getCurrentUser();
      setTotpEnabled(response.data.totpEnabled || false);
    } catch (err) {
      console.error('Error fetching user info:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleOpenTotpSetup = async () => {
    setLoadingTotp(true);
    setError('');
    try {
      const response = await authAPI.getTotpSetup();
      setTotpSetup(response.data);
      setShowTotpModal(true);
    } catch (err) {
      setError('Błąd podczas pobierania kodu QR');
      console.error('Error fetching TOTP setup:', err);
    } finally {
      setLoadingTotp(false);
    }
  };

  const handleEnableTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Wprowadź 6-cyfrowy kod z aplikacji Authenticator');
      return;
    }

    try {
      await authAPI.enableTotp(totpCode);
      setTotpEnabled(true);
      setShowTotpModal(false);
      setTotpSetup(null);
      setTotpCode('');
      setError('');
      alert('2FA włączone pomyślnie!');
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd podczas włączania 2FA');
    }
  };

  const handleCloseTotpModal = () => {
    setShowTotpModal(false);
    setTotpSetup(null);
    setTotpCode('');
    setError('');
  };

  const handleDisableTotp = async () => {
    if (window.confirm('Czy na pewno chcesz wyłączyć 2FA?')) {
      try {
        await authAPI.disableTotp();
        setTotpEnabled(false);
        alert('2FA wyłączone');
      } catch (err) {
        alert('Błąd podczas wyłączania 2FA');
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (
      window.confirm(
        'Czy na pewno chcesz usunąć swoje konto? Ta operacja jest nieodwracalna!',
      )
    ) {
      try {
        await userAPI.deleteUser(user.id);
        logout();
        navigate('/login');
      } catch (err) {
        alert('Błąd podczas usuwania konta');
      }
    }
  };

  return (
    <div className='dashboard'>
      <header className='dashboard-header'>
        <div className='header-content'>
          <h1>🔐 Secure Messages</h1>
          <div className='user-info'>
            <span className='username'>{user?.username}</span>
            <button onClick={handleLogout} className='btn-secondary'>
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className='dashboard-content'>
        <aside className='sidebar'>
          <nav className='sidebar-nav'>
            <button
              className={`nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('inbox');
                setShowSendMessage(false);
              }}
            >
              📥 Odebrane
            </button>
            <button
              className={`nav-item ${activeTab === 'sent' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('sent');
                setShowSendMessage(false);
              }}
            >
              📤 Wysłane
            </button>
            <button
              className='nav-item btn-compose'
              onClick={() => setShowSendMessage(true)}
            >
              ✉️ Nowa wiadomość
            </button>
          </nav>

          <div className='sidebar-footer'>
            <div className='settings-section'>
              <h3>Ustawienia</h3>
              <div className='setting-item'>
                <span>2FA:</span>
                {totpEnabled ? (
                  <button
                    onClick={handleDisableTotp}
                    className='btn-danger-small'
                  >
                    Wyłącz
                  </button>
                ) : (
                  <button
                    onClick={handleOpenTotpSetup}
                    className='btn-primary-small'
                    disabled={loadingTotp}
                  >
                    {loadingTotp ? '...' : 'Włącz'}
                  </button>
                )}
              </div>
              <button onClick={handleDeleteAccount} className='btn-danger'>
                Usuń konto
              </button>
            </div>
          </div>
        </aside>

        <main className='main-content'>
          {showSendMessage ? (
            <SendMessage onClose={() => setShowSendMessage(false)} />
          ) : (
            <MessageList type={activeTab} />
          )}
        </main>
      </div>

      {/* Modal do włączania TOTP */}
      {showTotpModal && totpSetup && (
        <div className='modal-overlay' onClick={handleCloseTotpModal}>
          <div
            className='modal-content totp-setup-modal'
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Włącz 2FA</h2>

            <div className='totp-setup-section'>
              <p>
                1. Zeskanuj poniższy kod QR w aplikacji Google Authenticator:
              </p>
              <div className='qr-code'>
                <img
                  src={totpSetup.totpQrCode}
                  alt='TOTP QR Code'
                  style={{ width: '200px', height: '200px' }}
                />
              </div>

              <div className='totp-secret'>
                <p>Lub wprowadź kod ręcznie:</p>
                <code>{totpSetup.totpSecret}</code>
              </div>
            </div>

            <div className='totp-verify-section'>
              <p>2. Wprowadź 6-cyfrowy kod z aplikacji:</p>
              {error && <div className='error-message'>{error}</div>}
              <input
                type='text'
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder='123456'
                maxLength='6'
                className='totp-input'
              />
            </div>

            <div className='modal-actions'>
              <button onClick={handleEnableTotp} className='btn-primary'>
                Włącz 2FA
              </button>
              <button onClick={handleCloseTotpModal} className='btn-secondary'>
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
