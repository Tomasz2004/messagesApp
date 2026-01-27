package com.ochrona.messagesApp.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Utility class do pobierania informacji o zalogowanym użytkowniku
 */
@Component
@RequiredArgsConstructor
public class SecurityUtils {

    /**
     * Pobiera ID zalogowanego użytkownika z kontekstu bezpieczeństwa
     */
    public Long getCurrentUserId(HttpServletRequest request) {
        Object userIdAttr = request.getAttribute("userId");
        if (userIdAttr != null) {
            return (Long) userIdAttr;
        }

        throw new IllegalStateException("User not authenticated");
    }

    /**
     * Pobiera username zalogowanego użytkownika
     */
    public String getCurrentUsername(HttpServletRequest request) {
        Object usernameAttr = request.getAttribute("username");
        if (usernameAttr != null) {
            return (String) usernameAttr;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            return authentication.getName();
        }

        throw new IllegalStateException("User not authenticated");
    }
}
