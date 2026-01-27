package com.ochrona.messagesApp.service;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.*;
import java.security.spec.KeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Serwis kryptograficzny implementujący:
 * - RSA dla szyfrowania kluczy i podpisów
 * - AES-256-GCM dla szyfrowania treści
 * - PBKDF2 dla derywacji kluczy z haseł
 * - SHA-256 dla hashowania
 */
@Service
@Slf4j
public class CryptoService {

    private static final String RSA_ALGORITHM = "RSA";
    private static final String RSA_TRANSFORMATION = "RSA/ECB/OAEPWithSHA-256AndMGF1Padding";
    private static final int RSA_KEY_SIZE = 2048;

    private static final String AES_ALGORITHM = "AES";
    private static final String AES_TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int AES_KEY_SIZE = 256;
    private static final int GCM_TAG_LENGTH = 128;
    private static final int GCM_IV_LENGTH = 12;

    private static final String PBKDF2_ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int PBKDF2_ITERATIONS = 100000;
    private static final int PBKDF2_KEY_LENGTH = 256;

    private static final String SIGNATURE_ALGORITHM = "SHA256withRSA";

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    // ==================== RSA ====================

    /**
     * Generuje parę kluczy RSA (publiczny i prywatny)
     */
    public KeyPair generateRSAKeyPair() throws Exception {
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(RSA_ALGORITHM);
        keyPairGenerator.initialize(RSA_KEY_SIZE, new SecureRandom());
        return keyPairGenerator.generateKeyPair();
    }

    /**
     * Konwertuje klucz publiczny RSA do formatu PEM (Base64)
     */
    public String publicKeyToPEM(PublicKey publicKey) {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }

    /**
     * Konwertuje klucz prywatny RSA do formatu PEM (Base64)
     */
    public String privateKeyToPEM(PrivateKey privateKey) {
        return Base64.getEncoder().encodeToString(privateKey.getEncoded());
    }

    /**
     * Odczytuje klucz publiczny RSA z formatu PEM
     */
    public PublicKey publicKeyFromPEM(String pemKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(pemKey);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance(RSA_ALGORITHM);
        return keyFactory.generatePublic(spec);
    }

    /**
     * Odczytuje klucz prywatny RSA z formatu PEM
     */
    public PrivateKey privateKeyFromPEM(String pemKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(pemKey);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance(RSA_ALGORITHM);
        return keyFactory.generatePrivate(spec);
    }

    /**
     * Szyfruje dane kluczem publicznym RSA
     */
    public String encryptWithRSAPublicKey(String data, PublicKey publicKey) throws Exception {
        Cipher cipher = Cipher.getInstance(RSA_TRANSFORMATION, "BC");
        cipher.init(Cipher.ENCRYPT_MODE, publicKey);
        byte[] encryptedBytes = cipher.doFinal(data.getBytes());
        return Base64.getEncoder().encodeToString(encryptedBytes);
    }

    /**
     * Odszyfrowuje dane kluczem prywatnym RSA
     */
    public String decryptWithRSAPrivateKey(String encryptedData, PrivateKey privateKey) throws Exception {
        Cipher cipher = Cipher.getInstance(RSA_TRANSFORMATION, "BC");
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedData));
        return new String(decryptedBytes);
    }

    // ==================== AES-GCM ====================

    /**
     * Generuje losowy klucz AES-256
     */
    public SecretKey generateAESKey() throws Exception {
        KeyGenerator keyGenerator = KeyGenerator.getInstance(AES_ALGORITHM);
        keyGenerator.init(AES_KEY_SIZE, new SecureRandom());
        return keyGenerator.generateKey();
    }

    /**
     * Generuje losowy Initialization Vector (IV) dla AES-GCM
     */
    public byte[] generateIV() {
        byte[] iv = new byte[GCM_IV_LENGTH];
        new SecureRandom().nextBytes(iv);
        return iv;
    }

    /**
     * Konwertuje klucz AES do Base64
     */
    public String aesKeyToBase64(SecretKey key) {
        return Base64.getEncoder().encodeToString(key.getEncoded());
    }

    /**
     * Odczytuje klucz AES z Base64
     */
    public SecretKey aesKeyFromBase64(String base64Key) {
        byte[] decodedKey = Base64.getDecoder().decode(base64Key);
        return new SecretKeySpec(decodedKey, 0, decodedKey.length, AES_ALGORITHM);
    }

    /**
     * Szyfruje dane kluczem AES-GCM
     */
    public EncryptedData encryptWithAES(String plaintext, SecretKey aesKey, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, aesKey, gcmParameterSpec);

        byte[] encryptedBytes = cipher.doFinal(plaintext.getBytes());
        String encryptedText = Base64.getEncoder().encodeToString(encryptedBytes);
        String ivBase64 = Base64.getEncoder().encodeToString(iv);

        return new EncryptedData(encryptedText, ivBase64);
    }

    /**
     * Odszyfrowuje dane kluczem AES-GCM
     */
    public String decryptWithAES(String encryptedText, SecretKey aesKey, String ivBase64) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        byte[] iv = Base64.getDecoder().decode(ivBase64);
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, aesKey, gcmParameterSpec);

        byte[] decryptedBytes = cipher.doFinal(Base64.getDecoder().decode(encryptedText));
        return new String(decryptedBytes);
    }

    /**
     * Szyfruje dane binarne (np. załączniki) kluczem AES-GCM
     */
    public byte[] encryptBytesWithAES(byte[] data, SecretKey aesKey, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.ENCRYPT_MODE, aesKey, gcmParameterSpec);
        return cipher.doFinal(data);
    }

    /**
     * Odszyfrowuje dane binarne kluczem AES-GCM
     */
    public byte[] decryptBytesWithAES(byte[] encryptedData, SecretKey aesKey, byte[] iv) throws Exception {
        Cipher cipher = Cipher.getInstance(AES_TRANSFORMATION);
        GCMParameterSpec gcmParameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
        cipher.init(Cipher.DECRYPT_MODE, aesKey, gcmParameterSpec);
        return cipher.doFinal(encryptedData);
    }

    // ==================== PBKDF2 ====================

    /**
     * Generuje losową sól
     */
    public String generateSalt() {
        byte[] salt = new byte[32];
        new SecureRandom().nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt);
    }

    /**
     * Derywuje klucz z hasła przy użyciu PBKDF2
     */
    public SecretKey deriveKeyFromPassword(String password, String saltBase64) throws Exception {
        byte[] salt = Base64.getDecoder().decode(saltBase64);
        KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH);
        SecretKeyFactory factory = SecretKeyFactory.getInstance(PBKDF2_ALGORITHM);
        byte[] keyBytes = factory.generateSecret(spec).getEncoded();
        return new SecretKeySpec(keyBytes, AES_ALGORITHM);
    }

    /**
     * Hashuje hasło z solą przy użyciu PBKDF2 (do przechowywania w bazie)
     */
    public String hashPassword(String password, String saltBase64) throws Exception {
        byte[] salt = Base64.getDecoder().decode(saltBase64);
        KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH);
        SecretKeyFactory factory = SecretKeyFactory.getInstance(PBKDF2_ALGORITHM);
        byte[] hash = factory.generateSecret(spec).getEncoded();
        return Base64.getEncoder().encodeToString(hash);
    }

    /**
     * Weryfikuje hasło
     */
    public boolean verifyPassword(String password, String storedHash, String saltBase64) throws Exception {
        String computedHash = hashPassword(password, saltBase64);
        return MessageDigest.isEqual(computedHash.getBytes(), storedHash.getBytes());
    }

    // ==================== Podpisy cyfrowe ====================

    /**
     * Podpisuje dane kluczem prywatnym RSA
     */
    public String signData(String data, PrivateKey privateKey) throws Exception {
        Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM);
        signature.initSign(privateKey);
        signature.update(data.getBytes());
        byte[] signatureBytes = signature.sign();
        return Base64.getEncoder().encodeToString(signatureBytes);
    }

    /**
     * Weryfikuje podpis kluczem publicznym RSA
     */
    public boolean verifySignature(String data, String signatureBase64, PublicKey publicKey) throws Exception {
        Signature signature = Signature.getInstance(SIGNATURE_ALGORITHM);
        signature.initVerify(publicKey);
        signature.update(data.getBytes());
        byte[] signatureBytes = Base64.getDecoder().decode(signatureBase64);
        return signature.verify(signatureBytes);
    }

    // ==================== Walidacja siły hasła ====================

    private static final int MIN_PASSWORD_LENGTH = 12;
    private static final Set<String> COMMON_PASSWORDS = new HashSet<>(Arrays.asList(
            "123456", "password", "123456789", "12345678", "12345",
            "1234567", "qwerty", "abc123", "football", "monkey",
            "letmein", "dragon", "111111", "baseball", "iloveyou",
            "trustno1", "123123", "password1"));

    public PasswordStrength checkPasswordStrength(String password) {
        if (password == null || password.trim().isEmpty())
            return PasswordStrength.WEAK;

        String pw = password.trim();

        // Block very short passwords
        if (pw.length() < MIN_PASSWORD_LENGTH)
            return PasswordStrength.WEAK;

        // Block common passwords
        if (isCommonPassword(pw))
            return PasswordStrength.WEAK;

        // Block simple sequences or repeated chars
        if (hasSequentialChars(pw, 4) || hasRepeatedChars(pw, 4))
            return PasswordStrength.WEAK;

        // Count character classes
        int categories = 0;
        if (pw.matches(".*[a-z].*"))
            categories++;
        if (pw.matches(".*[A-Z].*"))
            categories++;
        if (pw.matches(".*\\d.*"))
            categories++;
        if (pw.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?].*"))
            categories++;

        if ((pw.length() >= 16 && categories >= 2) || (pw.length() >= MIN_PASSWORD_LENGTH && categories >= 3))
            return PasswordStrength.STRONG;

        return PasswordStrength.WEAK;
    }

    private boolean isCommonPassword(String password) {
        return COMMON_PASSWORDS.contains(password.toLowerCase());
    }

    private boolean hasRepeatedChars(String pw, int threshold) {
        int count = 1;
        for (int i = 1; i < pw.length(); i++) {
            if (pw.charAt(i) == pw.charAt(i - 1)) {
                count++;
                if (count >= threshold)
                    return true;
            } else {
                count = 1;
            }
        }
        return false;
    }

    private boolean hasSequentialChars(String pw, int seqLen) {
        String lower = pw.toLowerCase();
        for (int i = 0; i + seqLen <= lower.length(); i++) {
            boolean asc = true;
            boolean desc = true;
            for (int j = 1; j < seqLen; j++) {
                char prev = lower.charAt(i + j - 1);
                char cur = lower.charAt(i + j);
                if (cur - prev != 1)
                    asc = false;
                if (prev - cur != 1)
                    desc = false;
            }
            if (asc || desc)
                return true;
        }
        return false;
    }

    public enum PasswordStrength {
        WEAK, STRONG
    }

    /**
     * Klasa pomocnicza dla zaszyfrowanych danych
     */
    public static class EncryptedData {
        public final String ciphertext;
        public final String iv;

        public EncryptedData(String ciphertext, String iv) {
            this.ciphertext = ciphertext;
            this.iv = iv;
        }
    }
}
