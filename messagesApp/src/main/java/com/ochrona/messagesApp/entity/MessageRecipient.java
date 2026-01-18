package com.ochrona.messagesApp.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "message_recipients", uniqueConstraints = @UniqueConstraint(columnNames = { "message_id",
        "recipient_id" }), indexes = {
                @Index(name = "idx_recipients_user", columnList = "recipient_id, deleted"),
                @Index(name = "idx_recipients_message", columnList = "message_id")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageRecipient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "message_id", nullable = false)
    private Message message;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private User recipient;

    @Column(name = "aes_key_encrypted", nullable = false, columnDefinition = "TEXT")
    private String aesKeyEncrypted;

    @Column(name = "is_sender")
    @Builder.Default
    private Boolean isSender = false;

    @Column(name = "is_read")
    @Builder.Default
    private Boolean isRead = false;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column
    @Builder.Default
    private Boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @PrePersist
    protected void onCreate() {
        if (isRead == null) {
            isRead = false;
        }
        if (deleted == null) {
            deleted = false;
        }
    }
}
