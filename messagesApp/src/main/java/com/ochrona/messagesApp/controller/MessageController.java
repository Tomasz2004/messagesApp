package com.ochrona.messagesApp.controller;

import com.ochrona.messagesApp.dto.AttachmentDto;
import com.ochrona.messagesApp.dto.MessageResponse;
import com.ochrona.messagesApp.dto.SendMessageRequest;
import com.ochrona.messagesApp.security.SecurityUtils;
import com.ochrona.messagesApp.service.MessageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Kontroler zarządzania wiadomościami
 */
@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Messages", description = "Endpoints for encrypted message management")
public class MessageController {

    private final MessageService messageService;
    private final SecurityUtils securityUtils;

    @PostMapping
    @Operation(summary = "Send encrypted message", description = "Sends an encrypted message to one or more recipients with optional attachments")
    public ResponseEntity<MessageResponse> sendMessage(
            HttpServletRequest httpRequest,
            @Valid @RequestBody SendMessageRequest request) {
        try {
            Long senderId = securityUtils.getCurrentUserId(httpRequest);
            MessageResponse response = messageService.sendMessage(senderId, request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Failed to send message: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        } catch (Exception e) {
            log.error("Error sending message", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/inbox")
    @Operation(summary = "Get received messages", description = "Returns all received messages for the authenticated user")
    public ResponseEntity<List<MessageResponse>> getInbox(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            List<MessageResponse> messages = messageService.getReceivedMessages(userId);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            log.error("Error fetching inbox", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/sent")
    @Operation(summary = "Get sent messages", description = "Returns all sent messages by the authenticated user")
    public ResponseEntity<List<MessageResponse>> getSentMessages(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            List<MessageResponse> messages = messageService.getSentMessages(userId);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            log.error("Error fetching sent messages", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{messageId}")
    @Operation(summary = "Get message details", description = "Returns detailed information about a specific message")
    public ResponseEntity<MessageResponse> getMessage(
            HttpServletRequest request,
            @PathVariable Long messageId) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            MessageResponse message = messageService.getMessageById(messageId, userId);
            return ResponseEntity.ok(message);
        } catch (IllegalArgumentException e) {
            log.error("Message not found or access denied: {}", messageId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (Exception e) {
            log.error("Error fetching message", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping("/{messageId}/read")
    @Operation(summary = "Mark message as read", description = "Marks a received message as read")
    public ResponseEntity<String> markAsRead(
            HttpServletRequest request,
            @PathVariable Long messageId) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            messageService.markAsRead(messageId, userId);
            return ResponseEntity.ok("Message marked as read");
        } catch (IllegalArgumentException e) {
            log.error("Failed to mark as read: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error marking message as read", e);
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/{messageId}")
    @Operation(summary = "Delete message", description = "Deletes a message (soft delete)")
    public ResponseEntity<String> deleteMessage(
            HttpServletRequest request,
            @PathVariable Long messageId) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            messageService.deleteMessage(messageId, userId);
            return ResponseEntity.ok("Message deleted");
        } catch (IllegalArgumentException e) {
            log.error("Failed to delete message: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(e.getMessage());
        } catch (Exception e) {
            log.error("Error deleting message", e);
            return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
        }
    }

    @GetMapping("/unread/count")
    @Operation(summary = "Get unread message count", description = "Returns the number of unread messages")
    public ResponseEntity<Long> getUnreadCount(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            long count = messageService.getUnreadCount(userId);
            return ResponseEntity.ok(count);
        } catch (Exception e) {
            log.error("Error counting unread messages", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/attachments/{attachmentId}")
    @Operation(summary = "Download attachment", description = "Downloads an encrypted attachment")
    public ResponseEntity<AttachmentDto> getAttachment(
            HttpServletRequest request,
            @PathVariable Long attachmentId) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            AttachmentDto attachment = messageService.getAttachment(attachmentId, userId);
            return ResponseEntity.ok(attachment);
        } catch (IllegalArgumentException e) {
            log.error("Attachment not found or access denied: {}", attachmentId);
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (Exception e) {
            log.error("Error fetching attachment", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
