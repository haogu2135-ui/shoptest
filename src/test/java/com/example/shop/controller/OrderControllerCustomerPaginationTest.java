package com.example.shop.controller;

import com.example.shop.entity.Order;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerCustomerPaginationTest {
    private final OrderService orderService = mock(OrderService.class);
    private final OrderController controller = new OrderController(
            orderService,
            mock(OrderItemService.class),
            mock(SecurityAuditLogService.class),
            mock(IpBlacklistService.class)
    );

    OrderControllerCustomerPaginationTest() {
        ReflectionTestUtils.setField(controller, "adminRoleService", null);
    }

    @Test
    void myOrdersReturnZeroBasedPageWithPaginationHeaders() {
        Order order = new Order();
        order.setId(10L);
        order.setUserId(7L);
        when(orderService.countOrdersByUserId(7L)).thenReturn(45);
        when(orderService.getOrdersByUserId(7L, 0, 20)).thenReturn(List.of(order));

        ResponseEntity<?> response = controller.getMyOrders(0, 20, userAuthentication(7L));

        assertEquals(200, response.getStatusCodeValue());
        assertEquals("0", response.getHeaders().getFirst("X-Order-Page"));
        assertEquals("20", response.getHeaders().getFirst("X-Order-Page-Size"));
        assertEquals("45", response.getHeaders().getFirst("X-Order-Total"));
        assertEquals("3", response.getHeaders().getFirst("X-Order-Total-Pages"));
        assertEquals("true", response.getHeaders().getFirst("X-Order-Has-Next"));
        Map<?, ?> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(45, body.get("totalElements"));
        assertEquals(45, body.get("total"));
        assertEquals(1, body.get("page"));
        assertEquals(0, body.get("number"));
        assertEquals(20, body.get("size"));
        assertEquals(3, body.get("totalPages"));
        assertEquals(true, body.get("hasNext"));
        assertEquals(body.get("items"), body.get("content"));
        verify(orderService).getOrdersByUserId(7L, 0, 20);
    }

    @Test
    void myOrdersDefaultToZeroBasedFirstPage() {
        when(orderService.countOrdersByUserId(7L)).thenReturn(0);
        when(orderService.getOrdersByUserId(7L, 0, 20)).thenReturn(List.of());

        ResponseEntity<?> response = controller.getMyOrders(null, null, userAuthentication(7L));

        assertEquals(200, response.getStatusCodeValue());
        assertEquals("0", response.getHeaders().getFirst("X-Order-Page"));
        assertEquals("20", response.getHeaders().getFirst("X-Order-Page-Size"));
        assertEquals("false", response.getHeaders().getFirst("X-Order-Has-Next"));
        Map<?, ?> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(List.of(), body.get("items"));
        assertEquals(List.of(), body.get("content"));
        assertEquals(0, body.get("totalElements"));
        assertEquals(0, body.get("totalPages"));
        assertEquals(false, body.get("hasNext"));
        verify(orderService).getOrdersByUserId(7L, 0, 20);
    }

    @Test
    void myOrdersRejectOversizedPage() {
        assertThrows(ResponseStatusException.class, () -> controller.getMyOrders(0, 101, userAuthentication(7L)));
    }

    @Test
    void myOrdersRejectNegativePage() {
        assertThrows(ResponseStatusException.class, () -> controller.getMyOrders(-1, 20, userAuthentication(7L)));
    }

    private Authentication userAuthentication(Long userId) {
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
