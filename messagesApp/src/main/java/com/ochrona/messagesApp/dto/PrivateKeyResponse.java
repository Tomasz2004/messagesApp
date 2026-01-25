package com.ochrona.messagesApp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrivateKeyResponse {
    private String encryptedPrivateKey;
    private String keyDerivationSalt;
}
