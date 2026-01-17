package com.ochrona.messagesApp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponse {
    private Long id;
    private Long senderId;
    private String senderUsername;
    private String senderPublicKey;
    private String encryptedSubject;
    private String encryptedContent;
    private String signature;
    private String iv;
    private String encryptedAesKey; // Klucz AES zaszyfrowany dla zalogowanego użytkownika
    private LocalDateTime createdAt;
    private Boolean isRead;
    private LocalDateTime readAt;
    private List<RecipientInfo> recipients;
    private List<AttachmentDto> attachments;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipientInfo {
        private Long recipientId;
        private String recipientUsername;
        private Boolean isRead;
        private LocalDateTime readAt;
    }
}
