package com.ochrona.messagesApp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AttachmentDto {
    private Long id;
    private String encryptedFilename;
    private String encryptedMimeType;
    private Long sizeBytes;
    private String encryptedContent; // Base64
}
