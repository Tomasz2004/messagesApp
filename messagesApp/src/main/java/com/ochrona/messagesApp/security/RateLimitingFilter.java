package com.ochrona.messagesApp.security;

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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

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

    // Cache bucketów per IP - w produkcji użyć Redis
    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> generalBuckets = new ConcurrentHashMap<>();

    // Limity
    private static final int LOGIN_LIMIT = 5; // 5 prób logowania
    private static final int REGISTER_LIMIT = 3; // 3 próby rejestracji
    private static final int GENERAL_LIMIT = 100; // 100 zapytań ogólnych
    private static final Duration REFILL_DURATION = Duration.ofMinutes(1);

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
            bucket = loginBuckets.computeIfAbsent(clientIP, this::createLoginBucket);
            limitType = "login";
        } else if (path.contains("/auth/register") && "POST".equals(method)) {
            bucket = registerBuckets.computeIfAbsent(clientIP, this::createRegisterBucket);
            limitType = "register";
        } else {
            bucket = generalBuckets.computeIfAbsent(clientIP, this::createGeneralBucket);
            limitType = "general";
        }

        // Sprawdź czy jest dostępny token
        if (bucket.tryConsume(1)) {
            // Dodaj nagłówki informacyjne o limitach
            response.setHeader("X-Rate-Limit-Remaining", String.valueOf(bucket.getAvailableTokens()));
            filterChain.doFilter(request, response);
        } else {
            // Limit przekroczony - BLOKUJ request (nie przepuszczaj do kontrolera!)
            log.warn("Rate limit exceeded for IP: {} on {} endpoint", clientIP, limitType);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("X-Rate-Limit-Remaining", "0");
            response.setHeader("Retry-After", "60");
            response.getWriter()
                    .write("{\"message\": \"Zbyt wiele prób. Spróbuj ponownie za 60 sekund.\", \"retryAfter\": 60}");
            return; // WAŻNE: nie wywołuj filterChain.doFilter!
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
     * Pobierz IP klienta (uwzględniając proxy/load balancer)
     */
    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // X-Forwarded-For może zawierać wiele IP, pierwszy to oryginalny klient
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIP = request.getHeader("X-Real-IP");
        if (xRealIP != null && !xRealIP.isEmpty()) {
            return xRealIP;
        }

        return request.getRemoteAddr();
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
