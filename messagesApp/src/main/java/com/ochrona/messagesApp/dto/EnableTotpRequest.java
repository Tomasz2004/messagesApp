package com.ochrona.messagesApp.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class EnableTotpRequest {
    @NotBlank(message = "TOTP code is required")
    private String totpCode;
}
