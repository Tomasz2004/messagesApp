DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS message_recipients;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS users;

-- Użytkownicy
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Argon2id/bcrypt
    salt VARCHAR(64) NOT NULL,
    public_key TEXT NOT NULL, -- RSA public key (PEM format)
    private_key_encrypted TEXT NOT NULL, -- RSA private key zaszyfrowany AES
    key_derivation_salt VARCHAR(64) NOT NULL, -- do derywacji klucza AES z hasła
    totp_secret VARCHAR(64), -- Base32 encoded secret
    totp_enabled BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    account_locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Indeksy dla wydajności i bezpieczeństwa
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Wiadomości
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_encrypted TEXT NOT NULL, -- zaszyfrowany AES
    content_encrypted TEXT NOT NULL, -- zaszyfrowany AES
    signature TEXT NOT NULL, -- RSA signature dla weryfikacji autentyczności
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    iv VARCHAR(64) NOT NULL -- Initialization Vector dla AES
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Odbiorcy wiadomości (many-to-many)
CREATE TABLE message_recipients (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aes_key_encrypted TEXT NOT NULL, -- klucz AES zaszyfrowany PUBLIC KEY odbiorcy
    is_sender BOOLEAN DEFAULT FALSE, -- true jeśli to kopia dla nadawcy
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    UNIQUE(message_id, recipient_id)
);

CREATE INDEX idx_recipients_user ON message_recipients(recipient_id, deleted);
CREATE INDEX idx_recipients_message ON message_recipients(message_id);

-- Załączniki (integralna część wiadomości)
CREATE TABLE attachments (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    filename_encrypted VARCHAR(255) NOT NULL, -- nazwa pliku zaszyfrowana
    content_encrypted BYTEA NOT NULL, -- zawartość zaszyfrowana AES (tym samym kluczem co wiadomość)
    mime_type_encrypted VARCHAR(100), -- typ MIME zaszyfrowany
    size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_message ON attachments(message_id);