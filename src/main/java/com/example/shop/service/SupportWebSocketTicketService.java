package com.example.shop.service;

import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupportWebSocketTicketService {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TICKET_BYTES = 32;
    private static final long DEFAULT_TICKET_TTL_MS = 60_000L;
    private static final long MIN_TICKET_TTL_MS = 5_000L;
    private static final long MAX_TICKET_TTL_MS = 300_000L;

    private final RuntimeConfigService runtimeConfig;
    private final JwtService jwtService;
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    public Ticket issue(UserDetailsImpl user, String authorizationHeader) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException("Authenticated user is required");
        }
        long now = System.currentTimeMillis();
        cleanupExpired(now);
        long ttlMs = ticketTtlMs();
        String value = newTicketValue();
        Ticket ticket = new Ticket(value, user.getId(), tokenJtiFrom(authorizationHeader), now + ttlMs);
        tickets.put(value, ticket);
        return ticket;
    }

    public Ticket consume(String value) {
        String normalized = normalizeTicket(value);
        if (normalized == null) {
            return null;
        }
        long now = System.currentTimeMillis();
        Ticket ticket = tickets.remove(normalized);
        if (ticket == null || ticket.isExpired(now)) {
            return null;
        }
        return ticket;
    }

    int pendingTicketCount() {
        cleanupExpired(System.currentTimeMillis());
        return tickets.size();
    }

    private void cleanupExpired(long now) {
        tickets.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }

    private long ticketTtlMs() {
        long configured = runtimeConfig == null
                ? DEFAULT_TICKET_TTL_MS
                : runtimeConfig.getLong("support.websocket.ticket-ttl-ms", DEFAULT_TICKET_TTL_MS);
        return Math.max(MIN_TICKET_TTL_MS, Math.min(configured, MAX_TICKET_TTL_MS));
    }

    private String newTicketValue() {
        byte[] bytes = new byte[TICKET_BYTES];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String tokenJtiFrom(String authorizationHeader) {
        String token = bearerToken(authorizationHeader);
        if (token == null) {
            return null;
        }
        try {
            return jwtService.extractJti(token);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String bearerToken(String authorizationHeader) {
        if (authorizationHeader == null || authorizationHeader.isBlank()) {
            return null;
        }
        String normalized = authorizationHeader.trim();
        if (normalized.startsWith("Bearer ")) {
            normalized = normalized.substring(7).trim();
        }
        return normalized.isBlank() ? null : normalized;
    }

    private String normalizeTicket(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    public static final class Ticket {
        private final String value;
        private final Long userId;
        private final String tokenJti;
        private final long expiresAtMillis;

        public Ticket(String value, Long userId, String tokenJti, long expiresAtMillis) {
            this.value = value;
            this.userId = userId;
            this.tokenJti = tokenJti;
            this.expiresAtMillis = expiresAtMillis;
        }

        public String getValue() {
            return value;
        }

        public Long getUserId() {
            return userId;
        }

        public String getTokenJti() {
            return tokenJti;
        }

        public long getExpiresAtMillis() {
            return expiresAtMillis;
        }

        public long expiresInMillis(long now) {
            return Math.max(0L, expiresAtMillis - now);
        }

        private boolean isExpired(long now) {
            return expiresAtMillis <= now;
        }
    }
}
