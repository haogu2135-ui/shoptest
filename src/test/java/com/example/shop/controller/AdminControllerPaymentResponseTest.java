package com.example.shop.controller;

import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.BrandService;
import com.example.shop.service.CategoryService;
import com.example.shop.service.CouponService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.PetGalleryService;
import com.example.shop.service.ProductQuestionService;
import com.example.shop.service.ProductService;
import com.example.shop.service.ProductUrlImportService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerPaymentResponseTest {
    private final OrderService orderService = mock(OrderService.class);
    private final PaymentService paymentService = mock(PaymentService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final AdminController controller = new AdminController(
            mock(UserService.class),
            orderService,
            mock(OrderItemService.class),
            mock(BrandService.class),
            mock(CategoryService.class),
            mock(ProductService.class),
            mock(ProductQuestionService.class),
            mock(ProductUrlImportService.class),
            mock(ReviewService.class),
            mock(CouponService.class),
            mock(NotificationService.class),
            mock(PetBirthdayCouponService.class),
            mock(PetGalleryService.class),
            paymentService,
            mock(LogisticsCarrierService.class),
            mock(SecurityAuditLogService.class),
            adminRoleService,
            mock(PaymentRepository.class),
            mock(RuntimeConfigService.class)
    );

    @Test
    void orderPaymentsReturnSafePaymentResponsesWithRefundReference() {
        Order order = new Order();
        order.setId(42L);
        Payment payment = refundedPayment();
        Authentication authentication = adminAuthentication();

        when(adminRoleService.hasPermission(1L, AdminRoleService.ORDER_PAYMENT_PERMISSION)).thenReturn(true);
        when(orderService.getOrderById(42L)).thenReturn(order);
        when(paymentService.findStoredByOrderId(42L)).thenReturn(List.of(payment));

        ResponseEntity<List<PaymentResponse>> response = controller.getOrderPayments(
                42L,
                authentication,
                new MockHttpServletRequest("GET", "/admin/orders/42/payments"));

        assertEquals(200, response.getStatusCodeValue());
        assertNotNull(response.getBody());
        PaymentResponse body = response.getBody().get(0);
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getRefundReference(), body.getRefundReference());
        assertNull(body.getPaymentUrl());
    }

    @Test
    void syncOrderPaymentReturnsSafePaymentResponse() {
        Payment payment = refundedPayment();
        Authentication authentication = adminAuthentication();

        when(adminRoleService.hasPermission(1L, AdminRoleService.ORDER_PAYMENT_PERMISSION)).thenReturn(true);
        when(paymentService.findById(9L)).thenReturn(payment);
        when(paymentService.syncPayment(9L)).thenReturn(payment);

        ResponseEntity<?> response = controller.syncOrderPayment(
                9L,
                authentication,
                new MockHttpServletRequest("POST", "/admin/orders/payments/9/sync"));

        assertEquals(200, response.getStatusCodeValue());
        PaymentResponse body = (PaymentResponse) response.getBody();
        assertNotNull(body);
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getRefundReference(), body.getRefundReference());
        assertSame(PaymentResponse.class, body.getClass());
        verify(paymentService).syncPayment(9L);
    }

    @Test
    void reconcileRequiredPaymentResponseKeepsAuditTransactionVisible() {
        Payment payment = refundedPayment();
        payment.setStatus("RECONCILE_REQUIRED");
        payment.setTransactionId("gateway-txn-visible");

        PaymentResponse response = PaymentResponse.from(payment);

        assertEquals("RECONCILE_REQUIRED", response.getStatus());
        assertEquals("gateway-txn-visible", response.getTransactionId());
        assertNull(response.getPaymentUrl());
        assertNull(response.getRefundReference());
    }

    @Test
    void orderPaymentsRequireOrderPaymentPermission() {
        Authentication authentication = adminAuthentication();

        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> controller.getOrderPayments(
                42L,
                authentication,
                new MockHttpServletRequest("GET", "/admin/orders/42/payments")));
        verify(paymentService, never()).findStoredByOrderId(42L);
    }

    private Payment refundedPayment() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605260001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setChannel("STRIPE");
        payment.setStatus("REFUNDED");
        payment.setPaymentUrl("https://payments.example.com/pay/internal");
        payment.setProviderReference("provider-secret");
        payment.setRefundReference("refund-visible");
        return payment;
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
