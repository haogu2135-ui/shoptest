package com.example.shop.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import javax.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

/**
 * Tracks signed webhook acceptances for commercial ship-bar evidence.
 * Sanitized: no secrets/payloads; only channel, counts, timestamps, coarse source class.
 */
@Service
public class PaymentWebhookEvidenceService {
    public static final String CHANNEL_STRIPE = "STRIPE";
    public static final String CHANNEL_MERCADO = "MERCADO_PAGO";

    public static final String SOURCE_PROVIDER_LIKE = "PROVIDER_LIKE";
    public static final String SOURCE_SIGNED_LOCAL = "SIGNED_LOCAL";
    public static final String SOURCE_UNKNOWN = "UNKNOWN";

    private final ConcurrentHashMap<String, ChannelEvidence> channels = new ConcurrentHashMap<>();

    public void recordSuccess(String channel, HttpServletRequest request) {
        if (channel == null || channel.isBlank()) {
            return;
        }
        String normalized = channel.trim().toUpperCase(Locale.ROOT);
        String sourceClass = classifySource(request);
        channels.compute(normalized, (key, existing) -> {
            ChannelEvidence evidence = existing == null ? new ChannelEvidence() : existing;
            evidence.successCount.incrementAndGet();
            evidence.lastSuccessAt = Instant.now();
            evidence.lastSourceClass = sourceClass;
            if (request != null) {
                String ua = request.getHeader("User-Agent");
                if (ua != null && !ua.isBlank()) {
                    evidence.lastUserAgentClass = classifyUserAgent(ua);
                }
            }
            return evidence;
        });
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stripe", toMap(channels.get(CHANNEL_STRIPE)));
        out.put("mercadoPago", toMap(channels.get(CHANNEL_MERCADO)));
        out.put("anyProviderLikeSuccess", hasProviderLikeSuccess());
        out.put("generatedAt", Instant.now().toString());
        return out;
    }

    public boolean hasProviderLikeSuccess() {
        return channels.values().stream().anyMatch(e -> e != null && SOURCE_PROVIDER_LIKE.equals(e.lastSourceClass));
    }

    private Map<String, Object> toMap(ChannelEvidence evidence) {
        Map<String, Object> row = new LinkedHashMap<>();
        if (evidence == null) {
            row.put("successCount", 0);
            row.put("lastSuccessAt", null);
            row.put("lastSourceClass", null);
            row.put("lastUserAgentClass", null);
            return row;
        }
        row.put("successCount", evidence.successCount.get());
        row.put("lastSuccessAt", evidence.lastSuccessAt == null ? null : evidence.lastSuccessAt.toString());
        row.put("lastSourceClass", evidence.lastSourceClass);
        row.put("lastUserAgentClass", evidence.lastUserAgentClass);
        return row;
    }

    private String classifySource(HttpServletRequest request) {
        if (request == null) {
            return SOURCE_UNKNOWN;
        }
        String ua = request.getHeader("User-Agent");
        String uaClass = classifyUserAgent(ua);
        String remote = firstNonBlank(request.getHeader("CF-Connecting-IP"),
                request.getHeader("X-Forwarded-For"),
                request.getRemoteAddr());
        boolean loopback = isLoopback(remote);
        if ("STRIPE".equals(uaClass) || "MERCADO_PAGO".equals(uaClass)) {
            return SOURCE_PROVIDER_LIKE;
        }
        if (loopback) {
            return SOURCE_SIGNED_LOCAL;
        }
        // Non-loopback signed acceptance without known provider UA still counts as provider-like traffic.
        return SOURCE_PROVIDER_LIKE;
    }

    private String classifyUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "UNKNOWN";
        }
        String lower = userAgent.toLowerCase(Locale.ROOT);
        if (lower.contains("stripe")) {
            return "STRIPE";
        }
        if (lower.contains("mercadopago") || lower.contains("mercado-pago") || lower.contains("mercado pago")) {
            return "MERCADO_PAGO";
        }
        return "OTHER";
    }

    private boolean isLoopback(String remote) {
        if (remote == null || remote.isBlank()) {
            return true;
        }
        String first = remote.split(",")[0].trim();
        return "127.0.0.1".equals(first)
                || "0:0:0:0:0:0:0:1".equals(first)
                || "::1".equals(first)
                || first.startsWith("127.")
                || "localhost".equalsIgnoreCase(first);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static final class ChannelEvidence {
        private final AtomicLong successCount = new AtomicLong();
        private volatile Instant lastSuccessAt;
        private volatile String lastSourceClass;
        private volatile String lastUserAgentClass;
    }
}
