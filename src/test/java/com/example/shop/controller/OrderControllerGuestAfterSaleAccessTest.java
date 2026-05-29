package com.example.shop.controller;

import com.example.shop.entity.Order;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerGuestAfterSaleAccessTest {
    private final OrderService orderService = mock(OrderService.class);
    private final OrderController controller = new OrderController(
            orderService,
            mock(OrderItemService.class),
            mock(SecurityAuditLogService.class)
    );

    @Test
    void guestCanRequestReturnWhenEmailMatchesOrder() {
        Order order = guestOrder();
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderEmailMatches(order, "MIA@example.com")).thenReturn(true);
        when(orderService.requestReturn(42L, null, "Too small")).thenReturn(true);

        ResponseEntity<?> response = controller.returnOrder(
                42L,
                Map.of("guestEmail", "MIA@example.com", "orderNo", "SO202605260001", "reason", "Too small"),
                null,
                new MockHttpServletRequest("PUT", "/orders/42/return")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).requestReturn(42L, null, "Too small");
    }

    @Test
    void guestCanSubmitReturnShipmentWhenEmailMatchesOrder() {
        Order order = guestOrder();
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderEmailMatches(order, "mia@example.com")).thenReturn(true);
        when(orderService.submitReturnShipment(42L, null, "RX123")).thenReturn(true);

        ResponseEntity<?> response = controller.submitReturnShipment(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260001", "returnTrackingNumber", "RX123"),
                null,
                new MockHttpServletRequest("PUT", "/orders/42/return-shipment")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).submitReturnShipment(42L, null, "RX123");
    }

    @Test
    void guestCanConfirmReceiptWhenEmailMatchesOrder() {
        Order order = guestOrder();
        order.setStatus("SHIPPED");
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderEmailMatches(order, "MIA@example.com")).thenReturn(true);
        when(orderService.updateOrderStatus(42L, "COMPLETED")).thenReturn(true);

        ResponseEntity<?> response = controller.confirmReceipt(
                42L,
                Map.of("guestEmail", "MIA@example.com", "orderNo", "SO202605260001"),
                null
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).updateOrderStatus(42L, "COMPLETED");
    }

    @Test
    void guestAfterSaleRejectsMismatchedEmail() {
        when(orderService.getOrderById(42L)).thenReturn(guestOrder());

        assertThrows(ResponseStatusException.class, () -> controller.returnOrder(
                42L,
                Map.of("guestEmail", "other@example.com", "orderNo", "SO202605260001", "reason", "Too small"),
                null,
                new MockHttpServletRequest("PUT", "/orders/42/return")
        ));
    }

    @Test
    void guestAfterSaleRejectsMismatchedOrderNo() {
        when(orderService.getOrderById(42L)).thenReturn(guestOrder());

        assertThrows(ResponseStatusException.class, () -> controller.returnOrder(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260999", "reason", "Too small"),
                null,
                new MockHttpServletRequest("PUT", "/orders/42/return")
        ));
    }

    @Test
    void trackedRegisteredCustomerCanRequestReturnWhenEmailAndOrderNoMatchOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);
        order.setShippingAddress("Mia / 555-0100 / 1 Main St");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.orderEmailMatches(order, "mia@example.com")).thenReturn(true);
        when(orderService.requestReturn(42L, null, "Too small")).thenReturn(true);

        ResponseEntity<?> response = controller.returnOrder(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260001", "reason", "Too small"),
                null,
                new MockHttpServletRequest("PUT", "/orders/42/return")
        );

        assertTrue(response.getStatusCode().is2xxSuccessful());
        verify(orderService).requestReturn(42L, null, "Too small");
    }

    @Test
    void trackedRegisteredCustomerCanConfirmReceiptWhenEmailAndOrderNoMatchOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);
        order.setStatus("SHIPPED");
        order.setShippingAddress("Mia / 555-0100 / 1 Main St");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.orderEmailMatches(order, "mia@example.com")).thenReturn(true);
        when(orderService.updateOrderStatus(42L, "COMPLETED")).thenReturn(true);

        ResponseEntity<?> response = controller.confirmReceipt(
                42L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260001"),
                null
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
}
