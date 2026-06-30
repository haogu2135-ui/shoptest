package com.example.shop.controller;

import com.example.shop.dto.GuestOrderAccessRequest;
import com.example.shop.dto.OrderCustomerResponse;
import com.example.shop.dto.OrderItemCustomerResponse;
import com.example.shop.dto.OrderTrackRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.OrderItem;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerGuestAfterSaleAccessTest {
    private final OrderService orderService = mock(OrderService.class);
    private final OrderItemService orderItemService = mock(OrderItemService.class);
    private final IpBlacklistService ipBlacklistService = mock(IpBlacklistService.class);
    private final OrderController controller = new OrderController(
            orderService,
            orderItemService,
            mock(SecurityAuditLogService.class),
            ipBlacklistService
    );

    @Test
    void guestCanReadOrderWhenBodyCredentialsMatch() {
        Order order = guestOrder();
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "mia@example.com", "SO202605260001")).thenReturn(true);

        ResponseEntity<OrderCustomerResponse> response = controller.getGuestOrder(
                42L,
                guestAccessRequest("mia@example.com", "SO202605260001"),
                new MockHttpServletRequest("POST", "/orders/guest/42")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).guestOrderAccessMatches(order, "mia@example.com", "SO202605260001");
    }

    @Test
    void guestCanReadOrderItemsWhenBodyCredentialsMatch() {
        Order order = guestOrder();
        OrderItem item = new OrderItem();
        item.setId(7L);
        item.setOrderId(42L);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "mia@example.com", "SO202605260001")).thenReturn(true);
        when(orderItemService.getOrderItemsByOrderId(42L)).thenReturn(List.of(item));

        ResponseEntity<List<OrderItemCustomerResponse>> response = controller.getGuestOrderItems(
                42L,
                guestAccessRequest("mia@example.com", "SO202605260001"),
                new MockHttpServletRequest("POST", "/orders/guest/42/items")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderItemService).getOrderItemsByOrderId(42L);
    }

    @Test
    void guestCanRequestReturnWhenEmailMatchesOrder() {
        Order order = guestOrder();
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "MIA@example.com", "SO202605260001")).thenReturn(true);
        when(orderService.requestReturn(42L, null, "Too small")).thenReturn(true);

        ResponseEntity<?> response = controller.returnGuestOrder(
                42L,
                Map.of("guestEmail", "MIA@example.com", "orderNo", "SO202605260001", "reason", "Too small"),
                new MockHttpServletRequest("POST", "/orders/guest/42/return")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).requestReturn(42L, null, "Too small");
    }

    @Test
    void guestCanSubmitReturnShipmentWhenEmailMatchesOrder() {
        Order order = guestOrder();
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "mia@example.com", "SO202605260001")).thenReturn(true);
        when(orderService.submitReturnShipment(42L, null, "RX123")).thenReturn(true);

        ResponseEntity<?> response = controller.submitGuestReturnShipment(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260001", "returnTrackingNumber", "RX123"),
                new MockHttpServletRequest("POST", "/orders/guest/42/return-shipment")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).submitReturnShipment(42L, null, "RX123");
    }

    @Test
    void guestCanConfirmReceiptWhenEmailMatchesOrder() {
        Order order = guestOrder();
        order.setStatus("SHIPPED");
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "MIA@example.com", "SO202605260001")).thenReturn(true);
        when(orderService.updateOrderStatus(42L, "COMPLETED")).thenReturn(true);

        ResponseEntity<?> response = controller.confirmGuestReceipt(
                42L,
                Map.of("guestEmail", "MIA@example.com", "orderNo", "SO202605260001"),
                new MockHttpServletRequest("POST", "/orders/guest/42/confirm")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).updateOrderStatus(42L, "COMPLETED");
    }

    @Test
    void guestAfterSaleRejectsMismatchedEmail() {
        when(orderService.getOrderById(42L)).thenReturn(guestOrder());

        assertThrows(ResponseStatusException.class, () -> controller.returnGuestOrder(
                42L,
                Map.of("guestEmail", "other@example.com", "orderNo", "SO202605260001", "reason", "Too small"),
                new MockHttpServletRequest("POST", "/orders/guest/42/return")
        ));
    }

    @Test
    void guestAfterSaleRejectsMismatchedOrderNo() {
        when(orderService.getOrderById(42L)).thenReturn(guestOrder());

        assertThrows(ResponseStatusException.class, () -> controller.returnGuestOrder(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260999", "reason", "Too small"),
                new MockHttpServletRequest("POST", "/orders/guest/42/return")
        ));
    }

    @Test
    void guestCancelRejectsMissingEmailAndOrderNumberBeforeMutation() {
        when(orderService.getOrderById(42L)).thenReturn(guestOrder());

        assertThrows(ResponseStatusException.class, () -> controller.cancelGuestOrder(
                42L,
                Map.of(),
                new MockHttpServletRequest("POST", "/orders/guest/42/cancel")
        ));
        verify(orderService, never()).cancelOrder(42L);
    }

    @Test
    void guestTrackingCredentialFailureDoesNotRecordLoginFailure() {
        OrderTrackRequest body = new OrderTrackRequest();
        body.setOrderNo("SO202605260001");
        body.setEmail("wrong@example.com");
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/orders/track");
        when(orderService.trackOrder("SO202605260001", "wrong@example.com"))
                .thenThrow(new IllegalArgumentException("Order not found or email mismatch"));

        assertThrows(IllegalArgumentException.class, () -> controller.trackOrder(body, request));

        verify(ipBlacklistService, never()).recordLoginFailure(request, "guest-order-track failed");
    }

    @Test
    void authenticatedRegisteredCustomerCanRequestReturnForOwnOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);
        order.setShippingAddress("Mia / 555-0100 / 1 Main St");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.requestReturn(42L, 12L, "Too small")).thenReturn(true);

        ResponseEntity<?> response = controller.returnOrder(
                42L,
                Map.of("reason", "Too small"),
                customerAuthentication(12L),
                new MockHttpServletRequest("POST", "/orders/42/return")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).requestReturn(42L, 12L, "Too small");
    }

    @Test
    void authenticatedRegisteredCustomerCanConfirmReceiptForOwnOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);
        order.setStatus("SHIPPED");
        order.setShippingAddress("Mia / 555-0100 / 1 Main St");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.updateOrderStatus(42L, "COMPLETED")).thenReturn(true);

        ResponseEntity<?> response = controller.confirmReceipt(
                42L,
                Map.of(),
                customerAuthentication(12L),
                new MockHttpServletRequest("POST", "/orders/42/confirm")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).updateOrderStatus(42L, "COMPLETED");
    }

    private Order guestOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(7001L);
        order.setShippingAddress("[Guest] Mia / 555-0100 / mia@example.com / 1 Main St");
        return order;
    }

    private GuestOrderAccessRequest guestAccessRequest(String email, String orderNo) {
        GuestOrderAccessRequest request = new GuestOrderAccessRequest();
        request.setGuestEmail(email);
        request.setOrderNo(orderNo);
        return request;
    }

    private Authentication customerAuthentication(Long userId) {
        UserDetailsImpl principal = new UserDetailsImpl(
                userId,
                "mia",
                "mia@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
