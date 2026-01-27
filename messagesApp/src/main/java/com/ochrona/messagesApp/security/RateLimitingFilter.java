package com.ochrona.messagesApp.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * Filtr ograniczający liczbę zapytań (Rate Limiting) - ochrona przed
 * brute-force
 * 
 * Limity:
 * - Logowanie: 5 prób na minutę per IP
 * - Rejestracja: 3 próby na minutę per IP
 * - Ogólne API: 100 zapytań na minutę per IP
 */
@Component
@Slf4j
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Cache<String, Bucket> loginBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();

    private final Cache<String, Bucket> registerBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();

    private final Cache<String, Bucket> generalBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();

    private final Cache<String, Bucket> lookupBuckets = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofMinutes(10))
            .maximumSize(100_000)
            .build();

    // Limity
    private static final int LOGIN_LIMIT = 5; // 5 prób logowania
    private static final int REGISTER_LIMIT = 3; // 3 próby rejestracji
    private static final int GENERAL_LIMIT = 100; // 100 zapytań ogólnych
    private static final Duration REFILL_DURATION = Duration.ofMinutes(1);
    private static final int LOOKUP_LIMIT = 5; // 5 zapytań wyszukiwania

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String clientIP = getClientIP(request);
        String path = request.getRequestURI();
        String method = request.getMethod();

        Bucket bucket;
        String limitType;

        // Wybierz odpowiedni bucket w zależności od endpointu
        if (path.contains("/auth/login") && "POST".equals(method)) {
            bucket = loginBuckets.get(clientIP, this::createLoginBucket);
            limitType = "login";
        } else if (path.contains("/auth/register") && "POST".equals(method)) {
            bucket = registerBuckets.get(clientIP, this::createRegisterBucket);
            limitType = "register";
        } else if (path.contains("/users/lookup") && "GET".equals(method)) {
            bucket = lookupBuckets.get(clientIP, this::createLookupBucket);
            limitType = "lookup";
        } else {
            bucket = generalBuckets.get(clientIP, this::createGeneralBucket);
            limitType = "general";
        }

        // Sprawdź czy jest dostępny token
        if (bucket.tryConsume(1)) {
            // Dodaj nagłówki informacyjne o limitach
            response.setHeader("X-Rate-Limit-Remaining", String.valueOf(bucket.getAvailableTokens()));
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("X-Rate-Limit-Remaining", "0");
            response.setHeader("Retry-After", "60");
            response.getWriter()
                    .write("{\"message\": \"Zbyt wiele prób. Spróbuj ponownie za 60 sekund.\", \"retryAfter\": 60}");
            return;
        }
    }

    /**
     * Bucket dla logowania - 5 prób, odnowienie WSZYSTKICH po 1 minucie
     * (nie stopniowe uzupełnianie, tylko pełny reset po czasie)
     */
    private Bucket createLoginBucket(String key) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(LOGIN_LIMIT)
                        .refillIntervally(LOGIN_LIMIT, REFILL_DURATION) // Wszystkie 5 tokenów po minucie
                        .build())
                .build();
    }

    /**
     * Bucket dla rejestracji - 3 próby, odnowienie po 1 minucie
     */
    private Bucket createRegisterBucket(String key) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(REGISTER_LIMIT)
                        .refillIntervally(REGISTER_LIMIT, REFILL_DURATION)
                        .build())
                .build();
    }

    /**
     * Bucket dla ogólnych zapytań - 100 na minutę (stopniowe uzupełnianie OK)
     */
    private Bucket createGeneralBucket(String key) {
        return Bucket.builder()
                .addLimit(Bandwidth.simple(GENERAL_LIMIT, REFILL_DURATION))
                .build();
    }

    /**
     * Bucket dla wyszukiwania użytkownika - 5 na minutę
     */
    private Bucket createLookupBucket(String key) {
        return Bucket.builder()
                .addLimit(Bandwidth.simple(5, Duration.ofMinutes(1)))
                .build();
    }

    /**
     * Pobierz IP klienta (uwzględniając proxy/load balancer)
     */
    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // X-Forwarded-For może zawierać wiele IP, pierwszy to oryginalny klient
            String clientIP = xForwardedFor.split(",")[0].trim();
            if (isValidIP(clientIP)) {
                return clientIP;
            }
        }

        String xRealIP = request.getHeader("X-Real-IP");
        if (xRealIP != null && !xRealIP.isEmpty() && isValidIP(xRealIP)) {
            return xRealIP;
        }

        return request.getRemoteAddr();
    }

    private boolean isValidIP(String ip) {
        if (ip == null || ip.isEmpty()) {
            return false;
        }

        // Blokuj oczywiste próby injection
        if (ip.contains("..") || ip.contains(" ") || ip.contains(";") ||
                ip.contains("'") || ip.contains("\"") || ip.contains("<") || ip.contains(">")) {
            return false;
        }

        final String IPV4_REGEX = "^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\." +
                "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\." +
                "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\." +
                "(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$";

        final String IPV6_REGEX = "^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$";

        return ip.matches(IPV4_REGEX) || ip.matches(IPV6_REGEX);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Nie filtruj statycznych zasobów i swagger
        return path.startsWith("/swagger") ||
                path.startsWith("/v3/api-docs") ||
                path.startsWith("/static");
    }
}
