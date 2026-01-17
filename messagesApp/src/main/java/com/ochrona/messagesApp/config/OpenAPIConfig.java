package com.ochrona.messagesApp.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Konfiguracja Swagger/OpenAPI dla dokumentacji API
 */
@Configuration
public class OpenAPIConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        final String securitySchemeName = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Secure Messages API")
                        .version("1.0")
                        .description(
                                "REST API for encrypted messaging system with end-to-end encryption (E2EE) using RSA and AES-256-GCM. "
                                        +
                                        "Supports TOTP 2FA, digital signatures, and secure attachments.")
                        .contact(new Contact()
                                .name("Ochrona Danych Project")
                                .email("contact@securemessages.local"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")))
                .addSecurityItem(new SecurityRequirement().addList(securitySchemeName))
                .components(new Components()
                        .addSecuritySchemes(securitySchemeName, new SecurityScheme()
                                .name(securitySchemeName)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT token obtained from /api/auth/login endpoint. " +
                                        "Enter the token without 'Bearer ' prefix.")));
    }
}
