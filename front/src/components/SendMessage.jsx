import { useState, useEffect, useRef } from 'react';
import { userAPI, messageAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import cryptoService from '../services/cryptoService';
import PasswordModal from './PasswordModal';
import './SendMessage.css';

const SendMessage = ({ onClose }) => {
  const { user, privateKeyDecrypt, privateKeySign } = useAuth();
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    recipientIds: [],
    subject: '',
    content: '',
  });
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlockedPrivateKeyDecrypt, setUnlockedPrivateKeyDecrypt] =
    useState(null);
  const [unlockedPrivateKeySign, setUnlockedPrivateKeySign] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await userAPI.getAllUsers();
      // Filtruj aktualnego użytkownika z listy
      const filteredUsers = response.data.filter((u) => u.id !== user.id);
      setUsers(filteredUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Błąd podczas pobierania listy użytkowników');
    }
  };

  const handleRecipientToggle = (userId) => {
    setFormData((prev) => {
      const isSelected = prev.recipientIds.includes(userId);
      return {
        ...prev,
        recipientIds: isSelected
          ? prev.recipientIds.filter((id) => id !== userId)
          : [...prev.recipientIds, userId],
      };
    });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit per file
    const maxTotalSize = 25 * 1024 * 1024; // 25MB total limit

    const currentTotalSize = attachments.reduce(
      (sum, att) => sum + att.size,
      0,
    );
    let newTotalSize = currentTotalSize;

    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        setError(`Plik "${file.name}" przekracza limit 10MB`);
        return false;
      }
      newTotalSize += file.size;
      if (newTotalSize > maxTotalSize) {
        setError('Łączny rozmiar załączników nie może przekraczać 25MB');
        return false;
      }
      return true;
    });

    const newAttachments = validFiles.map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.recipientIds.length === 0) {
      setError('Wybierz co najmniej jednego odbiorcę');
      setLoading(false);
      return;
    }

    if (!formData.subject.trim()) {
      setError('Temat wiadomości jest wymagany');
      setLoading(false);
      return;
    }

    if (!formData.content.trim()) {
      setError('Wiadomość nie może być pusta');
      setLoading(false);
      return;
    }

    try {
      // Generuj klucz AES dla tej wiadomości
      const aesKey = await cryptoService.generateAESKey();
      const iv = cryptoService.generateIV();

      // Zaszyfruj temat i treść kluczem AES
      const encryptedSubject = await cryptoService.encryptWithAES(
        formData.subject,
        aesKey,
        iv,
      );

      const encryptedContent = await cryptoService.encryptWithAES(
        formData.content,
        aesKey,
        iv,
      );

      // Szyfrowanie załączników tym samym kluczem AES
      const encryptedAttachments = await Promise.all(
        attachments.map(async (attachment) => {
          const fileData = await readFileAsArrayBuffer(attachment.file);

          // Zaszyfruj zawartość pliku
          const encryptedFileContent = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            aesKey,
            fileData,
          );

          // Zaszyfruj nazwę pliku
          const encryptedFilename = await cryptoService.encryptWithAES(
            attachment.name,
            aesKey,
            iv,
          );

          // Zaszyfruj typ MIME
          const encryptedMimeType = await cryptoService.encryptWithAES(
            attachment.type,
            aesKey,
            iv,
          );

          return {
            encryptedFilename:
              cryptoService.arrayBufferToBase64(encryptedFilename),
            encryptedMimeType:
              cryptoService.arrayBufferToBase64(encryptedMimeType),
            encryptedContent: cryptoService.arrayBufferToBase64(
              new Uint8Array(encryptedFileContent),
            ),
            sizeBytes: attachment.size,
          };
        }),
      );

      // Eksportuj klucz AES do raw bytes
      const aesKeyBytes = await cryptoService.exportAESKey(aesKey);

      // Dla każdego odbiorcy: zaszyfruj klucz AES jego kluczem publicznym RSA
      const recipients = await Promise.all(
        formData.recipientIds.map(async (recipientId) => {
          const recipient = users.find((u) => u.id === recipientId);
          const publicKey = await cryptoService.importPublicKey(
            recipient.publicKey,
          );

          const encryptedAesKey = await cryptoService.encryptBytesWithRSA(
            aesKeyBytes,
            publicKey,
          );

          return {
            recipientId: recipientId,
            encryptedAesKey: cryptoService.arrayBufferToBase64(encryptedAesKey),
          };
        }),
      );

      // Dodaj nadawcę do recipients
      const senderPublicKey = await cryptoService.importPublicKey(
        user.publicKey,
      );
      const senderEncryptedAesKey = await cryptoService.encryptBytesWithRSA(
        aesKeyBytes,
        senderPublicKey,
      );

      recipients.push({
        recipientId: user.id,
        encryptedAesKey: cryptoService.arrayBufferToBase64(
          senderEncryptedAesKey,
        ),
      });

      // Użyj kluczy prywatnych z kontekstu lub odblokowanych kluczy (CryptoKey)
      const currentPrivateKeySign = privateKeySign || unlockedPrivateKeySign;

      if (!currentPrivateKeySign) {
        // Pokaż modal do wpisania hasła
        setShowPasswordModal(true);
        setLoading(false);
        return;
      }

      // currentPrivateKeySign jest już CryptoKey gotowym do podpisywania
      const privateKeyForSigning = currentPrivateKeySign;

      // Utwórz hash wiadomości (SHA-256 z subjectEncrypted + contentEncrypted)
      const messageHash = await cryptoService.createMessageHash(
        encryptedSubject,
        encryptedContent,
      );

      // Podpisz hash kluczem prywatnym (RSASSA-PKCS1-v1_5 with SHA-256)
      const signature = await cryptoService.signMessageHash(
        messageHash,
        privateKeyForSigning,
      );

      // Przygotuj dane do wysłania
      const messageData = {
        recipients: recipients,
        subjectEncrypted: cryptoService.arrayBufferToBase64(encryptedSubject),
        contentEncrypted: cryptoService.arrayBufferToBase64(encryptedContent),
        iv: cryptoService.arrayBufferToBase64(iv),
        signature: cryptoService.arrayBufferToBase64(signature),
        attachments:
          encryptedAttachments.length > 0 ? encryptedAttachments : null,
      };

      console.log('Sending message data:', messageData);

      // Wyślij wiadomość
      await messageAPI.sendMessage(messageData);

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Błąd podczas wysyłania wiadomości: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Obsługa po odblokowaniu klucza prywatnego
  const handlePasswordSuccess = (keyDecrypt, keySign) => {
    setUnlockedPrivateKeyDecrypt(keyDecrypt);
    setUnlockedPrivateKeySign(keySign);
    setShowPasswordModal(false);
    // Automatycznie ponów wysłanie formularza
    const fakeEvent = { preventDefault: () => {} };
    handleSubmit(fakeEvent);
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setLoading(false);
  };

  return (
    <div className='send-message'>
      {showPasswordModal && (
        <PasswordModal
          onSuccess={handlePasswordSuccess}
          onCancel={handlePasswordCancel}
        />
      )}

      <div className='send-message-header'>
        <h2>✉️ Nowa wiadomość</h2>
        <button onClick={onClose} className='btn-close'>
          ✕
        </button>
      </div>

      {success && (
        <div className='success-message'>✅ Wiadomość wysłana pomyślnie!</div>
      )}

      {error && <div className='error-message'>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className='form-group'>
          <label>Odbiorcy:</label>
          <div className='recipients-list'>
            {users.map((u) => (
              <label key={u.id} className='recipient-checkbox'>
                <input
                  type='checkbox'
                  checked={formData.recipientIds.includes(u.id)}
                  onChange={() => handleRecipientToggle(u.id)}
                  disabled={loading}
                />
                <span>{u.username}</span>
                <small>{u.email}</small>
              </label>
            ))}
          </div>
        </div>

        <div className='form-group'>
          <label htmlFor='subject'>Temat:</label>
          <input
            type='text'
            id='subject'
            name='subject'
            value={formData.subject}
            onChange={handleChange}
            disabled={loading}
            placeholder='Wprowadź temat wiadomości'
            required
          />
        </div>

        <div className='form-group'>
          <label htmlFor='content'>Treść wiadomości:</label>
          <textarea
            id='content'
            name='content'
            value={formData.content}
            onChange={handleChange}
            disabled={loading}
            placeholder='Wprowadź treść wiadomości'
            rows='10'
            required
          />
        </div>

        {/* Sekcja załączników */}
        <div className='form-group attachments-group'>
          <label>📎 Załączniki:</label>

          <div className='attachments-upload'>
            <input
              type='file'
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              disabled={loading}
              className='file-input'
              id='file-input'
            />
            <label htmlFor='file-input' className='file-input-label'>
              <span className='upload-icon'>📁</span>
              <span>Wybierz pliki lub przeciągnij tutaj</span>
              <small>Max 10MB na plik, łącznie do 25MB</small>
            </label>
          </div>

          {attachments.length > 0 && (
            <div className='attachments-list-send'>
              <div className='attachments-header'>
                <span>
                  {attachments.length}{' '}
                  {attachments.length === 1 ? 'plik' : 'plików'}
                </span>
                <span className='total-size'>
                  Łącznie:{' '}
                  {formatFileSize(
                    attachments.reduce((sum, att) => sum + att.size, 0),
                  )}
                </span>
              </div>
              {attachments.map((att) => (
                <div key={att.id} className='attachment-item-send'>
                  <div className='attachment-info'>
                    <span className='attachment-icon'>
                      {att.type.startsWith('image/')
                        ? '🖼️'
                        : att.type.startsWith('video/')
                          ? '🎬'
                          : att.type.startsWith('audio/')
                            ? '🎵'
                            : att.type.includes('pdf')
                              ? '📄'
                              : att.type.includes('word') ||
                                  att.type.includes('document')
                                ? '📝'
                                : att.type.includes('excel') ||
                                    att.type.includes('spreadsheet')
                                  ? '📊'
                                  : att.type.includes('zip') ||
                                      att.type.includes('archive')
                                    ? '📦'
                                    : '📎'}
                    </span>
                    <span className='attachment-name' title={att.name}>
                      {att.name.length > 30
                        ? att.name.substring(0, 27) + '...'
                        : att.name}
                    </span>
                    <span className='attachment-size'>
                      {formatFileSize(att.size)}
                    </span>
                  </div>
                  <button
                    type='button'
                    className='attachment-remove'
                    onClick={() => removeAttachment(att.id)}
                    disabled={loading}
                    title='Usuń załącznik'
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className='form-actions'>
          <button type='submit' className='btn-primary' disabled={loading}>
            {loading ? (
              <>
                <span className='spinner'></span>
                Wysyłanie...
              </>
            ) : (
              <>
                📤 Wyślij
                {attachments.length > 0 &&
                  ` (+${attachments.length} załączników)`}
              </>
            )}
          </button>
          <button
            type='button'
            onClick={onClose}
            className='btn-secondary'
            disabled={loading}
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
};

export default SendMessage;
