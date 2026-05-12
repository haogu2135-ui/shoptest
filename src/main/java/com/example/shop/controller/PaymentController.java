package com.example.shop.controller;

import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.OrderService;
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

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final PaymentService paymentService;
    private final OrderService orderService;
    private final SecurityAuditLogService auditLogService;

    @PostMapping
    public ResponseEntity<?> createPayment(@Valid @RequestBody PaymentCreateRequest request, Authentication authentication, HttpServletRequest httpRequest) {
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
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_CREATE", "FAILURE", authentication, "ORDER", request.getOrderId(), httpRequest,
                    reasonOf(e), "channel=" + request.getChannel());
            throw e;
        }
    }

    @PostMapping("/{id}/simulate-paid")
    public ResponseEntity<?> simulatePaid(@PathVariable Long id,
                                          @RequestBody(required = false) Map<String, String> body,
                                          Authentication authentication,
                                          HttpServletRequest request) {
        try {
            assertCanOperatePayment(id, authentication, body != null ? body.get("guestEmail") : null);
            Payment payment = paymentService.simulatePaid(id);
            auditLogService.record("PAYMENT_SIMULATE_PAID", "SUCCESS", authentication, "PAYMENT", id, request,
                    "Payment simulated as paid", payment.getOrderNo());
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_PAID", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            throw e;
        }
    }

    @PostMapping("/{id}/simulate-callback")
    public ResponseEntity<?> simulateCallback(@PathVariable Long id,
                                              @RequestBody(required = false) Map<String, String> body,
                                              Authentication authentication,
                                              HttpServletRequest request) {
        try {
            assertCanOperatePayment(id, authentication, body != null ? body.get("guestEmail") : null);
            Payment payment = paymentService.simulateCallback(id);
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "SUCCESS", authentication, "PAYMENT", id, request,
                    "Payment callback simulated", payment.getOrderNo());
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (ResponseStatusException e) {
            auditLogService.record("PAYMENT_SIMULATE_CALLBACK", "FAILURE", authentication, "PAYMENT", id, request,
                    reasonOf(e), null);
            throw e;
        }
    }

    @PostMapping("/callback")
    public ResponseEntity<?> callback(@Valid @RequestBody PaymentCallbackRequest request, HttpServletRequest httpRequest) {
        try {
            Payment payment = paymentService.handleCallback(request);
            auditLogService.record("PAYMENT_CALLBACK", "SUCCESS", null, null, null, "PAYMENT", payment.getId(), httpRequest,
                    "Payment callback accepted",
                    "orderNo=" + request.getOrderNo() + ",channel=" + request.getChannel() + ",status=" + request.getStatus());
            return ResponseEntity.ok(payment);
        } catch (IllegalArgumentException | IllegalStateException e) {
            auditLogService.record("PAYMENT_CALLBACK", "FAILURE", null, null, null, "ORDER", request.getOrderNo(), httpRequest,
                    e.getMessage(), "channel=" + request.getChannel());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/stripe/webhook")
    public ResponseEntity<?> stripeWebhook(
            @RequestBody String payload,
            @RequestHeader(value = "Stripe-Signature", required = false) String signatureHeader,
            HttpServletRequest request) {
        try {
            Payment payment = paymentService.handleStripeWebhook(payload, signatureHeader);
            auditLogService.record("STRIPE_WEBHOOK", "SUCCESS", null, null, null,
                    "PAYMENT", payment != null ? payment.getId() : null, request,
                    "Stripe webhook accepted", null);
            return ResponseEntity.ok(Map.of("received", true));
        } catch (IllegalArgumentException e) {
            auditLogService.record("STRIPE_WEBHOOK", "FAILURE", null, null, null, "PAYMENT", null, request, e.getMessage(), null);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            auditLogService.record("STRIPE_WEBHOOK", "FAILURE", null, null, null, "PAYMENT", null, request, e.getMessage(), null);
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/order/{orderId}")
    public ResponseEntity<List<Payment>> findByOrderId(@PathVariable Long orderId, Authentication authentication) {
        assertCanSeeOrder(orderId, authentication);
        return ResponseEntity.ok(paymentService.findByOrderId(orderId));
    }

    @GetMapping("/order/{orderId}/latest")
    public ResponseEntity<Payment> findLatestByOrderId(@PathVariable Long orderId, Authentication authentication) {
        assertCanSeeOrder(orderId, authentication);
        Payment payment = paymentService.findLatestByOrderId(orderId);
        return payment != null ? ResponseEntity.ok(payment) : ResponseEntity.notFound().build();
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatus()).body(Map.of("error", e.getReason()));
    }

    private void assertCanSeeOrder(Long orderId, Authentication authentication) {
        Order order = orderService.getOrderById(orderId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        SecurityUtils.assertSelfOrAdmin(authentication, order.getUserId());
    }

    private void assertCanCreatePayment(PaymentCreateRequest request, Authentication authentication) {
        Order order = orderService.getOrderById(request.getOrderId());
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, request.getGuestEmail(), "Payment is not available for this order");
    }

    private void assertCanOperatePayment(Long paymentId, Authentication authentication, String guestEmail) {
        Payment payment = paymentService.findById(paymentId);
        if (payment == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found");
        }
        Order order = orderService.getOrderById(payment.getOrderId());
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        assertCanOperateOrder(order, authentication, guestEmail, "Payment operation is not available for this order");
    }

    private void assertCanOperateOrder(Order order, Authentication authentication, String guestEmail, String forbiddenMessage) {
        if (authentication != null && authentication.getPrincipal() instanceof UserDetailsImpl) {
            SecurityUtils.assertSelfOrAdmin(authentication, order.getUserId());
            return;
        }
        if (!isGuestOrder(order) || !guestEmailMatches(order, guestEmail)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, forbiddenMessage);
        }
    }

    private boolean isGuestOrder(Order order) {
        String shippingAddress = order.getShippingAddress();
        return shippingAddress != null && shippingAddress.startsWith("[Guest] ");
    }

    private boolean guestEmailMatches(Order order, String guestEmail) {
        if (guestEmail == null || guestEmail.trim().isEmpty() || order.getShippingAddress() == null) {
            return false;
        }
        String normalizedEmail = guestEmail.trim().toLowerCase();
        String normalizedAddress = order.getShippingAddress().toLowerCase();
        return normalizedAddress.contains(" / " + normalizedEmail + " / ");
    }

    private String reasonOf(ResponseStatusException e) {
        return e.getReason() != null ? e.getReason() : e.getMessage();
    }
}
