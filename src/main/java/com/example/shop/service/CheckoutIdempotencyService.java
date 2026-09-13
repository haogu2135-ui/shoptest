package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@Slf4j
public class CheckoutIdempotencyService {
    private static final int MAX_KEY_LENGTH = 120;
    private static final Pattern IDEMPOTENCY_KEY_PATTERN = Pattern.compile("[A-Za-z0-9._:-]+");
    private static final String INSERT_CLAIM_SQL = "INSERT INTO checkout_idempotency_keys "
            + "(checkout_scope, principal, idempotency_key, request_fingerprint, status, created_at, updated_at) "
            + "VALUES (?, ?, ?, ?, 'PROCESSING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";
    private static final String COMPLETE_CLAIM_SQL = "UPDATE checkout_idempotency_keys "
            + "SET order_id = ?, status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP "
            + "WHERE checkout_scope = ? AND principal = ? AND idempotency_key = ?";
    private static final String FIND_CLAIM_SQL = "SELECT order_id, request_fingerprint, status FROM checkout_idempotency_keys "
            + "WHERE checkout_scope = ? AND principal = ? AND idempotency_key = ? LIMIT 1";

    private final JdbcTemplate jdbcTemplate;

    public CheckoutIdempotencyService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Claim claim(String scope, String principal, String idempotencyKey, String requestFingerprint) {
        String normalizedKey = normalizeIdempotencyKey(idempotencyKey);
        if (normalizedKey == null) {
            return Claim.notIdempotent();
        }
        String normalizedScope = normalizeRequired(scope, "Idempotency scope").toUpperCase(Locale.ROOT);
        String normalizedPrincipal = normalizeRequired(principal, "Idempotency principal");
        String normalizedFingerprint = normalizeRequired(requestFingerprint, "Idempotency fingerprint");
        try {
            jdbcTemplate.update(INSERT_CLAIM_SQL,
                    normalizedScope,
                    normalizedPrincipal,
                    normalizedKey,
                    normalizedFingerprint);
            return Claim.owner(normalizedScope, normalizedPrincipal, normalizedKey);
        } catch (DataIntegrityViolationException duplicate) {
            return claimExisting(normalizedScope, normalizedPrincipal, normalizedKey, normalizedFingerprint, duplicate);
        }
    }

    public void complete(Claim claim, Long orderId) {
        if (claim == null || !claim.isOwner() || orderId == null || orderId <= 0) {
            return;
        }
        jdbcTemplate.update(COMPLETE_CLAIM_SQL,
                orderId,
                claim.getScope(),
                claim.getPrincipal(),
                claim.getIdempotencyKey());
    }

    private Claim claimExisting(String scope,
                                String principal,
                                String idempotencyKey,
                                String requestFingerprint,
                                DataIntegrityViolationException duplicate) {
        List<ExistingClaim> existing = jdbcTemplate.query(
                FIND_CLAIM_SQL,
                (rs, rowNum) -> new ExistingClaim(
                        rs.getObject("order_id") == null ? null : rs.getLong("order_id"),
                        rs.getString("request_fingerprint"),
                        rs.getString("status")),
                scope,
                principal,
                idempotencyKey);
        if (existing.isEmpty()) {
            throw duplicate;
        }
        ExistingClaim row = existing.get(0);
        if (!Objects.equals(row.getRequestFingerprint(), requestFingerprint)) {
            throw new IllegalArgumentException("Idempotency-Key was already used for a different checkout request");
        }
        if (row.getOrderId() != null && row.getOrderId() > 0) {
            return Claim.existingOrder(row.getOrderId());
        }
        throw new IllegalStateException("Checkout is already being processed. Please wait before retrying.");
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        if (idempotencyKey == null) {
            return null;
        }
        String trimmed = idempotencyKey.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_KEY_LENGTH || !IDEMPOTENCY_KEY_PATTERN.matcher(trimmed).matches()) {
            throw new IllegalArgumentException("Invalid Idempotency-Key");
        }
        return trimmed;
    }

    private String normalizeRequired(String value, String label) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(label + " is required");
        }
        return normalized;
    }

    private static class ExistingClaim {
        private final Long orderId;
        private final String requestFingerprint;
        private final String status;

        ExistingClaim(Long orderId, String requestFingerprint, String status) {
            this.orderId = orderId;
            this.requestFingerprint = requestFingerprint;
            this.status = status;
        }

        Long getOrderId() {
            return orderId;
        }

        String getRequestFingerprint() {
            return requestFingerprint;
        }

        @SuppressWarnings("unused")
        String getStatus() {
            return status;
        }
    }

    public static class Claim {
        private final boolean owner;
        private final Long existingOrderId;
        private final String scope;
        private final String principal;
        private final String idempotencyKey;

        private Claim(boolean owner, Long existingOrderId, String scope, String principal, String idempotencyKey) {
            this.owner = owner;
            this.existingOrderId = existingOrderId;
            this.scope = scope;
            this.principal = principal;
            this.idempotencyKey = idempotencyKey;
        }

        static Claim notIdempotent() {
            return new Claim(false, null, null, null, null);
        }

        static Claim owner(String scope, String principal, String idempotencyKey) {
            return new Claim(true, null, scope, principal, idempotencyKey);
        }

        static Claim existingOrder(Long orderId) {
            return new Claim(false, orderId, null, null, null);
        }

        public boolean isOwner() {
            return owner;
        }

        public boolean hasExistingOrder() {
            return existingOrderId != null && existingOrderId > 0;
        }

        public Long getExistingOrderId() {
            return existingOrderId;
        }

        String getScope() {
            return scope;
        }

        String getPrincipal() {
            return principal;
        }

        String getIdempotencyKey() {
            return idempotencyKey;
        }
    }
}
