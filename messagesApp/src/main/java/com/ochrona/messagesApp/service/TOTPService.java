package com.ochrona.messagesApp.service;

import dev.samstevens.totp.code.*;
import dev.samstevens.totp.exceptions.QrGenerationException;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.qr.ZxingPngQrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import static dev.samstevens.totp.util.Utils.getDataUriForImage;

/**
 * Serwis do obsługi TOTP (Time-based One-Time Password) - 2FA
 */
@Service
@Slf4j
public class TOTPService {

    private static final String ISSUER = "SecureMessages";
    private final TimeProvider timeProvider;
    private final CodeGenerator codeGenerator;
    private final CodeVerifier verifier;
    private final QrGenerator qrGenerator;

    public TOTPService() {
        this.timeProvider = new SystemTimeProvider();
        this.codeGenerator = new DefaultCodeGenerator();
        this.verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
        this.qrGenerator = new ZxingPngQrGenerator();
    }

    /**
     * Generuje nowy secret TOTP dla użytkownika
     */
    public String generateSecret() {
        DefaultSecretGenerator secretGenerator = new DefaultSecretGenerator();
        return secretGenerator.generate();
    }

    /**
     * Generuje QR code w formacie Data URI dla użytkownika
     */
    public String generateQRCode(String secret, String username) throws QrGenerationException {
        QrData data = new QrData.Builder()
                .label(username)
                .secret(secret)
                .issuer(ISSUER)
                .algorithm(HashingAlgorithm.SHA1) // TOTP zazwyczaj używa SHA1
                .digits(6)
                .period(30)
                .build();

        byte[] imageData = qrGenerator.generate(data);
        return getDataUriForImage(imageData, qrGenerator.getImageMimeType());
    }

    /**
     * Weryfikuje kod TOTP
     * 
     * @param secret Secret użytkownika
     * @param code   Kod z aplikacji 2FA
     * @return true jeśli kod jest poprawny
     */
    public boolean verifyCode(String secret, String code) {
        try {
            return verifier.isValidCode(secret, code);
        } catch (Exception e) {
            log.error("Error verifying TOTP code", e);
            return false;
        }
    }

    /**
     * Generuje aktualny kod TOTP (przydatne do testów)
     */
    public String getCurrentCode(String secret) throws Exception {
        long currentBucket = Math.floorDiv(timeProvider.getTime(), 30);
        return codeGenerator.generate(secret, currentBucket);
    }
}
