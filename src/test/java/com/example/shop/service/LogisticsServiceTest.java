package com.example.shop.service;

import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LogisticsServiceTest {
    private LogisticsService service;
    private RuntimeConfigService runtimeConfig;

    @BeforeEach
    void setUp() {
        service = new LogisticsService();
        runtimeConfig = mock(RuntimeConfigService.class);
        ReflectionTestUtils.setField(service, "orderRepository", mock(OrderRepository.class));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        when(runtimeConfig.getInt("logistics.tracking-number-max-chars", 120)).thenReturn(16);
        when(runtimeConfig.getInt("logistics.carrier-max-chars", 40)).thenReturn(8);
        when(runtimeConfig.getBoolean("kuaidi100.enabled", true)).thenReturn(false);
        when(runtimeConfig.getString("logistics.api-url", "")).thenReturn("");
    }

    @Test
    void normalizesTrackingNumberAndCarrierBeforeQuerying() {
        LogisticsTrackResponse response = service.track("  1Z\t999\nCN\u0000  ", "  DHL\tCN  ");

        assertEquals("1Z 999 CN", response.getTrackingNumber());
        assertEquals("DHL CN", response.getCarrier());
    }

    @Test
    void defaultsBlankCarrierToStandard() {
        LogisticsTrackResponse response = service.track("TN123", "  \n\t ");

        assertEquals("STANDARD", response.getCarrier());
    }

    @Test
    void rejectsMissingTrackingNumber() {
        assertThrows(IllegalArgumentException.class, () -> service.track(" \n\t\u0000 ", "DHL"));
    }

    @Test
    void rejectsOverlongTrackingNumber() {
        assertThrows(IllegalArgumentException.class, () -> service.track("T".repeat(17), "DHL"));
    }

    @Test
    void rejectsOverlongCarrier() {
        assertThrows(IllegalArgumentException.class, () -> service.track("TN123", "C".repeat(9)));
    }
}
