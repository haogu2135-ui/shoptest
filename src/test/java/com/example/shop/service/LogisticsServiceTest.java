package com.example.shop.service;

import com.example.shop.dto.LogisticsTrackResponse;
import com.example.shop.repository.OrderRepository;
import com.example.shop.security.UserDetailsImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LogisticsServiceTest {
    private LogisticsService service;
    private RuntimeConfigService runtimeConfig;
    private AdminRoleService adminRoleService;

    @BeforeEach
    void setUp() {
        service = new LogisticsService();
        runtimeConfig = mock(RuntimeConfigService.class);
        adminRoleService = mock(AdminRoleService.class);
        ReflectionTestUtils.setField(service, "orderRepository", mock(OrderRepository.class));
        ReflectionTestUtils.setField(service, "runtimeConfig", runtimeConfig);
        ReflectionTestUtils.setField(service, "adminRoleService", adminRoleService);
        when(runtimeConfig.getInt("logistics.tracking-number-max-chars", 120)).thenReturn(16);
        when(runtimeConfig.getInt("logistics.carrier-max-chars", 40)).thenReturn(8);
        when(runtimeConfig.getBoolean("kuaidi100.enabled", true)).thenReturn(false);
        when(runtimeConfig.getString("logistics.api-url", "")).thenReturn("");
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("dev");
    }

    @Test
    void normalizesTrackingNumberAndCarrierBeforeQuerying() {
        LogisticsTrackResponse response = service.track("  1Z\t999\nCN\u0000  ", "  DHL\tCN  ");

        assertEquals("1Z999CN", response.getTrackingNumber());
        assertEquals("DHL CN", response.getCarrier());
        assertEquals("TRACKING_UNAVAILABLE", response.getStatus());
        assertEquals(0, response.getEvents().size());
    }

    @Test
    void defaultsBlankCarrierToStandard() {
        LogisticsTrackResponse response = service.track("TN123", "  \n\t ");

        assertEquals("STANDARD", response.getCarrier());
    }

    @Test
    void unknownCarrierReturnsUnavailableTrackingInsteadOfThrowingOutsideProduction() {
        LogisticsTrackResponse response = service.track("TN123", "MYSTERY");

        assertEquals("MYSTERY", response.getCarrier());
        assertEquals("TRACKING_UNAVAILABLE", response.getStatus());
        assertEquals(
                "Real-time logistics tracking is not configured yet. Check the carrier site or contact support with this tracking number.",
                response.getSummary());
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
    void rejectsUrlUnsafeTrackingNumberCharacters() {
        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.track("ABC&key=evil", "DHL"));

        assertEquals("Tracking number may contain only letters, numbers, hyphens, and underscores", error.getMessage());
    }

    @Test
    void rejectsOverlongCarrier() {
        assertThrows(IllegalArgumentException.class, () -> service.track("TN123", "C".repeat(9)));
    }

    @Test
    void rejectsMockTrackingInProductionWhenProviderIsMissing() {
        when(runtimeConfig.getString("app.runtime-mode", "production")).thenReturn("production");
        when(runtimeConfig.getBoolean("logistics.mock-enabled", false)).thenReturn(true);

        IllegalStateException error = assertThrows(IllegalStateException.class, () -> service.track("TN123", "DHL"));

        assertEquals("Production logistics tracking provider is not configured", error.getMessage());
    }

    @Test
    void allowsMockTrackingOnlyOutsideProductionWhenExplicitlyEnabled() {
        when(runtimeConfig.getBoolean("logistics.mock-enabled", false)).thenReturn(true);

        LogisticsTrackResponse response = service.track("TN123", "DHL");

        assertEquals("IN_TRANSIT", response.getStatus());
        assertEquals("Shipment is in transit", response.getSummary());
        assertEquals(3, response.getEvents().size());
    }

    @Test
    void requiresFulfillmentPermissionForTrackingWithoutOrderContext() {
        assertThrows(ResponseStatusException.class, () -> service.track("TN123", "DHL", null, null, null, null));
        assertThrows(ResponseStatusException.class, () -> service.track("TN123", "DHL", null, null, null, adminAuthentication()));

        when(adminRoleService.canAccess(1L, "/admin/orders")).thenReturn(true);
        when(adminRoleService.hasPermission(1L, AdminRoleService.ORDER_FULFILLMENT_PERMISSION)).thenReturn(true);
        LogisticsTrackResponse response = service.track("TN123", "DHL", null, null, null, adminAuthentication());

        assertEquals("TRACKING_UNAVAILABLE", response.getStatus());
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
