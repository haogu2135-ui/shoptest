package com.example.shop.service;

import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class LogisticsServiceTest {
    private LogisticsService service;

    @BeforeEach
    void setUp() {
        service = new LogisticsService();
        ReflectionTestUtils.setField(service, "orderRepository", mock(OrderRepository.class));
        ReflectionTestUtils.setField(service, "logisticsApiUrl", "");
        ReflectionTestUtils.setField(service, "kuaidi100Enabled", false);
        ReflectionTestUtils.setField(service, "trackingNumberMaxChars", 16);
        ReflectionTestUtils.setField(service, "carrierMaxChars", 8);
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
