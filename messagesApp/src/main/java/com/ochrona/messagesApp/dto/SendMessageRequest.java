package com.ochrona.messagesApp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class SendMessageRequest {

    // Lista kluczy AES zaszyfrowanych dla każdego odbiorcy
    @NotEmpty(message = "At least one recipient is required")
    private List<RecipientKey> recipients;

    // Zaszyfrowany temat (wymagany)
    @NotBlank(message = "Encrypted subject is required")
    private String subjectEncrypted;

    // Zaszyfrowana treść wiadomości (AES)
    @NotBlank(message = "Encrypted content is required")
    private String contentEncrypted;

    @NotBlank(message = "IV is required")
    private String iv;

    // Podpis cyfrowy (wymagany dla weryfikacji autentyczności)
    @NotBlank(message = "Signature is required")
    private String signature;

    // Załączniki (opcjonalne)
    private List<AttachmentDto> attachments;

    @Data
    public static class RecipientKey {
        private Long recipientId;
        private String encryptedAesKey;
    }
}
