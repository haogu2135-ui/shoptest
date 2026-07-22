package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.GuestOrderAccessRequest;
import com.example.shop.dto.PaymentCustomerResponse;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentChannelRecommendationService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.PaymentWebhookEvidenceService;
import com.example.shop.service.SecurityAuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PaymentControllerCustomerResponseTest {
    private final PaymentService paymentService = mock(PaymentService.class);
    private final OrderService orderService = mock(OrderService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final PaymentController controller = new PaymentController(
            paymentService,
            mock(PaymentWebhookEvidenceService.class),
            orderService,
            mock(SecurityAuditLogService.class),
            mock(PaymentChannelConfig.class),
            mock(PaymentChannelRecommendationService.class),
            mock(IpBlacklistService.class),
            adminRoleService
    );
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void customerPaymentListDoesNotExposeRefundReference() {
        Order order = customerOrder();
        Payment payment = refundedPayment();
        Authentication authentication = customerAuthentication();

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentService.findStoredByOrderId(42L)).thenReturn(List.of(payment));

        ResponseEntity<List<PaymentCustomerResponse>> response = controller.findByOrderId(
                42L,
                authentication);

        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        PaymentCustomerResponse body = response.getBody().get(0);
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getTransactionId(), body.getTransactionId());
        assertNoRefundReference(body);
    }

    @Test
    void guestLatestPaymentDoesNotExposeRefundReference() {
        Order order = customerOrder();
        Payment payment = refundedPayment();

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "guest@example.com", "SO202606030001")).thenReturn(true);
        when(paymentService.findStoredLatestByOrderId(42L)).thenReturn(payment);

        ResponseEntity<PaymentCustomerResponse> response = controller.findLatestGuestByOrderId(
                42L,
                guestAccessRequest("guest@example.com", "SO202606030001"),
                new MockHttpServletRequest("POST", "/payments/guest/order/42/latest"));

        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertNoRefundReference(response.getBody());
    }

    @Test
    void guestPaymentListUsesBodyCredentials() {
        Order order = customerOrder();
        Payment payment = refundedPayment();

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "guest@example.com", "SO202606030001")).thenReturn(true);
        when(paymentService.findStoredByOrderId(42L)).thenReturn(List.of(payment));

        ResponseEntity<List<PaymentCustomerResponse>> response = controller.findGuestByOrderId(
                42L,
                guestAccessRequest("guest@example.com", "SO202606030001"),
                new MockHttpServletRequest("POST", "/payments/guest/order/42"));

        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertNoRefundReference(response.getBody().get(0));
    }

    @Test
    void customerSyncPaymentDoesNotExposeRefundReference() {
        Order order = customerOrder();
        Payment payment = refundedPayment();
        Authentication authentication = customerAuthentication();

        when(paymentService.findById(9L)).thenReturn(payment);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentService.syncPayment(9L)).thenReturn(payment);

        ResponseEntity<?> response = controller.syncPayment(
                9L,
                null,
                authentication,
                new MockHttpServletRequest("POST", "/payments/9/sync"));

        assertEquals(200, response.getStatusCodeValue());
        PaymentCustomerResponse body = assertInstanceOf(PaymentCustomerResponse.class, response.getBody());
        assertFalse(body instanceof PaymentResponse);
        assertNoRefundReference(body);
    }

    @Test
    void customerSyncOrderPaymentsUsesBatchServiceAndDoesNotExposeRefundReference() {
        Order order = customerOrder();
        Payment payment = refundedPayment();
        Authentication authentication = customerAuthentication();

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentService.syncPaymentsByOrderId(42L)).thenReturn(List.of(payment));

        ResponseEntity<List<PaymentCustomerResponse>> response = controller.syncOrderPayments(
                42L,
                authentication,
                new MockHttpServletRequest("POST", "/payments/order/42/sync"));

        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().size());
        assertNoRefundReference(response.getBody().get(0));
        verify(paymentService).syncPaymentsByOrderId(42L);
    }

    private void assertNoRefundReference(PaymentCustomerResponse body) {
        Map<?, ?> serialized = objectMapper.convertValue(body, Map.class);
        assertFalse(serialized.containsKey("refundReference"));
    }

    private Payment refundedPayment() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202606030001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setChannel("STRIPE");
        payment.setStatus("REFUNDED");
        payment.setTransactionId("gateway-txn-visible");
        payment.setRefundReference("refund-secret");
        return payment;
    }

    private GuestOrderAccessRequest guestAccessRequest(String email, String orderNo) {
        GuestOrderAccessRequest request = new GuestOrderAccessRequest();
        request.setGuestEmail(email);
        request.setOrderNo(orderNo);
        return request;
    }

    private Order customerOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setUserId(5L);
        order.setOrderNo("SO202606030001");
        return order;
    }

    private Authentication customerAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                5L,
                "customer",
                "customer@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
