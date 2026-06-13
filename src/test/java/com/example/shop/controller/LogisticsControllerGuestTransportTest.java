package com.example.shop.controller;

import com.example.shop.dto.LogisticsTrackRequest;
import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.service.LogisticsService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LogisticsControllerGuestTransportTest {
    private final LogisticsService logisticsService = mock(LogisticsService.class);
    private final LogisticsController controller = new LogisticsController(logisticsService);

    @Test
    void guestTrackingUsesBodyCredentials() {
        LogisticsTrackRequest request = new LogisticsTrackRequest();
        request.setTrackingNumber("1Z999");
        request.setCarrier("UPS");
        request.setOrderId(42L);
        request.setGuestEmail("guest@example.com");
        request.setOrderNo("SO202605260001");
        LogisticsTrackResponse expected = new LogisticsTrackResponse();

        when(logisticsService.track("1Z999", "UPS", 42L, "guest@example.com", "SO202605260001", null))
                .thenReturn(expected);

        ResponseEntity<?> response = controller.trackWithGuestAccess(request, null);

        assertEquals(200, response.getStatusCodeValue());
        assertSame(expected, response.getBody());
        verify(logisticsService).track("1Z999", "UPS", 42L, "guest@example.com", "SO202605260001", null);
    }

    @Test
    void getTrackingDoesNotForwardGuestCredentials() {
        LogisticsTrackResponse expected = new LogisticsTrackResponse();
        when(logisticsService.track("1Z999", "UPS", 42L, null, null, null)).thenReturn(expected);

        ResponseEntity<?> response = controller.track("1Z999", "UPS", 42L, null);

        assertEquals(200, response.getStatusCodeValue());
        assertSame(expected, response.getBody());
        verify(logisticsService).track("1Z999", "UPS", 42L, null, null, null);
    }
}
