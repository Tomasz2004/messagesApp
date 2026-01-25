# Secure Messages - Backend API

Aplikacja do wymiany zaszyfrowanych wiadomości z end-to-end encryption (E2EE) przy użyciu RSA i AES-256-GCM.

## 🔐 Funkcjonalności

### Zaimplementowane:

- ✅ Rejestracja użytkownika z walidacją siły hasła
- ✅ Logowanie z JWT authentication
- ✅ Dwuskładnikowa autentykacja (TOTP/2FA)
- ✅ Szyfrowanie end-to-end wiadomości (RSA + AES-256-GCM)
- ✅ Podpisy cyfrowe (RSA SHA-256)
- ✅ Załączniki jako integralna część wiadomości
- ✅ Wysyłanie wiadomości do wielu odbiorców
- ✅ Oznaczanie wiadomości jako przeczytane
- ✅ Usuwanie wiadomości (soft delete)
- ✅ Weryfikacja autentyczności wiadomości
- ✅ Ochrona przed brute-force (account lockout)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ Swagger/OpenAPI documentation

## 🛠️ Technologie

- **Framework**: Spring Boot 4.0.1
- **Baza danych**: PostgreSQL 14
- **Kryptografia**: Bouncy Castle 1.79
- **JWT**: JJWT 0.12.6
- **TOTP**: dev.samstevens.totp 1.7.1
- **API Docs**: SpringDoc OpenAPI 2.8.3

## 🔑 Algorytmy kryptograficzne

- **RSA-2048**: Szyfrowanie kluczy symetrycznych i podpisy cyfrowe
- **AES-256-GCM**: Szyfrowanie treści wiadomości i załączników
- **PBKDF2**: Derywacja kluczy z haseł (100,000 iteracji)
- **SHA-256**: Funkcje skrótu i podpisy

## 📦 Wymagania

- Java 25
- PostgreSQL 14+
- Maven 3.8+

## 🚀 Uruchomienie

### 1. Uruchom PostgreSQL i utwórz bazę danych

```bash
# W terminalu PSQL
CREATE DATABASE messagesDB;
CREATE USER admin WITH PASSWORD 'admin';
GRANT ALL PRIVILEGES ON DATABASE messagesDB TO admin;
```

### 2. Wykonaj skrypt bazy danych

```bash
psql -U admin -d messagesDB -f baza.sql
```

### 3. Uruchom aplikację

```bash
cd messagesApp
./mvnw spring-boot:run
```

Aplikacja uruchomi się na `http://localhost:8080`

## 📚 API Documentation

### Swagger UI

Otwórz przeglądarkę: **http://localhost:8080/swagger-ui.html**

### OpenAPI JSON

**http://localhost:8080/v3/api-docs**

## 🧪 Testowanie API

### 1. Rejestracja użytkownika

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123!@#"
  }'
```

**Odpowiedź:**

- `userId` - ID użytkownika
- `publicKey` - Klucz publiczny RSA (PEM)
- `totpSecret` - Secret dla 2FA
- `totpQrCode` - QR code do skanowania w aplikacji authenticator

### 2. Logowanie

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePass123!@#"
  }'
```

**Odpowiedź:**

- `token` - JWT token (użyj w nagłówku Authorization)
- `encryptedPrivateKey` - Zaszyfrowany klucz prywatny RSA
- `keyDerivationSalt` - Sól do odzyskania klucza

### 3. Włączenie TOTP (2FA)

```bash
# Najpierw zeskanuj QR code z rejestracji w aplikacji Google Authenticator
curl -X POST http://localhost:8080/api/auth/totp/enable \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "totpCode": "123456"
  }'
```

### 4. Pobranie listy użytkowników

```bash
curl -X GET http://localhost:8080/api/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 5. Wysłanie zaszyfrowanej wiadomości

**Uwaga**: W rzeczywistej aplikacji szyfrowanie odbywa się po stronie klienta.
Ten przykład pokazuje format żądania.

```bash
curl -X POST http://localhost:8080/api/messages/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientIds": [2],
    "subject": "Test",
    "content": "Hello",
    "encryptedSubject": "BASE64_ENCRYPTED_SUBJECT",
    "encryptedContent": "BASE64_ENCRYPTED_CONTENT",
    "iv": "BASE64_IV",
    "signature": "BASE64_SIGNATURE",
    "recipientKeys": [{
      "recipientId": 2,
      "encryptedAesKey": "BASE64_ENCRYPTED_AES_KEY"
    }]
  }'
```

### 6. Pobranie otrzymanych wiadomości

```bash
curl -X GET http://localhost:8080/api/messages/inbox \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. Oznaczenie wiadomości jako przeczytanej

```bash
curl -X POST http://localhost:8080/api/messages/1/read \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 8. Usunięcie wiadomości

```bash
curl -X DELETE http://localhost:8080/api/messages/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔒 Bezpieczeństwo

### Zaimplementowane mechanizmy:

1. **Hasła**:
   - Minimum 12 znaków
   - Walidacja siły hasła (uppercase, lowercase, cyfry, znaki specjalne)
   - PBKDF2 z 100,000 iteracjami
   - Unikalna sól dla każdego użytkownika

2. **Ochrona przed brute-force**:
   - Limit 5 nieudanych prób logowania
   - Blokada konta na 15 minut
   - Rate limiting (20 żądań/minutę)

3. **JWT**:
   - Ważność tokenu: 24 godziny
   - Podpis HMAC SHA-256
   - Stateless authentication

4. **Szyfrowanie**:
   - End-to-end encryption
   - Unikalne klucze AES dla każdej wiadomości
   - IV (Initialization Vector) dla każdej operacji szyfrowania

5. **Headers Security**:
   - Content Security Policy
   - Frame Options (DENY)
   - CORS configuration

## 📋 Endpointy API

### Authentication

- `POST /api/auth/register` - Rejestracja użytkownika
- `POST /api/auth/login` - Logowanie
- `POST /api/auth/totp/enable` - Włączenie 2FA
- `POST /api/auth/totp/disable` - Wyłączenie 2FA

### Users

- `GET /api/users` - Lista wszystkich użytkowników
- `GET /api/users/{id}` - Szczegóły użytkownika
- `GET /api/users/me` - Aktualny użytkownik

### Messages

- `POST /api/messages/send` - Wysłanie wiadomości
- `GET /api/messages/inbox` - Odebrane wiadomości
- `GET /api/messages/sent` - Wysłane wiadomości
- `GET /api/messages/{id}` - Szczegóły wiadomości
- `POST /api/messages/{id}/read` - Oznacz jako przeczytane
- `DELETE /api/messages/{id}` - Usuń wiadomość
- `GET /api/messages/unread/count` - Liczba nieprzeczytanych
- `GET /api/messages/attachments/{id}` - Pobierz załącznik

## 🔧 Konfiguracja

Edytuj `src/main/resources/application.properties`:

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/messagesDB
spring.datasource.username=admin
spring.datasource.password=admin

# JWT
jwt.secret=your-very-secure-secret-key
jwt.expiration=86400000

# Server
server.port=8080
```

## 🐛 Troubleshooting

### Problem: "Cannot connect to database"

**Rozwiązanie**: Sprawdź czy PostgreSQL działa i dane logowania są poprawne.

### Problem: "JWT token invalid"

**Rozwiązanie**: Sprawdź format tokena w nagłówku: `Authorization: Bearer YOUR_TOKEN`

### Problem: "Account locked"

**Rozwiązanie**: Poczekaj 15 minut lub zrestartuj aplikację (w dev mode).

## 📝 TODO (Frontend)

- React frontend z Web Crypto API
- Szyfrowanie/deszyfrowanie po stronie klienta
- Zarządzanie kluczami
- Upload załączników
- Weryfikacja podpisów cyfrowych

## 👨‍💻 Autor

Projekt zaliczeniowy - Ochrona Danych

## 📄 Licencja

MIT License
