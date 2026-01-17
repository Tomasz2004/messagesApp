package com.ochrona.messagesApp.security;

import com.ochrona.messagesApp.service.JWTService;
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

    private final JWTService jwtService;

    /**
     * Pobiera ID zalogowanego użytkownika z kontekstu bezpieczeństwa
     */
    public Long getCurrentUserId(HttpServletRequest request) {
        // Najpierw próbujemy pobrać z atrybutów żądania (ustawione w
        // JWTAuthenticationFilter)
        Object userIdAttr = request.getAttribute("userId");
        if (userIdAttr != null) {
            return (Long) userIdAttr;
        }

        // Fallback - pobranie z nagłówka Authorization
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtService.getUserIdFromToken(token);
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
