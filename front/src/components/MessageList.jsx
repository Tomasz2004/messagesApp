import { useState, useEffect } from 'react';
import { messageAPI } from '../services/api';
import MessageView from './MessageView';
import './MessageList.css';

const MessageList = ({ type }) => {
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Resetuj wybraną wiadomość przy zmianie zakładki
    setSelectedMessage(null);
    fetchMessages();
  }, [type]);

  const fetchMessages = async () => {
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
      }));

      setMessages(messagesWithUsernames);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Błąd podczas pobierania wiadomości');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageClick = (message) => {
    setSelectedMessage(message);
  };

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
      } catch (err) {
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
              className={`message-item ${!message.read && type === 'inbox' ? 'unread' : ''}`}
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
                {message.subjectEncrypted
                  ? '🔒 Zaszyfrowany temat'
                  : 'Brak tematu'}
              </div>
              {!message.read && type === 'inbox' && (
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
