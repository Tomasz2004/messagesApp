import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import cryptoService from '../services/cryptoService';
import './MessageView.css';

const MessageView = ({ message, onBack, onDelete, type }) => {
  const { privateKey } = useAuth();
  const [decryptedSubject, setDecryptedSubject] = useState('');
  const [decryptedContent, setDecryptedContent] = useState('');
  const [decryptedAttachments, setDecryptedAttachments] = useState([]);
  const [signatureValid, setSignatureValid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  // Przechowaj klucz AES i IV do odszyfrowania załączników
  const [aesKey, setAesKey] = useState(null);
  const [ivBuffer, setIvBuffer] = useState(null);

  useEffect(() => {
    decryptMessage();
  }, [message]);

  const decryptMessage = async () => {
    setLoading(true);
    setError('');

    try {
      if (!privateKey) {
        throw new Error('Brak klucza prywatnego - zaloguj się ponownie');
      }

      console.log('Message data:', {
        id: message.id,
        encryptedAesKey: message.encryptedAesKey,
        iv: message.iv,
        attachmentsCount: message.attachments?.length || 0,
      });

      if (!message.encryptedAesKey) {
        throw new Error('Brak zaszyfrowanego klucza AES');
      }

      // Import klucza prywatnego
      const privateKeyObj = await cryptoService.importPrivateKey(privateKey);

      // Odszyfruj klucz AES
      const encryptedAESKeyBuffer = cryptoService.base64ToArrayBuffer(message.encryptedAesKey);
      const aesKeyBytes = await cryptoService.decryptBytesWithRSA(encryptedAESKeyBuffer, privateKeyObj);

      // Import klucza AES
      const importedAesKey = await cryptoService.importAESKey(aesKeyBytes);
      setAesKey(importedAesKey);

      // Odszyfruj IV
      const iv = cryptoService.base64ToArrayBuffer(message.iv);
      setIvBuffer(iv);

      let encryptedSubjectBuffer = null;
      let encryptedContentBuffer = null;

      // Odszyfruj temat
      if (message.subjectEncrypted) {
        encryptedSubjectBuffer = cryptoService.base64ToArrayBuffer(message.subjectEncrypted);
        const subject = await cryptoService.decryptWithAES(
          encryptedSubjectBuffer,
          importedAesKey,
          new Uint8Array(iv),
        );
        setDecryptedSubject(subject);
      }

      // Odszyfruj treść
      encryptedContentBuffer = cryptoService.base64ToArrayBuffer(message.contentEncrypted);
      const content = await cryptoService.decryptWithAES(
        encryptedContentBuffer,
        importedAesKey,
        new Uint8Array(iv),
      );
      setDecryptedContent(content);

      // Odszyfruj metadane załączników (nazwa, mime type)
      if (message.attachments && message.attachments.length > 0) {
        const decryptedAtts = await Promise.all(
          message.attachments.map(async (att) => {
            try {
              // Odszyfruj nazwę pliku
              const filenameBuffer = cryptoService.base64ToArrayBuffer(att.encryptedFilename);
              const filename = await cryptoService.decryptWithAES(filenameBuffer, importedAesKey, new Uint8Array(iv));

              // Odszyfruj typ MIME
              let mimeType = 'application/octet-stream';
              if (att.encryptedMimeType) {
                const mimeBuffer = cryptoService.base64ToArrayBuffer(att.encryptedMimeType);
                mimeType = await cryptoService.decryptWithAES(mimeBuffer, importedAesKey, new Uint8Array(iv));
              }

              return {
                id: att.id,
                filename,
                mimeType,
                sizeBytes: att.sizeBytes,
                encryptedContent: att.encryptedContent,
              };
            } catch (attErr) {
              console.error('Error decrypting attachment metadata:', attErr);
              return {
                id: att.id,
                filename: 'Błąd odszyfrowania',
                mimeType: 'application/octet-stream',
                sizeBytes: att.sizeBytes,
                encryptedContent: att.encryptedContent,
                error: true,
              };
            }
          }),
        );
        setDecryptedAttachments(decryptedAtts);
      }

      // Weryfikacja podpisu
      if (message.signature && message.senderPublicKey) {
        try {
          const senderPublicKey = await cryptoService.importPublicKeyForVerifying(message.senderPublicKey);
          const messageHash = await cryptoService.createMessageHash(encryptedSubjectBuffer, encryptedContentBuffer);
          const signatureBuffer = cryptoService.base64ToArrayBuffer(message.signature);
          const isValid = await cryptoService.verifySignature(signatureBuffer, messageHash, senderPublicKey);
          setSignatureValid(isValid);
        } catch (sigErr) {
          console.error('Signature verification error:', sigErr);
          setSignatureValid(false);
        }
      }
    } catch (err) {
      console.error('Decryption error:', err);
      setError('Błąd deszyfrowania wiadomości: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadAttachment = async (attachment) => {
    if (!aesKey || !ivBuffer || attachment.error) return;

    setDownloadingId(attachment.id);
    try {
      // Odszyfruj zawartość pliku
      const encryptedContent = cryptoService.base64ToArrayBuffer(attachment.encryptedContent);
      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
        aesKey,
        encryptedContent,
      );

      // Utwórz blob i pobierz
      const blob = new Blob([decryptedContent], { type: attachment.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading attachment:', err);
      alert('Błąd podczas pobierania załącznika');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
    return '📎';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className='message-view'>
      <div className='message-view-header'>
        <button onClick={onBack} className='btn-back'>
          ← Powrót
        </button>
        <button onClick={() => onDelete(message.id)} className='btn-delete'>
          🗑️ Usuń
        </button>
      </div>

      {loading && <div className='loading'>Deszyfrowanie wiadomości...</div>}
      {error && <div className='error-message'>{error}</div>}

      {!loading && !error && (
        <div className='message-content'>
          <div className='message-meta'>
            <div className='meta-row'>
              <strong>{type === 'inbox' ? 'Od:' : 'Do:'}</strong>
              <span>
                {type === 'inbox'
                  ? message.senderUsername
                  : message.recipientUsernames?.join(', ')}
              </span>
            </div>
            <div className='meta-row'>
              <strong>Data:</strong>
              <span>{formatDate(message.sentAt)}</span>
            </div>
            <div className='meta-row'>
              <strong>Temat:</strong>
              <span>{decryptedSubject || '(brak tematu)'}</span>
            </div>
            {signatureValid !== null && (
              <div className='meta-row signature-info'>
                <strong>🔏 Podpis cyfrowy:</strong>
                {signatureValid ? (
                  <span className='verified'>✅ Zweryfikowany</span>
                ) : (
                  <span className='not-verified'>❌ NIEPRAWIDŁOWY</span>
                )}
              </div>
            )}
          </div>

          <div className='message-body'>
            <div className='content-text'>{decryptedContent}</div>
          </div>

          {decryptedAttachments.length > 0 && (
            <div className='attachments-section'>
              <h3>📎 Załączniki ({decryptedAttachments.length})</h3>
              <div className='attachments-list'>
                {decryptedAttachments.map((attachment) => (
                  <div key={attachment.id} className={`attachment-item ${attachment.error ? 'attachment-error' : ''}`}>
                    <div className='attachment-info'>
                      <span className='attachment-icon'>{getFileIcon(attachment.mimeType)}</span>
                      <span className='attachment-name' title={attachment.filename}>
                        {attachment.filename.length > 40 
                          ? attachment.filename.substring(0, 37) + '...' 
                          : attachment.filename}
                      </span>
                      <span className='attachment-size'>{formatFileSize(attachment.sizeBytes)}</span>
                    </div>
                    {!attachment.error && (
                      <button
                        className='btn-download'
                        onClick={() => downloadAttachment(attachment)}
                        disabled={downloadingId === attachment.id}
                      >
                        {downloadingId === attachment.id ? (
                          <span className='download-spinner'></span>
                        ) : (
                          '⬇️ Pobierz'
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageView;
