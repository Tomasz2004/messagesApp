package com.ochrona.messagesApp.controller;

import com.ochrona.messagesApp.dto.*;
import com.ochrona.messagesApp.security.SecurityUtils;
import com.ochrona.messagesApp.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Kontroler autentykacji i autoryzacji
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "Endpoints for user authentication and registration")
public class AuthController {

    private final UserService userService;
    private final SecurityUtils securityUtils;

    @PostMapping("/register")
    @Operation(summary = "Register a new user", description = "Creates a new user account with encrypted RSA keys and TOTP setup")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        try {
            RegisterResponse response = userService.registerUser(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            log.error("Registration failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                    RegisterResponse.builder()
                            .message(e.getMessage())
                            .build());
        } catch (Exception e) {
            log.error("Registration error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    RegisterResponse.builder()
                            .message("Registration failed: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping("/login")
    @Operation(summary = "Login user", description = "Authenticates user with username, password and optional TOTP code. Sets JWT as HttpOnly cookie.")
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse httpResponse) {
        try {
            LoginResponse response = userService.login(request);

            // Ustaw JWT jako HttpOnly cookie (jeśli logowanie się powiodło i mamy token)
            if (response.getToken() != null) {
                Cookie jwtCookie = new Cookie("jwt", response.getToken());
                jwtCookie.setHttpOnly(true); // Niedostępne dla JavaScript - ochrona przed XSS
                jwtCookie.setSecure(false); // TODO: ustawić na true w produkcji (wymaga HTTPS)
                jwtCookie.setPath("/"); // Dostępne dla wszystkich ścieżek
                jwtCookie.setMaxAge(24 * 60 * 60); // 24 godziny (zgodne z JWT expiration)
                // SameSite=Lax - ochrona przed CSRF (Spring domyślnie)
                httpResponse.addCookie(jwtCookie);
            }

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.error("Login failed: {}", e.getMessage());
            // Sztuczne opóźnienie przy błędnym logowaniu - ochrona przed brute-force
            try {
                Thread.sleep(1000); // 1 sekunda opóźnienia
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                    LoginResponse.builder()
                            .message(e.getMessage())
                            .build());
        } catch (Exception e) {
            log.error("Login error", e);
            // Sztuczne opóźnienie również przy innych błędach
            try {
                Thread.sleep(1000);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    LoginResponse.builder()
                            .message("Login failed: " + e.getMessage())
                            .build());
        }
    }

    @GetMapping("/totp/setup")
    @Operation(summary = "Get TOTP setup info", description = "Returns QR code and secret for setting up TOTP 2FA. " +
            "Scan the QR code with Google Authenticator or similar app.")
    public ResponseEntity<TotpSetupResponse> getTotpSetup(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            TotpSetupResponse response = userService.getTotpSetup(userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("TOTP setup error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/totp/enable")
    @Operation(summary = "Enable TOTP 2FA", description = "Enables TOTP two-factor authentication for the user. " +
            "IMPORTANT: Before calling this endpoint, scan the QR code from /totp/setup " +
            "in Google Authenticator (or similar app). Then provide the current 6-digit code from " +
            "the app to verify that 2FA is properly configured. This prevents account lockout.")
    public ResponseEntity<String> enableTOTP(
            HttpServletRequest request,
            @Valid @RequestBody EnableTotpRequest totpRequest) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            userService.enableTOTP(userId, totpRequest.getTotpCode());
            return ResponseEntity.ok("TOTP enabled successfully");
        } catch (IllegalArgumentException e) {
            log.error("TOTP enable failed: {}", e.getMessage());
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            log.error("TOTP enable error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to enable TOTP: " + e.getMessage());
        }
    }

    @PostMapping("/totp/disable")
    @Operation(summary = "Disable TOTP 2FA", description = "Disables TOTP two-factor authentication for the user")
    public ResponseEntity<String> disableTOTP(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            userService.disableTOTP(userId);
            return ResponseEntity.ok("TOTP disabled successfully");
        } catch (Exception e) {
            log.error("TOTP disable error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to disable TOTP: " + e.getMessage());
        }
    }

    @GetMapping("/private-key")
    @Operation(summary = "Get encrypted private key", description = "Returns the encrypted private key and salt for the current user. "
            +
            "Used to restore E2EE capability after page refresh by re-entering password.")
    public ResponseEntity<PrivateKeyResponse> getPrivateKey(HttpServletRequest request) {
        try {
            Long userId = securityUtils.getCurrentUserId(request);
            PrivateKeyResponse response = userService.getPrivateKeyData(userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Get private key error", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout user", description = "Clears the JWT cookie to log out the user")
    public ResponseEntity<String> logout(HttpServletResponse httpResponse) {
        // Usuń cookie JWT przez ustawienie maxAge na 0
        Cookie jwtCookie = new Cookie("jwt", "");
        jwtCookie.setHttpOnly(true);
        jwtCookie.setSecure(false); // TODO: ustawić na true w produkcji
        jwtCookie.setPath("/");
        jwtCookie.setMaxAge(0); // Usuń cookie
        httpResponse.addCookie(jwtCookie);

        return ResponseEntity.ok("Logged out successfully");
    }
}
