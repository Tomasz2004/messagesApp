package com.ochrona.messagesApp.service;

import com.ochrona.messagesApp.dto.*;
import com.ochrona.messagesApp.entity.Attachment;
import com.ochrona.messagesApp.entity.Message;
import com.ochrona.messagesApp.entity.MessageRecipient;
import com.ochrona.messagesApp.entity.User;
import com.ochrona.messagesApp.repository.AttachmentRepository;
import com.ochrona.messagesApp.repository.MessageRecipientRepository;
import com.ochrona.messagesApp.repository.MessageRepository;
import com.ochrona.messagesApp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Serwis zarządzania wiadomościami
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private final MessageRepository messageRepository;
    private final MessageRecipientRepository messageRecipientRepository;
    private final AttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final CryptoService cryptoService;

    /**
     * Wysłanie zaszyfrowanej wiadomości
     */
    @Transactional
    public MessageResponse sendMessage(Long senderId, SendMessageRequest request) {
        // Walidacja nadawcy
        User sender = userRepository.findById(senderId)
                .orElseThrow(() -> new IllegalArgumentException("Sender not found"));

        // Walidacja odbiorców
        if (request.getRecipientIds() == null || request.getRecipientIds().isEmpty()) {
            throw new IllegalArgumentException("At least one recipient is required");
        }

        List<User> recipients = userRepository.findAllById(request.getRecipientIds());
        if (recipients.size() != request.getRecipientIds().size()) {
            throw new IllegalArgumentException("One or more recipients not found");
        }

        // Walidacja kluczy dla odbiorców
        if (request.getRecipientKeys() == null ||
                request.getRecipientKeys().size() != request.getRecipientIds().size()) {
            throw new IllegalArgumentException("Encrypted AES key required for each recipient");
        }

        // Tworzenie wiadomości
        Message message = Message.builder()
                .sender(sender)
                .subjectEncrypted(request.getEncryptedSubject())
                .contentEncrypted(request.getEncryptedContent())
                .signature(request.getSignature())
                .iv(request.getIv())
                .build();

        message = messageRepository.save(message);

        // Tworzenie rekordów dla odbiorców z zaszyfrowanymi kluczami AES
        Map<Long, String> recipientKeyMap = request.getRecipientKeys().stream()
                .collect(Collectors.toMap(
                        SendMessageRequest.RecipientKey::getRecipientId,
                        SendMessageRequest.RecipientKey::getEncryptedAesKey));

        List<MessageRecipient> messageRecipients = new ArrayList<>();
        for (User recipient : recipients) {
            String encryptedAesKey = recipientKeyMap.get(recipient.getId());
            if (encryptedAesKey == null) {
                throw new IllegalArgumentException(
                        "Missing encrypted AES key for recipient: " + recipient.getUsername());
            }

            MessageRecipient mr = MessageRecipient.builder()
                    .message(message)
                    .recipient(recipient)
                    .aesKeyEncrypted(encryptedAesKey)
                    .isRead(false)
                    .deleted(false)
                    .build();

            messageRecipients.add(mr);
        }

        messageRecipientRepository.saveAll(messageRecipients);

        // Przetwarzanie załączników (jeśli są)
        List<Attachment> attachments = new ArrayList<>();
        if (request.getAttachments() != null && !request.getAttachments().isEmpty()) {
            for (AttachmentDto attachmentDto : request.getAttachments()) {
                Attachment attachment = Attachment.builder()
                        .message(message)
                        .filenameEncrypted(attachmentDto.getEncryptedFilename())
                        .contentEncrypted(Base64.getDecoder().decode(attachmentDto.getEncryptedContent()))
                        .mimeTypeEncrypted(attachmentDto.getEncryptedMimeType())
                        .sizeBytes(attachmentDto.getSizeBytes())
                        .build();

                attachments.add(attachment);
            }

            attachmentRepository.saveAll(attachments);
        }

        log.info("Message sent from {} to {} recipients", sender.getUsername(), recipients.size());

        // Zwracanie odpowiedzi
        return buildMessageResponse(message, messageRecipients, attachments, null, senderId);
    }

    /**
     * Pobranie otrzymanych wiadomości
     */
    @Transactional(readOnly = true)
    public List<MessageResponse> getReceivedMessages(Long userId) {
        List<MessageRecipient> messageRecipients = messageRecipientRepository
                .findByRecipientIdAndDeletedFalseOrderByMessageCreatedAtDesc(userId);

        return messageRecipients.stream()
                .map(mr -> {
                    Message message = mr.getMessage();
                    List<MessageRecipient> allRecipients = messageRecipientRepository.findByMessageId(message.getId());
                    List<Attachment> attachments = attachmentRepository.findByMessageId(message.getId());
                    return buildMessageResponse(message, allRecipients, attachments, mr, userId);
                })
                .collect(Collectors.toList());
    }

    /**
     * Pobranie wysłanych wiadomości
     */
    @Transactional(readOnly = true)
    public List<MessageResponse> getSentMessages(Long userId) {
        List<Message> messages = messageRepository.findBySenderIdOrderByCreatedAtDesc(userId);

        return messages.stream()
                .map(message -> {
                    List<MessageRecipient> recipients = messageRecipientRepository.findByMessageId(message.getId());
                    List<Attachment> attachments = attachmentRepository.findByMessageId(message.getId());
                    return buildMessageResponse(message, recipients, attachments, null, userId);
                })
                .collect(Collectors.toList());
    }

    /**
     * Pobranie szczegółów pojedynczej wiadomości
     */
    @Transactional(readOnly = true)
    public MessageResponse getMessageById(Long messageId, Long userId) {
        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        // Sprawdzenie czy użytkownik ma dostęp do wiadomości
        boolean isRecipient = messageRecipientRepository.findByMessageIdAndRecipientId(messageId, userId).isPresent();
        boolean isSender = message.getSender().getId().equals(userId);

        if (!isRecipient && !isSender) {
            throw new IllegalArgumentException("Access denied");
        }

        List<MessageRecipient> recipients = messageRecipientRepository.findByMessageId(messageId);
        List<Attachment> attachments = attachmentRepository.findByMessageId(messageId);

        MessageRecipient userRecipient = recipients.stream()
                .filter(mr -> mr.getRecipient().getId().equals(userId))
                .findFirst()
                .orElse(null);

        return buildMessageResponse(message, recipients, attachments, userRecipient, userId);
    }

    /**
     * Oznaczenie wiadomości jako przeczytanej
     */
    @Transactional
    public void markAsRead(Long messageId, Long userId) {
        MessageRecipient messageRecipient = messageRecipientRepository
                .findByMessageIdAndRecipientId(messageId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found or access denied"));

        if (!messageRecipient.getIsRead()) {
            messageRecipient.setIsRead(true);
            messageRecipient.setReadAt(LocalDateTime.now());
            messageRecipientRepository.save(messageRecipient);

            log.info("Message {} marked as read by user {}", messageId, userId);
        }
    }

    /**
     * Usunięcie wiadomości (soft delete)
     */
    @Transactional
    public void deleteMessage(Long messageId, Long userId) {
        MessageRecipient messageRecipient = messageRecipientRepository
                .findByMessageIdAndRecipientId(messageId, userId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found or access denied"));

        messageRecipient.setDeleted(true);
        messageRecipient.setDeletedAt(LocalDateTime.now());
        messageRecipientRepository.save(messageRecipient);

        log.info("Message {} deleted by user {}", messageId, userId);
    }

    /**
     * Liczba nieprzeczytanych wiadomości
     */
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return messageRecipientRepository.countUnreadByRecipientId(userId);
    }

    /**
     * Pobranie załącznika
     */
    @Transactional(readOnly = true)
    public AttachmentDto getAttachment(Long attachmentId, Long userId) {
        Attachment attachment = attachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new IllegalArgumentException("Attachment not found"));

        // Sprawdzenie dostępu
        Message message = attachment.getMessage();
        boolean hasAccess = messageRecipientRepository.findByMessageIdAndRecipientId(message.getId(), userId)
                .isPresent()
                || message.getSender().getId().equals(userId);

        if (!hasAccess) {
            throw new IllegalArgumentException("Access denied");
        }

        return AttachmentDto.builder()
                .id(attachment.getId())
                .encryptedFilename(attachment.getFilenameEncrypted())
                .encryptedMimeType(attachment.getMimeTypeEncrypted())
                .sizeBytes(attachment.getSizeBytes())
                .encryptedContent(Base64.getEncoder().encodeToString(attachment.getContentEncrypted()))
                .build();
    }

    /**
     * Budowanie odpowiedzi MessageResponse
     */
    private MessageResponse buildMessageResponse(
            Message message,
            List<MessageRecipient> recipients,
            List<Attachment> attachments,
            MessageRecipient userRecipient,
            Long currentUserId) {
        List<MessageResponse.RecipientInfo> recipientInfos = recipients.stream()
                .map(mr -> MessageResponse.RecipientInfo.builder()
                        .recipientId(mr.getRecipient().getId())
                        .recipientUsername(mr.getRecipient().getUsername())
                        .isRead(mr.getIsRead())
                        .readAt(mr.getReadAt())
                        .build())
                .collect(Collectors.toList());

        List<AttachmentDto> attachmentDtos = attachments.stream()
                .map(att -> AttachmentDto.builder()
                        .id(att.getId())
                        .encryptedFilename(att.getFilenameEncrypted())
                        .encryptedMimeType(att.getMimeTypeEncrypted())
                        .sizeBytes(att.getSizeBytes())
                        .encryptedContent(Base64.getEncoder().encodeToString(att.getContentEncrypted()))
                        .build())
                .collect(Collectors.toList());

        return MessageResponse.builder()
                .id(message.getId())
                .senderId(message.getSender().getId())
                .senderUsername(message.getSender().getUsername())
                .senderPublicKey(message.getSender().getPublicKey())
                .encryptedSubject(message.getSubjectEncrypted())
                .encryptedContent(message.getContentEncrypted())
                .signature(message.getSignature())
                .iv(message.getIv())
                .encryptedAesKey(userRecipient != null ? userRecipient.getAesKeyEncrypted() : null)
                .createdAt(message.getCreatedAt())
                .isRead(userRecipient != null ? userRecipient.getIsRead() : null)
                .readAt(userRecipient != null ? userRecipient.getReadAt() : null)
                .recipients(recipientInfos)
                .attachments(attachmentDtos)
                .build();
    }
}
