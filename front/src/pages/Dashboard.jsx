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
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');

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

  const handleEnableTotp = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Wprowadź 6-cyfrowy kod z aplikacji Authenticator');
      return;
    }

    try {
      await authAPI.enableTotp(totpCode);
      setTotpEnabled(true);
      setShowTotpModal(false);
      setTotpCode('');
      setError('');
      alert('2FA włączone pomyślnie!');
    } catch (err) {
      setError(err.response?.data?.message || 'Błąd podczas włączania 2FA');
    }
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
              onClick={() => setActiveTab('inbox')}
            >
              📥 Odebrane
            </button>
            <button
              className={`nav-item ${activeTab === 'sent' ? 'active' : ''}`}
              onClick={() => setActiveTab('sent')}
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
                    onClick={() => setShowTotpModal(true)}
                    className='btn-primary-small'
                  >
                    Włącz
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
      {showTotpModal && (
        <div className='modal-overlay' onClick={() => setShowTotpModal(false)}>
          <div className='modal-content' onClick={(e) => e.stopPropagation()}>
            <h2>Włącz 2FA</h2>
            <p>
              Wprowadź aktualny kod 6-cyfrowy z aplikacji Google Authenticator
              (użyj kodu QR z rejestracji):
            </p>
            {error && <div className='error-message'>{error}</div>}
            <input
              type='text'
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder='123456'
              maxLength='6'
              pattern='[0-9]{6}'
              className='totp-input'
            />
            <div className='modal-actions'>
              <button onClick={handleEnableTotp} className='btn-primary'>
                Włącz
              </button>
              <button
                onClick={() => setShowTotpModal(false)}
                className='btn-secondary'
              >
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
