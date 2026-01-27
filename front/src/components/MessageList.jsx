import { useState, useEffect, useCallback } from 'react';
import { messageAPI } from '../services/api';
import MessageView from './MessageView';
import './MessageList.css';
import { useAuth } from '../context/AuthContext';
import cryptoService from '../services/cryptoService';
import PasswordModal from './PasswordModal';

const MessageList = ({ type }) => {
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { privateKeyDecrypt } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response =
        type === 'inbox'
          ? await messageAPI.getInbox()
          : await messageAPI.getSentMessages();

      // Przekształć recipients na recipientUsernames dla łatwiejszego użycia
      const messagesWithUsernames = response.data.map((msg) => ({
        ...msg,
        recipientUsernames:
          msg.recipients
            ?.filter((r) => r.recipientId !== msg.senderId) // Wyfiltruj nadawcę z listy odbiorców
            .map((r) => r.recipientUsername) || [],
        sentAt: msg.createdAt, // Dodaj alias dla createdAt
        // Pola pomocnicze do UI
        decryptedSubject: null,
        subjectLocked: !!msg.subjectEncrypted,
      }));

      setMessages(messagesWithUsernames);

      // Spróbuj odszyfrować tematy jeśli mamy klucz prywatny
      if (privateKeyDecrypt) {
        try {
          await decryptSubjects(messagesWithUsernames, privateKeyDecrypt);
        } catch {
          // ignoruj błędy (np. brak dostępu do klucza dla niektórych wiadomości)
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Błąd podczas pobierania wiadomości');
    } finally {
      setLoading(false);
    }
  }, [type, privateKeyDecrypt]);

  useEffect(() => {
    // Resetuj wybraną wiadomość przy zmianie zakładki
    setSelectedMessage(null);
    fetchMessages();
  }, [fetchMessages]);

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

  // Odszyfruj tematy wiadomości (asynchronicznie)
  const decryptSubjects = async (msgs, privKey) => {
    const updated = await Promise.all(
      msgs.map(async (m) => {
        try {
          if (!m.subjectEncrypted || !m.encryptedAesKey) return m;

          const encryptedAesKeyBuffer = cryptoService.base64ToArrayBuffer(
            m.encryptedAesKey,
          );

          const aesKeyBytes = await cryptoService.decryptBytesWithRSA(
            encryptedAesKeyBuffer,
            privKey,
          );

          const importedAesKey = await cryptoService.importAESKey(aesKeyBytes);

          const subjectBuffer = cryptoService.base64ToArrayBuffer(
            m.subjectEncrypted,
          );

          const iv = cryptoService.base64ToArrayBuffer(m.iv);

          const subject = await cryptoService.decryptWithAES(
            subjectBuffer,
            importedAesKey,
            new Uint8Array(iv),
          );

          return { ...m, decryptedSubject: subject, subjectLocked: false };
        } catch {
          // Nie udało się odszyfrować tej wiadomości (np. brak uprawnień) — zostaw flagę locked
          return { ...m, decryptedSubject: null, subjectLocked: true };
        }
      }),
    );

    setMessages(updated);
  };

  // Obsługa po odblokowaniu klucza (z PasswordModal)
  const onUnlockSuccess = async () => {
    setShowPasswordModal(false);
    if (privateKeyDecrypt) {
      try {
        await decryptSubjects(messages, privateKeyDecrypt);
      } catch (err) {
        console.error('Decrypt after unlock failed', err);
      }
    }
  };

  const onOpenUnlock = () => setShowPasswordModal(true);

  const handleBack = () => {
    setSelectedMessage(null);
    fetchMessages(); // Odśwież listę po powrocie
  };

  const handleDelete = async (messageId) => {
    if (window.confirm('Czy na pewno chcesz usunąć tę wiadomość?')) {
      try {
        await messageAPI.deleteMessage(messageId);
        setSelectedMessage(null); // Wróć do listy wiadomości
        fetchMessages();
      } catch {
        alert('Błąd podczas usuwania wiadomości');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now - date;
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Przed chwilą';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min temu`;
    } else if (diffHours < 24) {
      return date.toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffDays === 1) {
      return 'Wczoraj';
    } else if (diffDays < 7) {
      return `${diffDays} dni temu`;
    } else {
      return date.toLocaleDateString('pl-PL');
    }
  };

  if (selectedMessage) {
    return (
      <MessageView
        message={selectedMessage}
        onBack={handleBack}
        onDelete={handleDelete}
        type={type}
      />
    );
  }

  return (
    <div className='message-list'>
      {showPasswordModal && (
        <PasswordModal
          onSuccess={() => onUnlockSuccess()}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}

      <div className='message-list-header'>
        <h2>
          {type === 'inbox'
            ? '📥 Odebrane wiadomości'
            : '📤 Wysłane wiadomości'}
        </h2>
      </div>

      {loading && <div className='loading'>Ładowanie wiadomości...</div>}
      {error && <div className='error-message'>{error}</div>}

      {!loading && !error && messages.length === 0 && (
        <div className='empty-state'>
          <p>Brak wiadomości</p>
        </div>
      )}

      {!loading && !error && messages.length > 0 && (
        <div className='messages'>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message-item ${!message.isRead && type === 'inbox' ? 'unread' : ''}`}
              onClick={() => handleMessageClick(message)}
            >
              <div className='message-item-header'>
                <span className='message-sender'>
                  {type === 'inbox'
                    ? `Od: ${message.senderUsername}`
                    : `Do: ${message.recipientUsernames?.join(', ')}`}
                </span>
                <span className='message-date'>
                  {formatDate(message.sentAt)}
                </span>
              </div>
              <div className='message-item-subject'>
                {message.decryptedSubject ? (
                  message.decryptedSubject
                ) : message.subjectEncrypted ? (
                  <>
                    <span className='encrypted-note'>
                      🔒 Zaszyfrowany temat
                    </span>
                    {privateKeyDecrypt ? (
                      // mamy klucz, ale odszyfrowanie mogło się nie powieść
                      <small className='encrypted-hint'>
                        {' '}
                        — wymaga odblokowania klucza lub uprawnień
                      </small>
                    ) : (
                      <span className='encrypted-hint'>
                        {' '}
                        — wpisz hasło, aby odszyfrować
                      </span>
                    )}
                    {!privateKeyDecrypt && (
                      <button
                        className='btn-unlock-inline'
                        onClick={onOpenUnlock}
                      >
                        Odblokuj
                      </button>
                    )}
                  </>
                ) : (
                  'Brak tematu'
                )}
              </div>
              {!message.isRead && type === 'inbox' && (
                <span className='unread-indicator'>●</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageList;
