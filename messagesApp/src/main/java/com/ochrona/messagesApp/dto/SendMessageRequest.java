package com.ochrona.messagesApp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class SendMessageRequest {

    @NotEmpty(message = "At least one recipient is required")
    private List<Long> recipientIds;

    @NotBlank(message = "Subject is required")
    private String subject;

    @NotBlank(message = "Content is required")
    private String content;

    // Klucz AES zaszyfrowany kluczem publicznym dla każdego odbiorcy
    // Mapa: recipientId -> encryptedAesKey
    private List<RecipientKey> recipientKeys;

    // Zaszyfrowana treść wiadomości (AES)
    @NotBlank(message = "Encrypted subject is required")
    private String encryptedSubject;

    @NotBlank(message = "Encrypted content is required")
    private String encryptedContent;

    @NotBlank(message = "IV is required")
    private String iv;

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
