package com.ochrona.messagesApp.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank(message = "Username is required")
    @Schema(description = "Username", example = "testuser", required = true)
    private String username;

    @NotBlank(message = "Password is required")
    @Schema(description = "User password", example = "SecurePass123!@#", required = true)
    private String password;

    @Schema(description = "TOTP code from authenticator app (required only if 2FA is enabled)", example = "123456", required = false, nullable = true)
    private String totpCode;
}
