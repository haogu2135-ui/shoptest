package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import java.util.regex.Pattern;

@Service
@Slf4j
public class CircuitBreakerService {
    private static final int MAX_NAME_LENGTH = 80;
    private static final Pattern UUID_PATTERN = Pattern.compile("\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b");
    private static final Pattern LONG_HEX_PATTERN = Pattern.compile("\\b[0-9a-f]{16,}\\b");
    private static final Pattern ORDER_NUMBER_PATTERN = Pattern.compile("\\bso\\d{10,}[0-9a-z]*\\b");
    private static final Pattern NUMERIC_ID_PATTERN = Pattern.compile("\\b\\d{4,}\\b");

    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<String, Circuit> circuits = new ConcurrentHashMap<>();
    private final AtomicLong touchSequence = new AtomicLong();

    public CircuitBreakerService(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public <T> T execute(String name, Supplier<T> supplier) {
        Config config = config();
        if (!config.enabled) {
            return supplier.get();
        }
        String circuitName = normalizeName(name);
        Circuit circuit = circuits.computeIfAbsent(circuitName, ignored -> new Circuit(Instant.now().toEpochMilli(), touchSequence.incrementAndGet()));
        enforceMaxCircuits(config.maxCircuits, circuitName);
        beforeCall(circuitName, circuit);
        try {
            T result = supplier.get();
            onSuccess(circuit);
            return result;
        } catch (RuntimeException e) {
            onFailure(circuit, e);
            throw e;
        }
    }

    public void reset(String name) {
        if (name == null || name.trim().isEmpty()) {
            circuits.clear();
            return;
        }
        circuits.remove(normalizeName(name));
    }

    public String normalizeName(String name) {
        if (name == null) {
            return "default";
        }
        String trimmedName = name.trim();
        if (trimmedName.isEmpty()) return "default";
        String normalized = trimmedName.toLowerCase(Locale.ROOT);
        normalized = UUID_PATTERN.matcher(normalized).replaceAll("id");
        normalized = LONG_HEX_PATTERN.matcher(normalized).replaceAll("id");
        normalized = ORDER_NUMBER_PATTERN.matcher(normalized).replaceAll("order-no");
        normalized = NUMERIC_ID_PATTERN.matcher(normalized).replaceAll("id");
        normalized = replaceNameSeparators(normalized);
        String[] segments = normalized.split("-");
        StringBuilder compactName = new StringBuilder(normalized.length());
        for (String segment : segments) {
            if (segment.isEmpty()) continue;
            if (compactName.length() > 0) compactName.append('-');
            compactName.append(normalizeSegment(segment));
        }
        normalized = compactName.toString();
        if (normalized.isEmpty()) {
            return "default";
        }
        if (normalized.length() <= MAX_NAME_LENGTH) return normalized;
        return trimTrailingSeparators(normalized.substring(0, MAX_NAME_LENGTH));
    }

    public List<TrafficControlStatusResponse.CircuitStatus> status() {
        Config config = config();
        enforceMaxCircuits(config.maxCircuits, null);
        List<Map.Entry<String, Circuit>> entries = new ArrayList<>(circuits.entrySet());
        entries.sort(Comparator.comparing(Map.Entry::getKey));
        List<TrafficControlStatusResponse.CircuitStatus> statuses = new ArrayList<>(entries.size());
        for (Map.Entry<String, Circuit> entry : entries) {
            statuses.add(toStatus(entry.getKey(), entry.getValue(), config));
        }
        return statuses;
    }

    public TrafficControlStatusResponse.CircuitBreakerConfig configStatus() {
        Config config = config();
        TrafficControlStatusResponse.CircuitBreakerConfig response = new TrafficControlStatusResponse.CircuitBreakerConfig();
        response.setEnabled(config.enabled);
        response.setFailureThreshold(config.failureThreshold);
        response.setOpenSeconds(config.openSeconds);
        response.setHalfOpenSuccessThreshold(config.halfOpenSuccessThreshold);
        response.setMaxCircuits(config.maxCircuits);
        return response;
    }

    private void beforeCall(String name, Circuit circuit) {
        synchronized (circuit) {
            long now = Instant.now().toEpochMilli();
            touch(circuit, now);
            if (circuit.state == State.OPEN && now >= circuit.openedUntilMillis) {
                circuit.state = State.HALF_OPEN;
                circuit.halfOpenSuccessCount = 0;
            }
            if (circuit.state == State.OPEN) {
                long retryAfterSeconds = Math.max(1, (circuit.openedUntilMillis - now + 999) / 1000);
                throw new IllegalStateException("Circuit breaker is open for " + name + ", retry after " + retryAfterSeconds + "s");
            }
        }
    }

    private void onSuccess(Circuit circuit) {
        Config config = config();
        synchronized (circuit) {
            touch(circuit, Instant.now().toEpochMilli());
            if (circuit.state == State.HALF_OPEN) {
                circuit.halfOpenSuccessCount++;
                if (circuit.halfOpenSuccessCount >= config.halfOpenSuccessThreshold) {
                    circuit.state = State.CLOSED;
                    circuit.failureCount = 0;
                    circuit.halfOpenSuccessCount = 0;
                    circuit.lastFailureMessage = null;
                    circuit.openedUntilMillis = 0;
                }
                return;
            }
            circuit.failureCount = 0;
            circuit.lastFailureMessage = null;
        }
    }

    private void onFailure(Circuit circuit, RuntimeException e) {
        Config config = config();
        synchronized (circuit) {
            long now = Instant.now().toEpochMilli();
            touch(circuit, now);
            circuit.failureCount++;
            circuit.halfOpenSuccessCount = 0;
            circuit.lastFailureMessage = sanitize(e.getMessage());
            if (circuit.failureCount >= config.failureThreshold || circuit.state == State.HALF_OPEN) {
                circuit.state = State.OPEN;
                circuit.openedUntilMillis = Instant.ofEpochMilli(now).plusSeconds(config.openSeconds).toEpochMilli();
            }
        }
    }

    private TrafficControlStatusResponse.CircuitStatus toStatus(String name, Circuit circuit, Config config) {
        synchronized (circuit) {
            long now = Instant.now().toEpochMilli();
            if (circuit.state == State.OPEN && now >= circuit.openedUntilMillis) {
                circuit.state = State.HALF_OPEN;
                circuit.halfOpenSuccessCount = 0;
            }
            TrafficControlStatusResponse.CircuitStatus status = new TrafficControlStatusResponse.CircuitStatus();
            status.setName(name);
            status.setState(circuit.state.name());
            status.setFailureCount(circuit.failureCount);
            status.setHalfOpenSuccessCount(circuit.halfOpenSuccessCount);
            status.setOpenedUntil(circuit.openedUntilMillis > 0 ? Instant.ofEpochMilli(circuit.openedUntilMillis).toString() : null);
            status.setLastFailureMessage(circuit.lastFailureMessage);
            return status;
        }
    }

    private Config config() {
        return new Config(
                runtimeConfig.getBoolean("traffic.circuit-breaker.enabled", true),
                Math.max(1, runtimeConfig.getInt("traffic.circuit-breaker.failure-threshold", 5)),
                Math.max(1, runtimeConfig.getInt("traffic.circuit-breaker.open-seconds", 30)),
                Math.max(1, runtimeConfig.getInt("traffic.circuit-breaker.half-open-success-threshold", 2)),
                Math.max(1, Math.min(10000, runtimeConfig.getInt("traffic.circuit-breaker.max-circuits", 200)))
        );
    }

    private void enforceMaxCircuits(int maxCircuits, String preserveName) {
        int overflow = circuits.size() - maxCircuits;
        if (overflow <= 0) {
            return;
        }
        evictCircuits(overflow, preserveName, true);
        overflow = circuits.size() - maxCircuits;
        if (overflow > 0) {
            evictCircuits(overflow, preserveName, false);
        }
    }

    private void evictCircuits(int limit, String preserveName, boolean closedOnly) {
        List<Map.Entry<String, Circuit>> candidates = new ArrayList<>();
        for (Map.Entry<String, Circuit> entry : circuits.entrySet()) {
            if (preserveName != null && entry.getKey().equals(preserveName)) continue;
            if (closedOnly && !isClosed(entry.getValue())) continue;
            candidates.add(entry);
        }
        candidates.sort(Comparator
                .comparingLong((Map.Entry<String, Circuit> entry) -> lastTouchedSequence(entry.getValue()))
                .thenComparing(Map.Entry::getKey));
        int count = Math.min(limit, candidates.size());
        for (int index = 0; index < count; index++) {
            Map.Entry<String, Circuit> entry = candidates.get(index);
            circuits.remove(entry.getKey(), entry.getValue());
        }
    }

    private boolean isClosed(Circuit circuit) {
        synchronized (circuit) {
            return circuit.state == State.CLOSED;
        }
    }

    private long lastTouchedMillis(Circuit circuit) {
        synchronized (circuit) {
            return circuit.lastTouchedMillis;
        }
    }

    private long lastTouchedSequence(Circuit circuit) {
        synchronized (circuit) {
            return circuit.lastTouchedSequence;
        }
    }

    private void touch(Circuit circuit, long nowMillis) {
        circuit.lastTouchedMillis = nowMillis;
        circuit.lastTouchedSequence = touchSequence.incrementAndGet();
    }

    private String normalizeSegment(String segment) {
        return segment.length() > 40 ? "token" : segment;
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "Request failed";
        }
        StringBuilder normalizedBuilder = new StringBuilder(value.length());
        boolean controlPending = false;
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (Character.isISOControl(character)) {
                controlPending = true;
                continue;
            }
            if (controlPending && normalizedBuilder.length() > 0) normalizedBuilder.append(' ');
            controlPending = false;
            normalizedBuilder.append(character);
        }
        String normalized = normalizedBuilder.toString().trim();
        return normalized.length() > 240 ? normalized.substring(0, 240) : normalized;
    }

    private String replaceNameSeparators(String value) {
        StringBuilder normalized = new StringBuilder(value.length());
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if ((character >= 'a' && character <= 'z') || (character >= '0' && character <= '9')) {
                normalized.append(character);
            } else if (normalized.length() > 0 && normalized.charAt(normalized.length() - 1) != '-') {
                normalized.append('-');
            }
        }
        return normalized.toString();
    }

    private String trimTrailingSeparators(String value) {
        int end = value.length();
        while (end > 0 && value.charAt(end - 1) == '-') end--;
        return value.substring(0, end);
    }

    private enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private static class Circuit {
        private State state = State.CLOSED;
        private int failureCount;
        private int halfOpenSuccessCount;
        private long openedUntilMillis;
        private long lastTouchedMillis;
        private long lastTouchedSequence;
        private String lastFailureMessage;

        private Circuit(long nowMillis, long touchSequence) {
            this.lastTouchedMillis = nowMillis;
            this.lastTouchedSequence = touchSequence;
        }
    }

    private static class Config {
        private final boolean enabled;
        private final int failureThreshold;
        private final int openSeconds;
        private final int halfOpenSuccessThreshold;
        private final int maxCircuits;

        private Config(boolean enabled, int failureThreshold, int openSeconds, int halfOpenSuccessThreshold, int maxCircuits) {
            this.enabled = enabled;
            this.failureThreshold = failureThreshold;
            this.openSeconds = openSeconds;
            this.halfOpenSuccessThreshold = halfOpenSuccessThreshold;
            this.maxCircuits = maxCircuits;
        }
    }
}
