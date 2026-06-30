package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.GuestOrderAccessRequest;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentChannelResponse;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.dto.PaymentCustomerResponse;
import com.example.shop.dto.PaymentResponse;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PaymentChannelRecommendationService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.SecurityAuditLogService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping({"/payments", "/payment"})
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;
    private final OrderService orderService;
    private final SecurityAuditLogService auditLogService;
    private final PaymentChannelConfig paymentChannelConfig;
    private final PaymentChannelRecommendationService paymentChannelRecommendationService;
    private final IpBlacklistService ipBlacklistService;
    private final AdminRoleService adminRoleService;

    @GetMapping("/channels")
    public List<PaymentChannelResponse> channels(HttpServletRequest request) {
        List<PaymentChannelConfig.Channel> channels = paymentChannelConfig.enabledChannels().stream()
                .filter(paymentService::isChannelAvailableForCheckout)
                .collect(Collectors.toList());
        return paymentChannelRecommendationService.buildChannelResponses(channels, request);
    }

    @GetMapping({"", "/"})
    public Map<String, Object> paymentInfo(HttpServletRequest request) {
        return Map.of(
                "status", "available",
                "channels", channels(request),
                "endpoints", Map.of(
                        "create", "/payments",
                        "channels", "/payments/channels",
                        "order", "/payments/order/{orderId}",
                        "syncOrder", "/payments/order/{orderId}/sync"));
    }

    @PostMapping
    public ResponseEntity<?> createPayment(@Valid @RequestBody(required = false) PaymentCreateRequest request, Authentication authentication, HttpServletRequest httpRequest) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment request is required");
        }
        try {
            assertCanCreatePayment(request, authentication);
            Payment payment = paymentService.createPayment(request);
            auditLogService.record("PAYMENT_CREATE", "SUCCESS", authentication, "PAYMENT", payment.getId(), httpRequest,
                    "Payment created",
                    "orderId=" + request.getOrderId() + ",channel=" + payment.getChannel() + ",amount=" + payment.getAmount());
            return ResponseEntity.ok(customerPaymentResponse(payment));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_CREATE", "FAILURE", authentication, "ORDER", request.getOrderId(), httpRequest,
                    e.getMessage(), "channel=" + request.getChannel());
            recordPaymentBlacklistFailureIfSuspicious(httpRequest, e);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_CREATE", "FAILURE", authentication, "ORDER", request.getOrderId(), httpRequest,
                    reasonOf(e), "channel=" + request.getChannel());
            recordPaymentBlacklistFailureIfSuspicious(httpRequest, e);
            throw e;
        }
    }

    @PostMapping("/{id}/simulate-paid")
    public ResponseEntity<?> simulatePaid(@PathVariable Long id,
                                          @RequestBody(required = false) Map<String, String> body,
                                          Authentication authentication,
                                          HttpServletRequest request) {
        try {
            assertAdminPaymentSimulation(authentication);
            Payment payment = paymentService.simulatePaid(id);
            auditLogService.record("PAYMENT_SIMULATE_PAID", "SUCCESS", authentication, "PAYMENT", id, request,
                    "Payment simulated as paid", payment.getOrderNo());
            return ResponseEntity.ok(paymentResponse(payment));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        }
    }

    @PostMapping("/{id}/simulate-callback")
    public ResponseEntity<?> simulateCallback(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, String> body,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        try {
            assertAdminPaymentSimulation(authentication);
            Payment payment = paymentService.simulateCallback(id);
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "SUCCESS", authentication, "PAYMENT", id, request,
                    "Payment callback simulated", payment.getOrderNo());
            return ResponseEntity.ok(paymentResponse(payment));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        }
    }

    @PostMapping("/{id}/sync")
    public ResponseEntity<?> syncPayment(@PathVariable Long id,
                                         @RequestBody(required = false) Map<String, String> body,
                                         Authentication authentication,
                                         HttpServletRequest request) {
        try {
            assertCanOperatePayment(id, authentication, body != null ? body.get("guestEmail") : null, body != null ? body.get("orderNo") : null);
            Payment payment = paymentService.syncPayment(id);
            auditLogService.record("PAYMENT_SYNC", "SUCCESS", authentication, "PAYMENT", id, request,
                    "Payment state synced", payment.getOrderNo());
            return ResponseEntity.ok(customerPaymentResponse(payment));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        }
    }

    @PostMapping("/order/{orderId}/sync")
    public ResponseEntity<List<PaymentCustomerResponse>> syncOrderPayments(@PathVariable Long orderId,
                                                                           Authentication authentication,
                                                                           HttpServletRequest request) {
        try {
            assertCanSeeOrder(orderId, authentication);
            List<Payment> payments = paymentService.syncPaymentsByOrderId(orderId);
            auditLogService.record("PAYMENT_SYNC_ORDER", "SUCCESS", authentication, "ORDER", orderId, request,
                    "Order payment states synced", "count=" + payments.size());
            return ResponseEntity.ok(customerPaymentResponses(payments));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SYNC_ORDER", "FAILURE", authentication, "ORDER", orderId, request,
                    e.getMessage(), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SYNC_ORDER", "FAILURE", authentication, "ORDER", orderId, request,
                    reasonOf(e), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        }
    }

    @PostMapping("/callback")
    public ResponseEntity<?> callback(@Valid @RequestBody(required = false) PaymentCallbackRequest request, HttpServletRequest httpRequest) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment callback payload is required");
        }
        try {
            Payment payment = paymentService.handleCallback(request);
            auditLogService.record("PAYMENT_CALLBACK", "SUCCESS", null, null, null, "PAYMENT", payment.getId(), httpRequest,
                    "Payment callback accepted",
                    "orderNo=" + request.getOrderNo() + ",channel=" + request.getChannel() + ",status=" + request.getStatus());
            return ResponseEntity.ok(Map.of("received", true));
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_CALLBACK", "FAILURE", null, null, null, "ORDER", request.getOrderNo(), httpRequest,
                    e.getMessage(), "channel=" + request.getChannel());
            recordPaymentBlacklistFailureIfSuspicious(httpRequest, e);
            throw e;
        }
    }

    @PostMapping("/stripe/webhook")
    public ResponseEntity<?> stripeWebhook(
            @RequestBody(required = false) String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signatureHeader,
            HttpServletRequest request) {
        if (payload == null || payload.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Stripe webhook payload is required");
        }
        try {
            Payment payment = paymentService.handleStripeWebhook(payload, signatureHeader);
            auditLogService.record("STRIPE_WEBHOOK", "SUCCESS", null, null, null,
                    "PAYMENT", payment != null ? payment.getId() : null, request,
                    "Stripe webhook accepted", null);
            return ResponseEntity.ok(Map.of("received", true));
        } catch (IllegalArgumentException e) {
            auditLogService.record("STRIPE_WEBHOOK", "FAILURE", null, null, null, "PAYMENT", null, request, e.getMessage(), null);
            recordPaymentBlacklistFailureIfSuspicious(request, e);
            throw e;
        } catch (IllegalStateException e) {
            auditLogService.record("STRIPE_WEBHOOK", "FAILURE", null, null, null, "PAYMENT", null, request, e.getMessage(), null);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Payment provider is temporarily unavailable", e);
        }
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<PaymentCustomerResponse>> findByOrderId(@PathVariable Long orderId,
                                                                       Authentication authentication) {
        assertCanSeeOrder(orderId, authentication);
        List<Payment> payments = paymentService.findStoredByOrderId(orderId);
        return ResponseEntity.ok(customerPaymentResponses(payments));
    }

    @PostMapping("/guest/order/{orderId}")
    public ResponseEntity<List<PaymentCustomerResponse>> findGuestByOrderId(@PathVariable Long orderId,
                                                                            @Valid @RequestBody(required = false) GuestOrderAccessRequest body,
                                                                            HttpServletRequest request) {
        GuestOrderAccessRequest access = requireGuestAccessRequest(body);
        assertCanSeeGuestOrder(orderId, access.getGuestEmail(), access.getOrderNo(), request);
        return ResponseEntity.ok(paymentService.findStoredByOrderId(orderId).stream()
                .map(this::customerPaymentResponse)
                .collect(Collectors.toList()));
    }

    @GetMapping("/order/{orderId}/latest")
    public ResponseEntity<PaymentCustomerResponse> findLatestByOrderId(@PathVariable Long orderId,
                                                                       Authentication authentication) {
        assertCanSeeOrder(orderId, authentication);
        Payment payment = paymentService.findStoredLatestByOrderId(orderId);
        return payment != null ? ResponseEntity.ok(customerPaymentResponse(payment)) : ResponseEntity.notFound().build();
    }

    @PostMapping("/guest/order/{orderId}/latest")
    public ResponseEntity<PaymentCustomerResponse> findLatestGuestByOrderId(@PathVariable Long orderId,
                                                                            @Valid @RequestBody(required = false) GuestOrderAccessRequest body,
                                                                            HttpServletRequest request) {
        GuestOrderAccessRequest access = requireGuestAccessRequest(body);
        assertCanSeeGuestOrder(orderId, access.getGuestEmail(), access.getOrderNo(), request);
        Payment payment = paymentService.findStoredLatestByOrderId(orderId);
        return payment != null ? ResponseEntity.ok(customerPaymentResponse(payment)) : ResponseEntity.notFound().build();
    }

    private GuestOrderAccessRequest requireGuestAccessRequest(GuestOrderAccessRequest body) {
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Guest payment access payload is required");
        }
        return body;
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication) {
        assertCanSeeOrder(orderId, authentication, null, null);
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication, String guestEmail, String orderNo) {
        Order order = orderService.getOrderById(orderId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, guestEmail, orderNo, "Payment is not available for this order");
    }

    private void assertCanSeeGuestOrder(Long orderId, String guestEmail, String orderNo, HttpServletRequest request) {
        Order order = orderService.getOrderById(orderId);
        if (order == null) {
            ipBlacklistService.recordPaymentFailure(request, "guest-payment order not found");
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (!guestOrderAccessMatches(order, guestEmail, orderNo)) {
            ipBlacklistService.recordPaymentFailure(request, "guest-payment credentials failed");
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Guest payment access is not available for this order");
        }
    }

    private void assertCanCreatePayment(PaymentCreateRequest request, Authentication authentication) {
        if (request == null || request.getOrderId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order is required");
        }
        Order order = orderService.getOrderById(request.getOrderId());
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, request.getGuestEmail(), request.getOrderNo(), "Payment is not available for this order");
    }

    private void assertCanOperatePayment(Long paymentId, Authentication authentication, String guestEmail, String orderNo) {
        Payment payment = paymentService.findById(paymentId);
        if (payment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found");
        }
        Order order = orderService.getOrderById(payment.getOrderId());
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, guestEmail, orderNo, "Payment operation is not available for this order");
    }

    private void assertAdminPaymentSimulation(Authentication authentication) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (SecurityUtils.isAdmin(user)
                && adminRoleService.canAccess(user.getId(), "/admin/orders")
                && adminRoleService.hasPermission(user.getId(), AdminRoleService.ORDER_PAYMENT_PERMISSION)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Payment simulation permission required");
    }

    private void assertCanOperateOrder(Order order, Authentication authentication, String guestEmail, String orderNo, String forbiddenMessage) {
        if (guestOrderAccessMatches(order, guestEmail, orderNo)) {
            return;
        }
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            UserDetailsImpl user = (UserDetailsImpl) authentication.getPrincipal();
            if (Objects.equals(user.getId(), order.getUserId())) {
                return;
            }
            if (SecurityUtils.isAdmin(user)) {
                assertAdminOrderPaymentAccess(user, forbiddenMessage);
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
    }

    private void assertAdminOrderPaymentAccess(UserDetailsImpl user, String forbiddenMessage) {
        if (adminRoleService.canAccess(user.getId(), "/admin/orders")
                && adminRoleService.hasPermission(user.getId(), AdminRoleService.ORDER_PAYMENT_PERMISSION)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
    }

    private boolean guestOrderAccessMatches(Order order, String email, String orderNo) {
        return orderService.guestOrderAccessMatches(order, email, orderNo);
    }

    private PaymentResponse paymentResponse(Payment payment) {
        return PaymentResponse.from(payment, resolvePaymentCurrency(payment));
    }

    private PaymentCustomerResponse customerPaymentResponse(Payment payment) {
        return PaymentCustomerResponse.from(payment, resolvePaymentCurrency(payment));
    }

    private List<PaymentCustomerResponse> customerPaymentResponses(List<Payment> payments) {
        return payments.stream().map(this::customerPaymentResponse).collect(Collectors.toList());
    }

    private String resolvePaymentCurrency(Payment payment) {
        if (payment == null) {
            return paymentChannelConfig.getDefaultCurrency();
        }
        return paymentChannelConfig.findConfigured(payment.getChannel())
                .map(PaymentChannelConfig.Channel::getCurrency)
                .filter(Objects::nonNull)
                .filter(currency -> !currency.trim().isEmpty())
                .orElse(paymentChannelConfig.getDefaultCurrency());
    }

    private String reasonOf(ResponseStatusException e) {
        return e.getReason() != null ? e.getReason() : e.getMessage();
    }

    private void recordPaymentBlacklistFailureIfSuspicious(HttpServletRequest request, RuntimeException e) {
        if (!shouldRecordPaymentBlacklistFailure(e)) {
            return;
        }
        String reason = e instanceof ResponseStatusException
                ? reasonOf((ResponseStatusException) e)
                : e.getMessage();
        ipBlacklistService.recordPaymentFailure(request, reason);
    }

    private boolean shouldRecordPaymentBlacklistFailure(RuntimeException e) {
        if (e instanceof IllegalArgumentException) {
            return true;
        }
        if (e instanceof ResponseStatusException) {
            HttpStatus status = ((ResponseStatusException) e).getStatus();
            return status != null && status.is4xxClientError();
        }
        return false;
    }
}
