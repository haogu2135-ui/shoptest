package com.example.shop.service;

import com.example.shop.entity.SecurityAuditLog;
import com.example.shop.repository.SecurityAuditLogMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Builds sanitized, restart-safe webhook acceptance evidence from the security audit trail.
 */
@Service
public class PaymentWebhookEvidenceService {
    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookEvidenceService.class);
    public static final String CHANNEL_STRIPE = "STRIPE";
    public static final String CHANNEL_MERCADO = "MERCADO_PAGO";

    public static final String SOURCE_PROVIDER_LIKE = "PROVIDER_LIKE";
    public static final String SOURCE_SIGNED_LOCAL = "SIGNED_LOCAL";
    public static final String SOURCE_UNKNOWN = "UNKNOWN";

    private static final String ACTION_STRIPE = "STRIPE_WEBHOOK";
    private static final String ACTION_MERCADO = "MERCADO_PAGO_WEBHOOK";

    private final SecurityAuditLogMapper auditLogMapper;
    private final ClientIpResolver clientIpResolver;

    public PaymentWebhookEvidenceService(SecurityAuditLogMapper auditLogMapper,
                                         ClientIpResolver clientIpResolver) {
        this.auditLogMapper = auditLogMapper;
        this.clientIpResolver = clientIpResolver;
    }

    public String sourceMetadata(HttpServletRequest request) {
        String userAgentClass = classifyUserAgent(request == null ? null : request.getHeader("User-Agent"));
        String sourceClass = classifySource(request);
        return "sourceClass=" + sourceClass + ",userAgentClass=" + userAgentClass;
    }

    public Map<String, Object> snapshot() {
        Map<String, Object> out = new LinkedHashMap<>();
        try {
            out.put("stripe", channelSnapshot(ACTION_STRIPE));
            out.put("mercadoPago", channelSnapshot(ACTION_MERCADO));
            out.put("anyProviderLikeSuccess", hasProviderLikeSuccess());
            out.put("available", true);
            out.put("evidenceStore", "PERSISTENT_AUDIT_LOG");
        } catch (RuntimeException e) {
            log.error("Persistent payment webhook evidence read failed", e);
            out.put("stripe", emptyChannel());
            out.put("mercadoPago", emptyChannel());
            out.put("anyProviderLikeSuccess", false);
            out.put("available", false);
            out.put("evidenceStore", "UNAVAILABLE");
        }
        out.put("generatedAt", Instant.now().toString());
        return out;
    }

    public boolean hasProviderLikeSuccess() {
        return auditLogMapper.countProviderLikeWebhookSuccess() > 0;
    }

    private Map<String, Object> channelSnapshot(String action) {
        long count = Math.max(0L, auditLogMapper.countWebhookSuccess(action));
        SecurityAuditLog latest = auditLogMapper.findLatestWebhookSuccess(action);
        if (latest == null) {
            return emptyChannel(count);
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("successCount", count);
        row.put("lastSuccessAt", latest.getCreatedAt() == null ? null : latest.getCreatedAt().toString());
        row.put("lastSourceClass", sourceClassFrom(latest));
        row.put("lastUserAgentClass", userAgentClassFrom(latest));
        return row;
    }

    private Map<String, Object> emptyChannel() {
        return emptyChannel(0L);
    }

    private Map<String, Object> emptyChannel(long count) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("successCount", count);
        row.put("lastSuccessAt", null);
        row.put("lastSourceClass", null);
        row.put("lastUserAgentClass", null);
        return row;
    }

    private String sourceClassFrom(SecurityAuditLog log) {
        String stored = metadataValue(log == null ? null : log.getMetadata(), "sourceClass");
        if (stored != null) {
            return stored;
        }
        return classifyStoredSource(log == null ? null : log.getIpAddress());
    }

    private String userAgentClassFrom(SecurityAuditLog log) {
        String stored = metadataValue(log == null ? null : log.getMetadata(), "userAgentClass");
        return stored == null ? classifyUserAgent(log == null ? null : log.getUserAgent()) : stored;
    }

    private String metadataValue(String metadata, String key) {
        if (metadata == null || metadata.isBlank() || key == null || key.isBlank()) {
            return null;
        }
        String prefix = key + "=";
        for (String part : metadata.split(",")) {
            String item = part == null ? "" : part.trim();
            if (item.startsWith(prefix) && item.length() > prefix.length()) {
                return item.substring(prefix.length()).trim();
            }
        }
        return null;
    }

    private String classifySource(HttpServletRequest request) {
        if (request == null) {
            return SOURCE_UNKNOWN;
        }
        return classifyStoredSource(clientIpResolver.resolve(request));
    }

    private String classifyStoredSource(String remoteAddress) {
        return isLocalAddress(remoteAddress) ? SOURCE_SIGNED_LOCAL : SOURCE_PROVIDER_LIKE;
    }

    private String classifyUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return SOURCE_UNKNOWN;
        }
        String lower = userAgent.toLowerCase(Locale.ROOT);
        if (lower.contains("stripe")) {
            return CHANNEL_STRIPE;
        }
        if (lower.contains("mercadopago") || lower.contains("mercado-pago") || lower.contains("mercado pago")) {
            return CHANNEL_MERCADO;
        }
        return "OTHER";
    }

    private boolean isLocalAddress(String value) {
        String normalized = clientIpResolver.normalizeIpAddress(value);
        if (normalized == null || normalized.isBlank()) {
            return true;
        }
        try {
            InetAddress address = InetAddress.getByName(normalized);
            if (address.isAnyLocalAddress()
                    || address.isLoopbackAddress()
                    || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress()) {
                return true;
            }
            byte[] bytes = address.getAddress();
            if (bytes.length == 4) {
                int first = bytes[0] & 0xff;
                int second = bytes[1] & 0xff;
                return first == 0
                        || first == 10
                        || first == 127
                        || (first == 100 && second >= 64 && second <= 127)
                        || (first == 169 && second == 254)
                        || (first == 172 && second >= 16 && second <= 31)
                        || (first == 192 && second == 168);
            }
            return bytes.length == 16 && (bytes[0] & 0xfe) == 0xfc;
        } catch (Exception ignored) {
            return true;
        }
    }
}
