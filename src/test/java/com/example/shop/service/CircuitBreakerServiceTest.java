package com.example.shop.service;

import com.example.shop.dto.TrafficControlStatusResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CircuitBreakerServiceTest {
    private RuntimeConfigService runtimeConfig;
    private CircuitBreakerService service;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        service = new CircuitBreakerService(runtimeConfig);
        when(runtimeConfig.getBoolean("traffic.circuit-breaker.enabled", true)).thenReturn(true);
        when(runtimeConfig.getInt("traffic.circuit-breaker.failure-threshold", 5)).thenReturn(2);
        when(runtimeConfig.getInt("traffic.circuit-breaker.open-seconds", 30)).thenReturn(30);
        when(runtimeConfig.getInt("traffic.circuit-breaker.half-open-success-threshold", 2)).thenReturn(2);
        when(runtimeConfig.getInt("traffic.circuit-breaker.max-circuits", 200)).thenReturn(200);
    }

    @Test
    void dynamicOrderNumbersShareOneCircuit() {
        assertThrows(IllegalStateException.class, () -> service.execute("payment-create-SO20260524123456ABC", () -> {
            throw new IllegalStateException("provider failed");
        }));
        assertThrows(IllegalStateException.class, () -> service.execute("payment-create-SO20260524999999XYZ", () -> {
            throw new IllegalStateException("provider failed again");
        }));

        List<TrafficControlStatusResponse.CircuitStatus> statuses = service.status();

        assertEquals(1, statuses.size());
        assertEquals("payment-create-order-no", statuses.get(0).getName());
        assertEquals("OPEN", statuses.get(0).getState());
        assertEquals(2, statuses.get(0).getFailureCount());
    }

    @Test
    void sanitizesCircuitNamesAndFailureMessagesForAdminStatus() {
        assertEquals("default", service.normalizeName("\r\n\t"));
        assertEquals("payment-id-token", service.normalizeName("Payment/550e8400-e29b-41d4-a716-446655440000/" + "x".repeat(96)));

        assertThrows(IllegalArgumentException.class, () -> service.execute("Payment\r\nCreate\t999999", () -> {
            throw new IllegalArgumentException("gateway\r\nsecret\tfailed");
        }));

        TrafficControlStatusResponse.CircuitStatus status = service.status().get(0);

        assertEquals("payment-create-id", status.getName());
        assertEquals("gateway secret failed", status.getLastFailureMessage());
        assertFalse(status.getName().contains("\n"));
        assertFalse(status.getLastFailureMessage().contains("\n"));
    }

    @Test
    void evictsOldClosedCircuitsWhenCircuitCapIsExceeded() {
        when(runtimeConfig.getInt("traffic.circuit-breaker.max-circuits", 200)).thenReturn(3);

        service.execute("payment-create-card", () -> "ok");
        service.execute("payment-create-wallet", () -> "ok");
        service.execute("logistics-provider", () -> "ok");
        service.execute("payment-geo-lookup", () -> "ok");

        TrafficControlStatusResponse.CircuitBreakerConfig config = service.configStatus();
        List<String> circuitNames = service.status().stream()
                .map(TrafficControlStatusResponse.CircuitStatus::getName)
                .collect(Collectors.toList());

        assertEquals(3, config.getMaxCircuits());
        assertEquals(3, circuitNames.size());
        assertFalse(circuitNames.contains("payment-create-card"));
        assertTrue(circuitNames.contains("payment-geo-lookup"));
    }
}
