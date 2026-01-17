package com.ochrona.messagesApp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "attachments", indexes = {
        @Index(name = "idx_attachments_message", columnList = "message_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @Column(name = "filename_encrypted", nullable = false, length = 255)
    private String filenameEncrypted;

    @Column(name = "content_encrypted", nullable = false, columnDefinition = "BYTEA")
    private byte[] contentEncrypted;

    @Column(name = "mime_type_encrypted", length = 100)
    private String mimeTypeEncrypted;

    @Column(name = "size_bytes", nullable = false)
    private Long sizeBytes;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
