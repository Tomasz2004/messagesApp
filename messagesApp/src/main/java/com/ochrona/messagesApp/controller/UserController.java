package com.ochrona.messagesApp.controller;

import com.ochrona.messagesApp.dto.UserInfoResponse;
import com.ochrona.messagesApp.entity.User;
import com.ochrona.messagesApp.security.SecurityUtils;
import com.ochrona.messagesApp.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Kontroler zarządzania użytkownikami
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Users", description = "Endpoints for user management")
public class UserController {

    private final UserService userService;
    private final SecurityUtils securityUtils;

    @GetMapping
    @Operation(summary = "Get all users", description = "Returns list of all users (for selecting message recipients)")
    public ResponseEntity<List<UserInfoResponse>> getAllUsers() {
        try {
            List<User> users = userService.getAllUsers();
            List<UserInfoResponse> response = users.stream()
                    .map(user -> UserInfoResponse.builder()
                            .id(user.getId())
                            .username(user.getUsername())
                            .email(user.getEmail())
                            .publicKey(user.getPublicKey())
                            .totpEnabled(user.getTotpEnabled())
                            .build())
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching users", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get user by ID", description = "Returns user information including public key")
    public ResponseEntity<UserInfoResponse> getUserById(@PathVariable Long userId) {
        try {
            User user = userService.getUserById(userId);
            UserInfoResponse response = UserInfoResponse.builder()
                    .id(user.getId())
                    .username(user.getUsername())
                    .email(user.getEmail())
                    .publicKey(user.getPublicKey())
                    .totpEnabled(user.getTotpEnabled())
                    .build();

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("User not found: {}", userId);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error fetching user", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/me")
    @Operation(summary = "Get current user info", description = "Returns currently authenticated user information")
    public ResponseEntity<UserInfoResponse> getCurrentUser(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            User user = userService.getUserById(userId);
            UserInfoResponse response = UserInfoResponse.builder()
                    .id(user.getId())
                    .username(user.getUsername())
                    .email(user.getEmail())
                    .publicKey(user.getPublicKey())
                    .totpEnabled(user.getTotpEnabled())
                    .build();

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error fetching current user", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Delete user account", description = "Deletes user account. Users can only delete their own account.")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId, HttpServletRequest request) {
        try {
            Long currentUserId = securityUtils.getCurrentUserId(request);

            // Sprawdzenie czy użytkownik próbuje usunąć swoje własne konto
            if (!currentUserId.equals(userId)) {
                log.warn("User {} attempted to delete account {}", currentUserId, userId);
                return ResponseEntity.status(403).build();
            }

            userService.deleteUser(userId);
            log.info("User {} deleted their account", userId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            log.error("User not found: {}", userId);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error deleting user", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
