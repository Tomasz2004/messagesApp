package com.ochrona.messagesApp.controller;

import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Kontroler do pobierania tokenu CSRF
 * Spring automatycznie wstrzyknie CsrfToken i ustawi cookie XSRF-TOKEN
 */
@RestController
@RequestMapping("/api/csrf")
public class CsrfController {

    @GetMapping
    public CsrfToken csrf(CsrfToken token) {
        return token;
    }
}