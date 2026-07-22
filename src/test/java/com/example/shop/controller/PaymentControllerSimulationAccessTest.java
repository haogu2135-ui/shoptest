package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.dto.PaymentCustomerResponse;
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
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.ConstraintViolation;
import javax.validation.Validation;
import javax.validation.Validator;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
            mock(PaymentWebhookEvidenceService.class),
            orderService,
            mock(SecurityAuditLogService.class),
            new PaymentChannelConfig(),
            mock(PaymentChannelRecommendationService.class),
            mock(IpBlacklistService.class),
            adminRoleService
    );
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void genericPaymentCallbackContractDoesNotExposeInternalHeaderOrUnsignedProviderSubroutes() throws Exception {
        String controllerSource = Files.readString(Path.of("src/main/java/com/example/shop/controller/PaymentController.java"));
        String securitySource = Files.readString(Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"));
        String requestSource = Files.readString(Path.of("src/main/java/com/example/shop/dto/PaymentCallbackRequest.java"));
        String serviceSource = Files.readString(Path.of("src/main/java/com/example/shop/service/PaymentService.java"));

        assertTrue(controllerSource.contains("@PostMapping(\"/callback\")"));
        assertTrue(controllerSource.contains("paymentService.handleCallback(request)"));
        assertTrue(requestSource.contains("@NotBlank\n    private String signature;"));
        assertTrue(serviceSource.contains("assertProductionCallbackSecretConfigured();"));
        assertTrue(serviceSource.contains("if (!verifySignature(request))"));
        assertTrue(serviceSource.contains("MessageDigest.isEqual(expected, actual)"));
        assertTrue(serviceSource.contains("validateCallbackFreshness(callbackAt)"));

        String callbackSurface = controllerSource + "\n" + securitySource + "\n" + serviceSource;
        assertFalse(callbackSurface.contains("X-Internal-Call"));
        assertFalse(callbackSurface.contains("@PostMapping(\"/callback/{code}"));
        assertFalse(callbackSurface.contains("@PostMapping(\"/callback/{channel}"));
        assertFalse(callbackSurface.contains("/payments/callback/*/success"));
        assertFalse(callbackSurface.contains("/payments/callback/*/notify"));
        assertFalse(callbackSurface.contains("/payments/callback/*/cancel"));
        assertFalse(callbackSurface.contains("/payment/callback/*/success"));
        assertFalse(callbackSurface.contains("/payment/callback/*/notify"));
        assertFalse(callbackSurface.contains("/payment/callback/*/cancel"));
    }

    @Test
    void paymentCreateRequestValidatesIdentifiersBeforeControllerWork() {
        PaymentCreateRequest request = new PaymentCreateRequest();
        request.setOrderId(0L);
        request.setChannel("C".repeat(41));
        request.setOrderNo("O".repeat(65));
        request.setGuestEmail("not-an-email");

        Set<String> invalidFields = validator.validate(request).stream()
                .map(ConstraintViolation::getPropertyPath)
                .map(Object::toString)
                .collect(Collectors.toSet());

        assertTrue(invalidFields.contains("orderId"));
        assertTrue(invalidFields.contains("channel"));
        assertTrue(invalidFields.contains("orderNo"));
        assertTrue(invalidFields.contains("guestEmail"));
    }

    @Test
    void adminCanUseEnabledSimulation() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605260001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setStatus("PAID");
        payment.setPaymentUrl("https://payments.example.com/pay/internal");
        payment.setProviderReference("provider-secret");

        grantOrderPaymentPermission();
        when(paymentService.simulateCallback(9L)).thenReturn(payment);

        ResponseEntity<?> response = controller.simulateCallback(
                9L,
                Map.of(),
                adminAuthentication(),
                new MockHttpServletRequest("POST", "/payments/9/simulate-callback")
        );

        PaymentResponse body = (PaymentResponse) response.getBody();
        assertNotNull(body);
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getOrderNo(), body.getOrderNo());
        assertNull(body.getPaymentUrl());
        verify(paymentService).simulateCallback(9L);
    }

    @Test
    void adminSimulatePaidKeepsAdminPaymentResponse() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo("SO202605260001");
        payment.setAmount(new BigDecimal("88.00"));
        payment.setStatus("REFUNDED");
        payment.setRefundReference("refund-visible");

        grantOrderPaymentPermission();
        when(paymentService.simulatePaid(9L)).thenReturn(payment);

        ResponseEntity<?> response = controller.simulatePaid(
                9L,
                Map.of(),
                adminAuthentication(),
                new MockHttpServletRequest("POST", "/payments/9/simulate-paid")
        );

        PaymentResponse body = assertInstanceOf(PaymentResponse.class, response.getBody());
        assertEquals(payment.getId(), body.getId());
        assertEquals(payment.getRefundReference(), body.getRefundReference());
        verify(paymentService).simulatePaid(9L);
    }

    @Test
    void adminWithoutOrderPaymentPermissionCannotUseSimulation() {
        when(adminRoleService.canAccess(1L, "/admin/orders")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> controller.simulatePaid(
                9L,
                Map.of(),
                adminAuthentication(),
                new MockHttpServletRequest("POST", "/payments/9/simulate-paid")
        ));
        verify(paymentService, never()).simulatePaid(9L);
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

        PaymentCustomerResponse body = (PaymentCustomerResponse) response.getBody();
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

    @Test
    void anonymousGuestOrderCannotCreatePaymentWithoutEmailAndOrderNumber() {
        Order order = guestOrder();
        com.example.shop.dto.PaymentCreateRequest request = new com.example.shop.dto.PaymentCreateRequest();
        request.setOrderId(42L);
        request.setChannel("STRIPE");

        when(orderService.getOrderById(42L)).thenReturn(order);

        assertThrows(ResponseStatusException.class, () -> controller.createPayment(
                request,
                null,
                new MockHttpServletRequest("POST", "/payments")
        ));
        verify(paymentService, never()).createPayment(request);
    }

    @Test
    void anonymousGuestOrderCanCreatePaymentWhenEmailAndOrderNumberMatch() {
        Order order = guestOrder();
        com.example.shop.dto.PaymentCreateRequest request = new com.example.shop.dto.PaymentCreateRequest();
        request.setOrderId(42L);
        request.setOrderNo("SO202605260001");
        request.setGuestEmail("mia@example.com");
        request.setChannel("STRIPE");
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);

        when(orderService.getOrderById(42L)).thenReturn(order);
        when(orderService.guestOrderAccessMatches(order, "mia@example.com", "SO202605260001")).thenReturn(true);
        when(paymentService.createPayment(request)).thenReturn(payment);

        ResponseEntity<?> response = controller.createPayment(
                request,
                null,
                new MockHttpServletRequest("POST", "/payments")
        );

        assertEquals(200, response.getStatusCodeValue());
        verify(paymentService).createPayment(request);
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

    private void grantOrderPaymentPermission() {
        when(adminRoleService.canAccess(1L, "/admin/orders")).thenReturn(true);
        when(adminRoleService.hasPermission(1L, AdminRoleService.ORDER_PAYMENT_PERMISSION)).thenReturn(true);
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

    private Order guestOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setOrderNo("SO202605260001");
        order.setGuestOrder(true);
        order.setContactEmail("mia@example.com");
        return order;
    }
}
