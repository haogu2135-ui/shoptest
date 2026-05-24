package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;
import java.util.stream.Collectors;

@Service
public class CircuitBreakerService {
    private final RuntimeConfigService runtimeConfig;
    private final ConcurrentMap<String, Circuit> circuits = new ConcurrentHashMap<>();

    public CircuitBreakerService(RuntimeConfigService runtimeConfig) {
        this.runtimeConfig = runtimeConfig;
    }

    public <T> T execute(String name, Supplier<T> supplier) {
        if (!config().enabled) {
            return supplier.get();
        }
        Circuit circuit = circuits.computeIfAbsent(normalizeName(name), ignored -> new Circuit());
        beforeCall(name, circuit);
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

    public List<TrafficControlStatusResponse.CircuitStatus> status() {
        Config config = config();
        return circuits.entrySet().stream()
                .sorted(Comparator.comparing(entry -> entry.getKey()))
                .map(entry -> toStatus(entry.getKey(), entry.getValue(), config))
                .collect(Collectors.toList());
    }

    public TrafficControlStatusResponse.CircuitBreakerConfig configStatus() {
        Config config = config();
        TrafficControlStatusResponse.CircuitBreakerConfig response = new TrafficControlStatusResponse.CircuitBreakerConfig();
        response.setEnabled(config.enabled);
        response.setFailureThreshold(config.failureThreshold);
        response.setOpenSeconds(config.openSeconds);
        response.setHalfOpenSuccessThreshold(config.halfOpenSuccessThreshold);
        return response;
    }

    private void beforeCall(String name, Circuit circuit) {
        synchronized (circuit) {
            long now = Instant.now().toEpochMilli();
            if (circuit.state == State.OPEN && now >= circuit.openedUntilMillis) {
                circuit.state = State.HALF_OPEN;
                circuit.halfOpenSuccessCount = 0;
            }
            if (circuit.state == State.OPEN) {
                long retryAfterSeconds = Math.max(1, (circuit.openedUntilMillis - now + 999) / 1000);
                throw new IllegalStateException("Circuit breaker is open for " + normalizeName(name) + ", retry after " + retryAfterSeconds + "s");
            }
        }
    }

    private void onSuccess(Circuit circuit) {
        Config config = config();
        synchronized (circuit) {
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
            circuit.failureCount++;
            circuit.halfOpenSuccessCount = 0;
            circuit.lastFailureMessage = sanitize(e.getMessage());
            if (circuit.failureCount >= config.failureThreshold || circuit.state == State.HALF_OPEN) {
                circuit.state = State.OPEN;
                circuit.openedUntilMillis = Instant.now().plusSeconds(config.openSeconds).toEpochMilli();
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
                Math.max(1, runtimeConfig.getInt("traffic.circuit-breaker.half-open-success-threshold", 2))
        );
    }

    private String normalizeName(String name) {
        return name == null || name.trim().isEmpty() ? "default" : name.trim();
    }

    private String sanitize(String value) {
        if (value == null || value.isBlank()) {
            return "Request failed";
        }
        String normalized = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return normalized.length() > 240 ? normalized.substring(0, 240) : normalized;
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
        private String lastFailureMessage;
    }

    private static class Config {
        private final boolean enabled;
        private final int failureThreshold;
        private final int openSeconds;
        private final int halfOpenSuccessThreshold;

        private Config(boolean enabled, int failureThreshold, int openSeconds, int halfOpenSuccessThreshold) {
            this.enabled = enabled;
            this.failureThreshold = failureThreshold;
            this.openSeconds = openSeconds;
            this.halfOpenSuccessThreshold = halfOpenSuccessThreshold;
        }
    }
}
