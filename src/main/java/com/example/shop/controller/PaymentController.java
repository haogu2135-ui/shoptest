package com.example.shop.controller;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentChannelResponse;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.OrderService;
import com.example.shop.service.IpBlacklistService;
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
import java.util.stream.Collectors;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;
    private final OrderService orderService;
    private final SecurityAuditLogService auditLogService;
    private final PaymentChannelConfig paymentChannelConfig;
    private final PaymentChannelRecommendationService paymentChannelRecommendationService;
    private final IpBlacklistService ipBlacklistService;

    @GetMapping("/channels")
    public List<PaymentChannelResponse> channels(HttpServletRequest request) {
        List<PaymentChannelConfig.Channel> channels = paymentChannelConfig.enabledChannels().stream()
                .filter(paymentService::isChannelAvailableForCheckout)
                .collect(Collectors.toList());
        return paymentChannelRecommendationService.buildChannelResponses(channels, request);
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
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_CREATE", "FAILURE", authentication, "ORDER", request.getOrderId(), httpRequest,
                    e.getMessage(), "channel=" + request.getChannel());
            ipBlacklistService.recordPaymentFailure(httpRequest, e.getMessage());
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_CREATE", "FAILURE", authentication, "ORDER", request.getOrderId(), httpRequest,
                    reasonOf(e), "channel=" + request.getChannel());
            ipBlacklistService.recordPaymentFailure(httpRequest, reasonOf(e));
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
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            ipBlacklistService.recordPaymentFailure(request, e.getMessage());
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            ipBlacklistService.recordPaymentFailure(request, reasonOf(e));
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
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            ipBlacklistService.recordPaymentFailure(request, e.getMessage());
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            ipBlacklistService.recordPaymentFailure(request, reasonOf(e));
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
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            ipBlacklistService.recordPaymentFailure(request, e.getMessage());
            throw e;
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SYNC", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            ipBlacklistService.recordPaymentFailure(request, reasonOf(e));
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
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_CALLBACK", "FAILURE", null, null, null, "ORDER", request.getOrderNo(), httpRequest,
                    e.getMessage(), "channel=" + request.getChannel());
            ipBlacklistService.recordPaymentFailure(httpRequest, e.getMessage());
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
            ipBlacklistService.recordPaymentFailure(request, e.getMessage());
            throw e;
        } catch (IllegalStateException e) {
            auditLogService.record("STRIPE_WEBHOOK", "FAILURE", null, null, null, "PAYMENT", null, request, e.getMessage(), null);
            ipBlacklistService.recordPaymentFailure(request, e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Payment provider is temporarily unavailable", e);
        }
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<Payment>> findByOrderId(@PathVariable Long orderId,
                                                       @RequestParam(required = false) String guestEmail,
                                                       @RequestParam(required = false) String orderNo,
                                                       Authentication authentication) {
        assertCanSeeOrder(orderId, authentication, guestEmail, orderNo);
        return ResponseEntity.ok(paymentService.findByOrderId(orderId));
    }

    @GetMapping("/order/{orderId}/latest")
    public ResponseEntity<Payment> findLatestByOrderId(@PathVariable Long orderId,
                                                       @RequestParam(required = false) String guestEmail,
                                                       @RequestParam(required = false) String orderNo,
                                                       Authentication authentication) {
        assertCanSeeOrder(orderId, authentication, guestEmail, orderNo);
        Payment payment = paymentService.findLatestByOrderId(orderId);
        return payment != null ? ResponseEntity.ok(payment) : ResponseEntity.notFound().build();
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication) {
        assertCanSeeOrder(orderId, authentication, null);
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication, String guestEmail) {
        assertCanSeeOrder(orderId, authentication, guestEmail, null);
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication, String guestEmail, String orderNo) {
        Order order = orderService.getOrderById(orderId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, guestEmail, orderNo, "Payment is not available for this order");
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
        SecurityUtils.assertAdmin(authentication);
    }

    private void assertCanOperateOrder(Order order, Authentication authentication, String guestEmail, String orderNo, String forbiddenMessage) {
        if (customerAccessMatches(order, guestEmail, orderNo)) {
            return;
        }
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            SecurityUtils.assertSelfOrAdmin(authentication, order.getUserId());
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
    }

    private boolean customerAccessMatches(Order order, String email, String orderNo) {
        return orderNoMatches(order, orderNo) && customerEmailMatches(order, email);
    }

    private boolean orderNoMatches(Order order, String orderNo) {
        return orderNo != null
                && order.getOrderNo() != null
                && order.getOrderNo().trim().equalsIgnoreCase(orderNo.trim());
    }

    private boolean customerEmailMatches(Order order, String email) {
        return orderService.orderEmailMatches(order, email) || orderService.guestOrderEmailMatches(order, email);
    }

    private String reasonOf(ResponseStatusException e) {
        return e.getReason() != null ? e.getReason() : e.getMessage();
    }
}
