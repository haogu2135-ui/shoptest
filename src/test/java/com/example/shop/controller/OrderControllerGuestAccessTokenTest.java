package com.example.shop.controller;

import com.example.shop.dto.OrderCustomerResponse;
import com.example.shop.dto.OrderTrackRequest;
import com.example.shop.dto.OrderTrackResponse;
import com.example.shop.entity.Order;
import com.example.shop.service.GuestAccessRateLimitService;
import com.example.shop.service.GuestAccessTokenService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerGuestAccessTokenTest {
    private OrderService orderService;
    private OrderItemService orderItemService;
    private GuestAccessTokenService tokenService;
    private OrderController controller;

    @BeforeEach
    void setUp() {
        orderService = mock(OrderService.class);
        orderItemService = mock(OrderItemService.class);
        tokenService = mock(GuestAccessTokenService.class);
        controller = new OrderController(
                orderService,
                orderItemService,
                mock(SecurityAuditLogService.class),
                mock(IpBlacklistService.class));
        ReflectionTestUtils.setField(controller, "guestAccessRateLimitService",
                mock(GuestAccessRateLimitService.class));
        ReflectionTestUtils.setField(controller, "guestAccessTokenService", tokenService);
    }

    @Test
    void successfulEmailTrackingIssuesGuestAccessToken() {
        OrderTrackResponse tracked = new OrderTrackResponse(
                mock(OrderCustomerResponse.class), Collections.emptyList(), false, null);
        when(orderService.trackOrder("SO202608160001", "guest@example.com")).thenReturn(tracked);
        when(tokenService.issue("SO202608160001", "guest@example.com")).thenReturn("signed-token");

        ResponseEntity<?> response = controller.trackOrder(
                trackRequest("SO202608160001", "guest@example.com", null),
                new MockHttpServletRequest());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("signed-token", ((OrderTrackResponse) response.getBody()).getGuestAccessToken());
        verify(tokenService).issue("SO202608160001", "guest@example.com");
    }

    @Test
    void validTokenTracksBoundGuestOrderWithoutEmail() {
        String orderNo = "SO202608160002";
        String token = "signed-token";
        Order order = new Order();
        order.setId(12L);
        order.setOrderNo(orderNo);
        order.setGuestOrder(true);
        order.setContactEmail("guest@example.com");
        when(tokenService.validate(token)).thenReturn(new GuestAccessTokenService.Access(orderNo, "fingerprint", "jti"));
        when(orderService.getTrackableGuestOrderByOrderNo(orderNo)).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn("guest@example.com");
        when(tokenService.fingerprint("guest@example.com")).thenReturn("fingerprint");
        when(tokenService.matchesFingerprint(token, orderNo, "fingerprint")).thenReturn(true);
        when(orderItemService.getOrderItemsByOrderId(12L)).thenReturn(Collections.emptyList());

        ResponseEntity<?> response = controller.trackOrder(
                trackRequest(orderNo, null, token),
                new MockHttpServletRequest());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        OrderTrackResponse body = (OrderTrackResponse) response.getBody();
        assertEquals(token, body.getGuestAccessToken());
        assertTrue(body.getItems().isEmpty());
    }

    @Test
    void invalidTokenIsRejectedWithoutFallingBackToEmail() {
        when(tokenService.validate("forged-token")).thenReturn(null);

        ResponseStatusException rejected = assertThrows(ResponseStatusException.class,
                () -> controller.trackOrder(
                        trackRequest("SO202608160003", "guest@example.com", "forged-token"),
                        new MockHttpServletRequest()));

        assertEquals(HttpStatus.FORBIDDEN, rejected.getStatus());
        verify(orderService, org.mockito.Mockito.never()).trackOrder(any(), any());
    }

    private OrderTrackRequest trackRequest(String orderNo, String email, String token) {
        OrderTrackRequest request = new OrderTrackRequest();
        request.setOrderNo(orderNo);
        request.setEmail(email);
        request.setGuestAccessToken(token);
        return request;
    }
}
