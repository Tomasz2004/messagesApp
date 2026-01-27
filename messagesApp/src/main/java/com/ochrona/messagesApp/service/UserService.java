package com.ochrona.messagesApp.service;

import com.ochrona.messagesApp.dto.LoginRequest;
import com.ochrona.messagesApp.dto.LoginResponse;
import com.ochrona.messagesApp.dto.RegisterRequest;
import com.ochrona.messagesApp.dto.RegisterResponse;
import com.ochrona.messagesApp.entity.User;
import com.ochrona.messagesApp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.security.KeyPair;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Serwis zarządzania użytkownikami
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;
    private final CryptoService cryptoService;
    private final TOTPService totpService;
    private final JWTService jwtService;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_DURATION_MINUTES = 15;

    /**
     * Rejestracja nowego użytkownika
     */
    @Transactional
    public RegisterResponse registerUser(RegisterRequest request) throws Exception {
        // Walidacja - czy użytkownik już istnieje
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Sprawdzenie siły hasła
        CryptoService.PasswordStrength strength = cryptoService.checkPasswordStrength(request.getPassword());
        if (strength == CryptoService.PasswordStrength.WEAK) {
            throw new IllegalArgumentException(
                    "Hasło jest za słabe. Użyj co najmniej 12 znaków i co najmniej 3 z 4 kategorii: małe litery, duże litery, cyfry, znaki specjalne. Unikaj powszechnych haseł oraz sekwencji i powtórzeń.");
        }

        // Generowanie soli i hashowanie hasła
        String passwordSalt = cryptoService.generateSalt();
        String passwordHash = cryptoService.hashPassword(request.getPassword(), passwordSalt);

        // Generowanie pary kluczy RSA
        KeyPair rsaKeyPair = cryptoService.generateRSAKeyPair();
        String publicKeyPEM = cryptoService.publicKeyToPEM(rsaKeyPair.getPublic());
        String privateKeyPEM = cryptoService.privateKeyToPEM(rsaKeyPair.getPrivate());

        // Szyfrowanie klucza prywatnego kluczem derywowanym z hasła użytkownika
        String keyDerivationSalt = cryptoService.generateSalt();
        SecretKey derivedKey = cryptoService.deriveKeyFromPassword(request.getPassword(), keyDerivationSalt);
        byte[] iv = cryptoService.generateIV();
        CryptoService.EncryptedData encryptedPrivateKey = cryptoService.encryptWithAES(
                privateKeyPEM,
                derivedKey,
                iv);

        // Generowanie TOTP secret
        String totpSecret = totpService.generateSecret();
        String totpQrCode = totpService.generateQRCode(totpSecret, request.getUsername());

        // Tworzenie użytkownika
        User user = User.builder()
                .username(request.getUsername())
                .email(request.getEmail())
                .passwordHash(passwordHash)
                .salt(passwordSalt)
                .publicKey(publicKeyPEM)
                .privateKeyEncrypted(encryptedPrivateKey.ciphertext + ":" + encryptedPrivateKey.iv)
                .keyDerivationSalt(keyDerivationSalt)
                .totpSecret(totpSecret)
                .totpEnabled(false) // Domyślnie wyłączone, użytkownik musi aktywować
                .failedLoginAttempts(0)
                .build();

        user = userRepository.save(user);

        log.info("User registered successfully: {}", user.getUsername());

        return RegisterResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .publicKey(publicKeyPEM)
                .totpSecret(totpSecret)
                .totpQrCode(totpQrCode)
                .message(
                        "User registered successfully. Please save your TOTP secret and scan the QR code with your authenticator app.")
                .build();
    }

    /**
     * Logowanie użytkownika
     */
    @Transactional
    public LoginResponse login(LoginRequest request) throws Exception {
        User user = userRepository.findByUsername(request.getUsername())
                .orElse(null);

        // Time attack protection
        boolean userExists = (user != null);
        User effectiveUser = userExists ? user : createDummyUser();

        // Sprawdzenie czy konto nie jest zablokowane
        if (userExists && effectiveUser.getAccountLockedUntil() != null &&
                effectiveUser.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
            long minutesLeft = java.time.Duration.between(
                    LocalDateTime.now(),
                    effectiveUser.getAccountLockedUntil()).toMinutes() + 1;
            throw new IllegalArgumentException(
                    "Konto zostało tymczasowo zablokowane. Spróbuj ponownie za " + minutesLeft + " min.");
        }

        // Weryfikacja hasła
        if (!cryptoService.verifyPassword(request.getPassword(), effectiveUser.getPasswordHash(),
                effectiveUser.getSalt())) {
            handleFailedLogin(effectiveUser);
            throw new IllegalArgumentException("Nieprawidłowa nazwa użytkownika lub hasło.");
        }

        // Weryfikacja TOTP jeśli włączone
        if (effectiveUser.getTotpEnabled()) {
            if (request.getTotpCode() == null || request.getTotpCode().isEmpty()) {
                return LoginResponse.builder()
                        .totpRequired(true)
                        .message("Wymagany kod 2FA")
                        .build();
            }

            if (!totpService.verifyCode(effectiveUser.getTotpSecret(), request.getTotpCode())) {
                handleFailedLogin(effectiveUser);
                throw new IllegalArgumentException("Nieprawidłowy kod 2FA.");
            }
        }

        // Reset licznika nieudanych prób
        effectiveUser.setFailedLoginAttempts(0);
        effectiveUser.setAccountLockedUntil(null);
        effectiveUser.setLastLogin(LocalDateTime.now());
        userRepository.save(effectiveUser);

        // Generowanie tokena JWT
        String token = jwtService.generateToken(effectiveUser.getId(), effectiveUser.getUsername());

        log.info("User logged in successfully: {}", effectiveUser.getUsername());

        return LoginResponse.builder()
                .token(token)
                .userId(effectiveUser.getId())
                .username(effectiveUser.getUsername())
                .email(effectiveUser.getEmail())
                .publicKey(effectiveUser.getPublicKey())
                .encryptedPrivateKey(effectiveUser.getPrivateKeyEncrypted())
                .keyDerivationSalt(effectiveUser.getKeyDerivationSalt())
                .totpRequired(false)
                .message("Login successful")
                .build();
    }

    /**
     * Włączenie TOTP dla użytkownika
     */
    @Transactional
    public void enableTOTP(Long userId, String totpCode) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (!totpService.verifyCode(user.getTotpSecret(), totpCode)) {
            throw new IllegalArgumentException("Invalid TOTP code");
        }

        user.setTotpEnabled(true);
        userRepository.save(user);

        log.info("TOTP enabled for user: {}", user.getUsername());
    }

    /**
     * Wyłączenie TOTP dla użytkownika
     */
    @Transactional
    public void disableTOTP(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setTotpEnabled(false);
        userRepository.save(user);

        log.info("TOTP disabled for user: {}", user.getUsername());
    }

    /**
     * Pobranie zaszyfrowanego klucza prywatnego i soli
     * Używane do odtworzenia E2EE po odświeżeniu strony
     */
    public com.ochrona.messagesApp.dto.PrivateKeyResponse getPrivateKeyData(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return com.ochrona.messagesApp.dto.PrivateKeyResponse.builder()
                .encryptedPrivateKey(user.getPrivateKeyEncrypted())
                .keyDerivationSalt(user.getKeyDerivationSalt())
                .build();
    }

    /**
     * Pobranie danych do konfiguracji TOTP (QR kod i sekret)
     */
    public com.ochrona.messagesApp.dto.TotpSetupResponse getTotpSetup(Long userId) throws Exception {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String qrCode = totpService.generateQRCode(user.getTotpSecret(), user.getUsername());

        return com.ochrona.messagesApp.dto.TotpSetupResponse.builder()
                .totpSecret(user.getTotpSecret())
                .totpQrCode(qrCode)
                .build();
    }

    /**
     * Pobranie wszystkich użytkowników (do wyszukiwania odbiorców)
     */
    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    /**
     * Pobranie użytkownika po ID
     */
    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    /**
     * Pobranie użytkownika po username
     */
    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    /**
     * Obsługa nieudanego logowania
     */
    private void handleFailedLogin(User user) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);

        if (attempts >= MAX_FAILED_ATTEMPTS) {
            user.setAccountLockedUntil(LocalDateTime.now().plusMinutes(LOCKOUT_DURATION_MINUTES));
            log.warn("Account locked for user: {} due to {} failed attempts", user.getUsername(), attempts);
        }

        userRepository.save(user);
    }

    private User createDummyUser() {
        try {
            // Dummy user z dummy danymi (żeby verify zajął tyle samo czasu)
            return User.builder()
                    .username("dummy_user")
                    .passwordHash(cryptoService.hashPassword("dummy_password", "dummy_salt"))
                    .salt("dummy_salt")
                    .accountLockedUntil(null)
                    .totpEnabled(false)
                    .failedLoginAttempts(0)
                    .build();
        } catch (Exception e) {
            log.error("Failed to create dummy user", e);
            return User.builder()
                    .username("dummy")
                    .passwordHash("dummy")
                    .salt("dummy")
                    .build();
        }
    }

    /**
     * Usuwanie użytkownika
     */
    @Transactional
    public void deleteUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        userRepository.delete(user);
        log.info("User deleted: {}", user.getUsername());
    }
}
