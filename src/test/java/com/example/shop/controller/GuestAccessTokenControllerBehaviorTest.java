package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.dto.SupportSessionCustomerResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.entity.SupportSession;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.GuestAccessRateLimitService;
import com.example.shop.service.GuestAccessTokenService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentChannelRecommendationService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.PaymentWebhookEvidenceService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.SupportService;
import com.example.shop.service.SupportWebSocketTicketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class GuestAccessTokenControllerBehaviorTest {
    private static final String ORDER_NO = "SO202608170001";
    private static final String EMAIL = "guest@example.com";
    private static final String SECRET = "guest-access-test-secret-012345678901234567890123456789";

    private RuntimeConfigService runtimeConfig;
    private GuestAccessTokenService tokenService;
    private PaymentService paymentService;
    private OrderService orderService;
    private SupportService supportService;
    private PaymentController paymentController;
    private SupportController supportController;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        tokenService = new GuestAccessTokenService(runtimeConfig, SECRET);
        paymentService = mock(PaymentService.class);
        orderService = mock(OrderService.class);
        supportService = mock(SupportService.class);

        PaymentChannelConfig channelConfig = mock(PaymentChannelConfig.class);
        when(channelConfig.getDefaultCurrency()).thenReturn("USD");
        paymentController = new PaymentController(
                paymentService,
                mock(PaymentWebhookEvidenceService.class),
                orderService,
                mock(SecurityAuditLogService.class),
                channelConfig,
                mock(PaymentChannelRecommendationService.class),
                mock(IpBlacklistService.class),
                mock(AdminRoleService.class));
        ReflectionTestUtils.setField(paymentController, "guestAccessRateLimitService",
                mock(GuestAccessRateLimitService.class));
        ReflectionTestUtils.setField(paymentController, "guestAccessTokenService", tokenService);

        supportController = new SupportController(
                supportService,
                mock(AdminRoleService.class),
                mock(PetBirthdayCouponService.class),
                orderService,
                mock(IpBlacklistService.class),
                mock(SecurityAuditLogService.class),
                mock(SupportWebSocketTicketService.class));
        ReflectionTestUtils.setField(supportController, "guestAccessRateLimitService",
                mock(GuestAccessRateLimitService.class));
        ReflectionTestUtils.setField(supportController, "guestAccessTokenService", tokenService);
    }

    @Test
    void paymentCreateAcceptsOrderBoundTokenWithoutGuestEmail() {
        Order order = guestOrder();
        Payment payment = payment();
        String token = tokenService.issue(ORDER_NO, EMAIL);
        when(orderService.getOrderById(order.getId())).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn(EMAIL);
        when(paymentService.createPayment(any(PaymentCreateRequest.class))).thenReturn(payment);

        PaymentCreateRequest request = new PaymentCreateRequest();
        request.setOrderId(order.getId());
        request.setChannel("STRIPE");
        request.setOrderNo(ORDER_NO);
        request.setGuestAccessToken(token);

        ResponseEntity<?> response = paymentController.createPayment(
                request,
                null,
                requestWithToken("POST", "/payments", token));

        assertEquals(200, response.getStatusCodeValue());
        verify(paymentService).createPayment(request);
    }

    @Test
    void paymentSyncAcceptsHeaderTokenWhenBodyHasNoEmailOrToken() {
        Order order = guestOrder();
        Payment payment = payment();
        String token = tokenService.issue(ORDER_NO, EMAIL);
        when(paymentService.findById(payment.getId())).thenReturn(payment);
        when(orderService.getOrderById(order.getId())).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn(EMAIL);
        when(paymentService.syncPayment(payment.getId())).thenReturn(payment);

        ResponseEntity<?> response = paymentController.syncPayment(
                payment.getId(),
                Map.of("orderNo", ORDER_NO),
                null,
                requestWithToken("POST", "/payments/9/sync", token));

        assertEquals(200, response.getStatusCodeValue());
        verify(paymentService).syncPayment(payment.getId());
    }

    @Test
    void forgedPaymentTokenIsRejectedBeforeProviderMutation() {
        Order order = guestOrder();
        when(orderService.getOrderById(order.getId())).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn(EMAIL);

        PaymentCreateRequest request = new PaymentCreateRequest();
        request.setOrderId(order.getId());
        request.setChannel("STRIPE");
        request.setOrderNo(ORDER_NO);
        request.setGuestAccessToken("forged-token");

        assertThrows(ResponseStatusException.class, () -> paymentController.createPayment(
                request,
                null,
                requestWithToken("POST", "/payments", "forged-token")));
        verify(paymentService, never()).createPayment(any(PaymentCreateRequest.class));
    }

    @Test
    void supportSessionAcceptsOrderBoundTokenWithoutGuestEmail() {
        Order order = guestOrder();
        String token = tokenService.issue(ORDER_NO, EMAIL);
        SupportSession session = new SupportSession();
        session.setId(77L);
        session.setUserId(order.getUserId());
        session.setStatus("OPEN");
        when(orderService.getTrackableGuestOrderByOrderNo(ORDER_NO)).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn(EMAIL);
        when(supportService.getOrCreateOpenSession(order.getUserId(), "guest-order:" + ORDER_NO.toLowerCase()))
                .thenReturn(session);

        SupportSessionCustomerResponse response = supportController.createGuestSession(
                Map.of("orderNo", ORDER_NO),
                requestWithToken("POST", "/support/guest/session", token));

        assertEquals(77L, response.getId());
        verify(supportService).getOrCreateOpenSession(order.getUserId(), "guest-order:" + ORDER_NO.toLowerCase());
    }

    @Test
    void forgedSupportTokenIsRejectedBeforeSessionLookup() {
        Order order = guestOrder();
        when(orderService.getTrackableGuestOrderByOrderNo(ORDER_NO)).thenReturn(order);
        when(orderService.isGuestOrder(order)).thenReturn(true);
        when(orderService.guestOrderEmailFingerprintValue(order)).thenReturn(EMAIL);

        assertThrows(ResponseStatusException.class, () -> supportController.createGuestSession(
                Map.of("orderNo", ORDER_NO),
                requestWithToken("POST", "/support/guest/session", "forged-token")));
        verify(supportService, never()).getOrCreateOpenSession(any(Long.class), any(String.class));
    }

    private Order guestOrder() {
        Order order = new Order();
        order.setId(42L);
        order.setUserId(7L);
        order.setOrderNo(ORDER_NO);
        order.setGuestOrder(true);
        order.setContactEmail(EMAIL);
        return order;
    }

    private Payment payment() {
        Payment payment = new Payment();
        payment.setId(9L);
        payment.setOrderId(42L);
        payment.setOrderNo(ORDER_NO);
        payment.setAmount(new BigDecimal("12.00"));
        payment.setChannel("STRIPE");
        payment.setStatus("PENDING");
        return payment;
    }

    private MockHttpServletRequest requestWithToken(String method, String path, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader(GuestAccessTokenService.HEADER_NAME, token);
        return request;
    }
}
