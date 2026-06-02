package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentChannelRecommendationService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentControllerSimulationAccessTest {
    private final PaymentService paymentService = mock(PaymentService.class);
    private final OrderService orderService = mock(OrderService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final PaymentController controller = new PaymentController(
            paymentService,
            orderService,
            mock(SecurityAuditLogService.class),
            new PaymentChannelConfig(),
            mock(PaymentChannelRecommendationService.class),
            mock(IpBlacklistService.class),
            adminRoleService
    );

    @Test
    void adminCanUseEnabledSimulation() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605260001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setStatus("PAID");

        when(paymentService.simulateCallback(9L)).thenReturn(payment);

        ResponseEntity<?> response = controller.simulateCallback(
                9L,
                Map.of(),
                adminAuthentication(),
                new MockHttpServletRequest("POST", "/payments/9/simulate-callback")
        );

        assertSame(payment, response.getBody());
        verify(paymentService).simulateCallback(9L);
    }

    @Test
    void guestCannotUseSimulationEvenWhenEmailMatchesOrder() {
        assertThrows(ResponseStatusException.class, () -> controller.simulateCallback(
                9L,
                Map.of("guestEmail", "mia@example.com", "orderNo", "SO202605260001"),
                null,
                new MockHttpServletRequest("POST", "/payments/9/simulate-callback")
        ));
        verify(paymentService, never()).simulateCallback(9L);
    }

    @Test
    void authenticatedRegisteredCustomerCanCreatePaymentForOwnOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);

        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);

        com.example.shop.dto.PaymentCreateRequest request = new com.example.shop.dto.PaymentCreateRequest();
        request.setOrderId(42L);
        request.setChannel("STRIPE");

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentService.createPayment(request)).thenReturn(payment);

        ResponseEntity<?> response = controller.createPayment(
                request,
                customerAuthentication(12L),
                new MockHttpServletRequest("POST", "/payments")
        );

        PaymentResponse body = (PaymentResponse) response.getBody();
        assertNotNull(body);
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getOrderId(), body.getOrderId());
        verify(paymentService).createPayment(request);
    }

    @Test
    void anonymousRegisteredOrderCannotCreatePaymentEvenWhenEmailMatchesOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);

        com.example.shop.dto.PaymentCreateRequest request = new com.example.shop.dto.PaymentCreateRequest();
        request.setOrderId(42L);
        request.setOrderNo("SO202605260001");
        request.setChannel("STRIPE");
        request.setGuestEmail("mia@example.com");

        when(orderService.getOrderById(42L)).thenReturn(order);

        assertThrows(ResponseStatusException.class, () -> controller.createPayment(
                request,
                null,
                new MockHttpServletRequest("POST", "/payments")
        ));
    }

    @Test
    void anonymousRegisteredOrderCannotCreatePaymentWhenOrderNoDoesNotMatch() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setUserId(12L);

        com.example.shop.dto.PaymentCreateRequest request = new com.example.shop.dto.PaymentCreateRequest();
        request.setOrderId(42L);
        request.setOrderNo("SO202605260999");
        request.setChannel("STRIPE");
        request.setGuestEmail("mia@example.com");

        when(orderService.getOrderById(42L)).thenReturn(order);

        assertThrows(ResponseStatusException.class, () -> controller.createPayment(
                request,
                null,
                new MockHttpServletRequest("POST", "/payments")
        ));
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

    private Authentication customerAuthentication(Long userId) {
        UserDetailsImpl principal = new UserDetailsImpl(
                userId,
                "mia",
                "mia@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
