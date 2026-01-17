package com.ochrona.messagesApp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long userId;
    private String username;
    private String email;
    private String publicKey;
    private String encryptedPrivateKey;
    private String keyDerivationSalt;
    private boolean totpRequired;
    private String message;
}
