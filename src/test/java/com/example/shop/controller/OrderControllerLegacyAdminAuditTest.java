package com.example.shop.controller;

import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Payment;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
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
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerLegacyAdminAuditTest {
    private final OrderService orderService = mock(OrderService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final OrderController controller = new OrderController(
            orderService,
            mock(OrderItemService.class),
            auditLogService,
            mock(IpBlacklistService.class)
    );

    OrderControllerLegacyAdminAuditTest() {
        ReflectionTestUtils.setField(controller, "adminRoleService", adminRoleService);
    }

    @Test
    void legacyPayOrderAuditsSuccessAndReturnsPaymentResponse() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605260001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setChannel("STRIPE");
        payment.setStatus("PAID");
        payment.setPaymentUrl("https://payments.example.com/pay/internal");
        payment.setProviderReference("provider-secret");
        payment.setTransactionId("txn-1");
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/orders/42/pay");

        grantPermission(AdminRoleService.ORDER_PAYMENT_PERMISSION);
        when(orderService.confirmPayment(42L, "txn-1")).thenReturn(payment);

        ResponseEntity<?> response = controller.payOrder(
                42L,
                Map.of("transactionId", "txn-1"),
                authentication,
                request);

        assertEquals(200, response.getStatusCodeValue());
        Map<?, ?> body = assertInstanceOf(Map.class, response.getBody());
        PaymentResponse responsePayment = assertInstanceOf(PaymentResponse.class, body.get("payment"));
        assertEquals(payment.getId(), responsePayment.getId());
        verify(auditLogService).record(
                eq("PAYMENT_MANUAL_CONFIRM"),
                eq("SUCCESS"),
                same(authentication),
                eq("ORDER"),
                eq(42L),
                same(request),
                eq("Payment confirmed"),
                contains("paymentId=9"));
    }

    @Test
    void legacyShipOrderAuditsFailure() {
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/orders/42/ship");

        grantPermission(AdminRoleService.ORDER_FULFILLMENT_PERMISSION);
        when(orderService.shipOrder(42L, "TRACK123", "DHL")).thenReturn(false);

        assertThrows(IllegalStateException.class, () -> controller.shipOrder(
                42L,
                Map.of("trackingNumber", "TRACK123", "trackingCarrierCode", "DHL"),
                authentication,
                request));

        verify(auditLogService).record(
                eq("ORDER_SHIP"),
                eq("FAILURE"),
                same(authentication),
                eq("ORDER"),
                eq(42L),
                same(request),
                eq("Order shipment failed"),
                contains("trackingCarrierCode=DHL"));
    }

    private void grantPermission(String permission) {
        when(adminRoleService.canAccess(1L, "/admin/orders")).thenReturn(true);
        when(adminRoleService.hasPermission(1L, permission)).thenReturn(true);
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
