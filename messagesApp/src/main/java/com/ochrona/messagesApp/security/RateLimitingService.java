package com.ochrona.messagesApp.security;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiter do ograniczenia liczby żądań z jednego IP
 * Zabezpieczenie przed atakami brute-force
 */
@Component
@Slf4j
public class RateLimitingService {

    private static final int MAX_REQUESTS_PER_MINUTE = 20;
    private static final Duration TIME_WINDOW = Duration.ofMinutes(1);

    private final Map<String, RequestInfo> requestCounts = new ConcurrentHashMap<>();

    /**
     * Sprawdza czy żądanie może być przetworzone
     */
    public boolean allowRequest(HttpServletRequest request) {
        String clientIp = getClientIP(request);
        String key = clientIp + ":" + request.getRequestURI();

        RequestInfo info = requestCounts.computeIfAbsent(key, k -> new RequestInfo());

        synchronized (info) {
            Instant now = Instant.now();

            // Reset jeśli minął okres czasu
            if (Duration.between(info.windowStart, now).compareTo(TIME_WINDOW) > 0) {
                info.count = 0;
                info.windowStart = now;
            }

            info.count++;

            if (info.count > MAX_REQUESTS_PER_MINUTE) {
                log.warn("Rate limit exceeded for IP: {} on endpoint: {}", clientIp, request.getRequestURI());
                return false;
            }

            return true;
        }
    }

    private String getClientIP(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static class RequestInfo {
        int count = 0;
        Instant windowStart = Instant.now();
    }

    /**
     * Czyszczenie starych wpisów (można uruchomić jako scheduled task)
     */
    public void cleanup() {
        Instant threshold = Instant.now().minus(TIME_WINDOW.multipliedBy(2));
        requestCounts.entrySet().removeIf(entry -> Duration.between(entry.getValue().windowStart, Instant.now())
                .compareTo(TIME_WINDOW.multipliedBy(2)) > 0);
    }
}
