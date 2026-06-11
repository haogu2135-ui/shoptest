package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.util.GatewayUrlValidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Currency;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
public class PaymentService {
    private static final String DEFAULT_STOREFRONT_BASE_URL = "https://pet.686888666.xyz";
    private static final String PENDING = "PENDING";
    private static final String PAID = "PAID";
    private static final String FAILED = "FAILED";
    private static final String EXPIRED = "EXPIRED";
    private static final String CANCELLED = "CANCELLED";
    private static final String REFUNDING = "REFUNDING";
    private static final String REFUNDED = "REFUNDED";
    private static final String RECONCILE_REQUIRED = "RECONCILE_REQUIRED";
    private static final long DEFAULT_CALLBACK_MAX_SKEW_SECONDS = 300L;

    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private OrderService orderService;
    @Autowired
    private PaymentChannelConfig paymentChannelConfig;
    @Autowired
    private PaymentChannelAvailabilityService paymentChannelAvailabilityService;
    @Autowired
    private RuntimeConfigService runtimeConfig;
    @Autowired
    private CircuitBreakerService circuitBreakerService;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public Payment createPayment(PaymentCreateRequest request) {
        if (request == null || request.getOrderId() == null || request.getOrderId() <= 0) {
            throw new IllegalArgumentException("Order id is required");
        }
        Order order = orderService.getOrderById(request.getOrderId());
        if (order == null) {
            throw new IllegalArgumentException("Order not found");
        }
        validateOrderReadyForPayment(order);
        if (!"PENDING_PAYMENT".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending-payment orders can create payment");
        }

        PaymentChannelConfig.Channel channelConfig = paymentChannelAvailabilityService.requireAvailableForCheckout(request.getChannel());
        String channel = channelConfig.getCode();
        Payment existingForChannel = paymentRepository.findByOrderIdAndChannel(order.getId(), channel);
        if (existingForChannel != null) {
            if (PAID.equals(existingForChannel.getStatus())) {
                logPaymentLifecycle("Payment create reused paid payment", existingForChannel);
                return existingForChannel;
            }
            if (PENDING.equals(existingForChannel.getStatus())) {
                if (isExpired(existingForChannel)) {
                    return refreshPayment(existingForChannel, order, channel);
                }
                logPaymentLifecycle("Payment create reused active pending payment", existingForChannel);
                return existingForChannel;
            }
            if (FAILED.equals(existingForChannel.getStatus()) || EXPIRED.equals(existingForChannel.getStatus())) {
                return refreshPayment(existingForChannel, order, channel);
            }
        }

        try {
            LocalDateTime now = LocalDateTime.now();
            if (channelConfig.isStripeProvider()) {
                return createStripePayment(order, now, channelConfig);
            }
            if (channelConfig.isGenericApiProvider()) {
                return createGenericApiPayment(order, now, channelConfig);
            }
            return createRedirectPayment(order, now, channelConfig);
        } catch (DataIntegrityViolationException e) {
            Payment raced = paymentRepository.findByOrderIdAndChannel(order.getId(), channel);
            if (raced != null) {
                logPaymentLifecycle("Payment create reused concurrently inserted payment", raced);
                return raced;
            }
            throw e;
        }
    }

    @Transactional
    public Payment simulatePaid(Long paymentId) {
        assertPaymentSimulationEnabled();
        Payment payment = paymentRepository.findById(paymentId);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if (isExpired(payment)) {
            expirePayment(payment);
            throw new IllegalStateException("Payment has expired");
        }
        if (PAID.equals(payment.getStatus())) {
            return paymentRepository.findById(paymentId);
        }
        if (!PENDING.equals(payment.getStatus())) {
            throw new IllegalStateException("Only pending payments can be paid");
        }
        String transactionId = newTransactionId();
        claimOrderForPaymentSuccess(payment.getOrderId());
        int updated = paymentRepository.markPaidDetailed(paymentId, transactionId, transactionId, LocalDateTime.now(ZoneOffset.UTC));
        if (updated == 0) {
            Payment latest = paymentRepository.findById(paymentId);
            if (latest != null && PAID.equals(latest.getStatus())) {
                return latest;
            }
            throw new IllegalStateException("Payment state update failed");
        }
        return paymentRepository.findById(paymentId);
    }

    @Transactional
    public Payment simulateCallback(Long paymentId) {
        assertPaymentSimulationEnabled();
        Payment payment = paymentRepository.findById(paymentId);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        if (PAID.equals(payment.getStatus())) {
            return payment;
        }
        request.setOrderNo(payment.getOrderNo());
        request.setChannel(payment.getChannel());
        String simulatedTransactionId = firstNonBlank(payment.getTransactionId(), newTransactionId());
        request.setTransactionId(simulatedTransactionId);
        request.setProviderReference(firstNonBlank(payment.getProviderReference(), simulatedTransactionId, "sim-" + payment.getId()));
        request.setStatus("SUCCESS");
        request.setAmount(payment.getAmount());
        request.setCallbackTimestamp(Instant.now().getEpochSecond());
        request.setSignature(expectedSignature(request));
        return handleCallback(request);
    }

    @Transactional
    public Payment handleCallback(PaymentCallbackRequest request) {
        assertProductionCallbackSecretConfigured();
        String channel = normalizeConfiguredChannel(request.getChannel());
        Payment payment = paymentRepository.findByOrderNoAndChannel(request.getOrderNo(), channel);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if (!verifySignature(request)) {
            log.warn("Payment callback rejected invalid signature: paymentId={}, orderId={}, orderNo={}, channel={}",
                    payment.getId(), payment.getOrderId(), payment.getOrderNo(), payment.getChannel());
            throw new IllegalArgumentException("Invalid payment callback signature");
        }
        LocalDateTime callbackAt = resolveCallbackAt(request);
        validateCallbackFreshness(callbackAt);
        if (payment.getAmount().compareTo(request.getAmount()) != 0) {
            log.warn("Payment callback rejected amount mismatch: paymentId={}, orderId={}, orderNo={}, channel={}, expectedAmount={}, callbackAmount={}",
                    payment.getId(), payment.getOrderId(), payment.getOrderNo(), payment.getChannel(), payment.getAmount(), request.getAmount());
            throw new IllegalArgumentException("Payment amount mismatch");
        }
        assertMatchingPaidCallback(payment, request);
        String callbackStatus = request.getStatus().toUpperCase(Locale.ROOT);
        if (PAID.equals(callbackStatus) || "SUCCESS".equals(callbackStatus)) {
            if (isProviderPaidAlreadyAcknowledged(payment) || RECONCILE_REQUIRED.equals(payment.getStatus())) {
                return payment;
            }
            if (requiresProviderPaidReconciliation(payment)) {
                return markProviderPaidReconciliationRequired(
                        payment,
                        request.getTransactionId(),
                        firstNonBlank(request.getProviderReference(), request.getTransactionId()),
                        callbackAt);
            }
            if (!PENDING.equals(payment.getStatus())) {
                throw new IllegalStateException("Payment is not pending");
            }
            if (isExpired(payment)) {
                expirePayment(payment);
                throw new IllegalStateException("Payment has expired");
            }
            Payment reconcilePayment = claimOrderForProviderPaidSuccessOrReconcile(
                    payment,
                    request.getTransactionId(),
                    firstNonBlank(request.getProviderReference(), request.getTransactionId()),
                    callbackAt);
            if (reconcilePayment != null) {
                return reconcilePayment;
            }
            int updated = paymentRepository.markPaidDetailed(
                    payment.getId(),
                    request.getTransactionId(),
                    firstNonBlank(request.getProviderReference(), request.getTransactionId()),
                    callbackAt);
            if (updated == 0) {
                Payment latest = paymentRepository.findById(payment.getId());
                if (latest != null && PAID.equals(latest.getStatus())) {
                    logPaymentLifecycle("Payment callback observed already paid payment", latest);
                    return latest;
                }
                throw new IllegalStateException("Payment state update failed");
            }
            logPaymentLifecycle("Payment callback marked payment paid", payment, PAID);
        } else if (FAILED.equals(callbackStatus)) {
            if (EXPIRED.equals(payment.getStatus())) {
                throw new IllegalStateException("Payment has expired");
            }
            if (!PENDING.equals(payment.getStatus())) {
                throw new IllegalStateException("Payment is not pending");
            }
            paymentRepository.markFailed(payment.getId());
            logPaymentLifecycle("Payment callback marked payment failed", payment, FAILED);
        } else {
            log.warn("Payment callback rejected unsupported status: paymentId={}, orderId={}, orderNo={}, channel={}, callbackStatus={}",
                    payment.getId(), payment.getOrderId(), payment.getOrderNo(), payment.getChannel(), callbackStatus);
            throw new IllegalArgumentException("Unsupported payment callback status");
        }
        return paymentRepository.findById(payment.getId());
    }

    @Transactional
    public Payment handleStripeWebhook(String payload, String signatureHeader) {
        String webhookSecret = stripeWebhookSecret();
        if (isBlank(webhookSecret)) {
            throw new IllegalStateException("Stripe webhook secret is not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, webhookSecret);
        } catch (Exception e) {
            log.warn("Stripe webhook rejected invalid signature");
            throw new IllegalArgumentException("Invalid Stripe webhook signature", e);
        }
        if (!"checkout.session.completed".equals(event.getType()) && !"checkout.session.expired".equals(event.getType())) {
            log.debug("Stripe webhook ignored unsupported event type: type={}", event.getType());
            return null;
        }
        Session session = (Session) event.getDataObjectDeserializer().getObject()
                .orElseThrow(() -> new IllegalArgumentException("Invalid Stripe webhook payload"));
        Payment payment = paymentRepository.findByProviderReference(session.getId());
        if (payment == null) {
            payment = paymentRepository.findByTransactionId(session.getId());
        }
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if ("checkout.session.completed".equals(event.getType())) {
            if (isProviderPaidAlreadyAcknowledged(payment) || RECONCILE_REQUIRED.equals(payment.getStatus())) {
                return payment;
            }
            PaymentChannelConfig.Channel channel = requireStripePaymentChannel(payment);
            validateStripePaidSession(payment, channel, session);
            if (requiresProviderPaidReconciliation(payment)) {
                return markProviderPaidReconciliationRequired(
                        payment,
                        firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                        session.getId(),
                        LocalDateTime.now(ZoneOffset.UTC));
            }
            if (!PENDING.equals(payment.getStatus())) {
                throw new IllegalStateException("Payment is not pending");
            }
            Payment reconcilePayment = claimOrderForProviderPaidSuccessOrReconcile(
                    payment,
                    firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                    session.getId(),
                    LocalDateTime.now(ZoneOffset.UTC));
            if (reconcilePayment != null) {
                return reconcilePayment;
            }
            int updated = paymentRepository.markPaidDetailed(
                    payment.getId(),
                    firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                    session.getId(),
                    LocalDateTime.now(ZoneOffset.UTC));
            if (updated == 0) {
                Payment latest = paymentRepository.findById(payment.getId());
                if (latest != null && PAID.equals(latest.getStatus())) {
                    logPaymentLifecycle("Stripe webhook observed already paid payment", latest);
                    return latest;
                }
                throw new IllegalStateException("Stripe payment state update failed");
            }
            logPaymentLifecycle("Stripe webhook marked payment paid", payment, PAID);
        } else if (PENDING.equals(payment.getStatus())) {
            expirePayment(payment);
        }
        return paymentRepository.findById(payment.getId());
    }

    @Transactional
    public List<Payment> findByOrderId(Long orderId) {
        List<Payment> payments = paymentRepository.findByOrderId(orderId);
        boolean changedAny = false;
        for (Payment payment : payments) {
            if (payment == null) {
                continue;
            }
            Payment synced = syncProviderPaymentState(payment);
            if (synced != null) {
                changedAny = true;
                continue;
            }
            if (isExpired(payment)) {
                expirePayment(payment);
                changedAny = true;
            }
        }
        return changedAny ? paymentRepository.findByOrderId(orderId) : payments;
    }

    @Transactional(readOnly = true)
    public List<Payment> findStoredByOrderId(Long orderId) {
        return paymentRepository.findByOrderId(orderId);
    }

    @Transactional(readOnly = true)
    public Payment findStoredLatestByOrderId(Long orderId) {
        return paymentRepository.findLatestByOrderId(orderId);
    }

    @Transactional
    public Payment syncPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        Payment synced = syncProviderPaymentState(payment);
        if (synced != null) {
            return synced;
        }
        if (isExpired(payment)) {
            expirePayment(payment);
            return paymentRepository.findById(paymentId);
        }
        return payment;
    }

    public Payment findById(Long paymentId) {
        return paymentRepository.findById(paymentId);
    }

    @Transactional
    public Payment findLatestByOrderId(Long orderId) {
        Payment payment = paymentRepository.findLatestByOrderId(orderId);
        Payment synced = syncProviderPaymentState(payment);
        if (synced != null) {
            return synced;
        }
        if (payment != null && isExpired(payment)) {
            expirePayment(payment);
            return paymentRepository.findById(payment.getId());
        }
        return payment;
    }

    public boolean isChannelAvailableForCheckout(PaymentChannelConfig.Channel channelConfig) {
        return paymentChannelAvailabilityService.isChannelAvailableForCheckout(channelConfig);
    }

    @Scheduled(fixedDelayString = "${payment.expiry-scan-ms:60000}")
    public void expirePendingPayments() {
        for (Payment payment : paymentRepository.findExpiredPending()) {
            try {
                expireSinglePendingPayment(payment.getId());
            } catch (RuntimeException ex) {
                // Keep scheduler healthy; single-row conflicts should not fail the whole batch.
                log.warn(
                        "Payment expiry scan skipped payment after failure: paymentId={}, orderId={}, orderNo={}",
                        payment.getId(), payment.getOrderId(), payment.getOrderNo(), ex);
            }
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expireSinglePendingPayment(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId);
        if (payment == null || !PENDING.equals(payment.getStatus()) || !isExpired(payment)) {
            return;
        }
        expirePayment(payment);
    }

    public String expectedSignature(PaymentCallbackRequest request) {
        assertProductionCallbackSecretConfigured();
        String payload = request.getOrderNo() + "|" + normalizeConfiguredChannel(request.getChannel()) + "|"
                + request.getTransactionId() + "|" + request.getStatus().toUpperCase(Locale.ROOT) + "|"
                + request.getAmount().stripTrailingZeros().toPlainString() + "|"
                + requiredCallbackTimestamp(request.getCallbackTimestamp()) + "|" + callbackSecret();
        return sha256(payload);
    }

    private void logPaymentLifecycle(String event, Payment payment) {
        logPaymentLifecycle(event, payment, payment == null ? null : payment.getStatus());
    }

    private void logPaymentLifecycle(String event, Payment payment, String status) {
        if (payment == null) {
            log.info("{}: paymentId=null", event);
            return;
        }
        log.info(
                "{}: paymentId={}, orderId={}, orderNo={}, channel={}, amount={}, status={}",
                event,
                payment.getId(),
                payment.getOrderId(),
                payment.getOrderNo(),
                payment.getChannel(),
                payment.getAmount(),
                status);
    }

    private Payment createRedirectPayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        validateOrderReadyForPayment(order);
        Payment payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setOrderNo(order.getOrderNo());
        payment.setAmount(order.getTotalAmount());
        payment.setChannel(channelConfig.getCode());
        payment.setStatus(PENDING);
        payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig)));
        payment.setPaymentUrl(buildPaymentUrl(order, channelConfig, payment.getExpiresAt()));
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentRepository.insert(payment);
        logPaymentLifecycle("Payment created via redirect", payment);
        return payment;
    }

    private void expirePayment(Payment payment) {
        boolean cancelOrder = paymentRepository.countActivePendingByOrderId(payment.getOrderId()) == 0;
        if (cancelOrder) {
            try {
                if (!orderService.cancelOrderForPaymentExpiry(payment.getOrderId())) {
                    return;
                }
            } catch (IllegalStateException ex) {
                // Order may already have moved on due to another idempotent callback.
                log.info(
                        "Payment expiry skipped order cancellation because order state changed: paymentId={}, orderId={}, orderNo={}, reason={}",
                        payment.getId(), payment.getOrderId(), payment.getOrderNo(), ex.getMessage());
                return;
            }
        }
        int updated = paymentRepository.markExpired(payment.getId());
        if (updated == 0) {
            if (cancelOrder) {
                throw new IllegalStateException("Payment expiry update failed");
            }
            return;
        }
        logPaymentLifecycle("Payment expiry marked payment expired", payment, EXPIRED);
        if (cancelOrder) {
            paymentRepository.markPendingCancelledByOrderId(payment.getOrderId());
        }
    }

    private Payment refreshPayment(Payment payment, Order order, String channel) {
        validateOrderReadyForPayment(order);
        LocalDateTime now = LocalDateTime.now();
        PaymentChannelConfig.Channel channelConfig = paymentChannelConfig.requireEnabled(channel);
        if (channelConfig.isStripeProvider()) {
            return refreshStripePayment(payment, order, now, channelConfig);
        }
        if (channelConfig.isGenericApiProvider()) {
            return refreshGenericApiPayment(payment, order, now, channelConfig);
        }
        payment.setAmount(order.getTotalAmount());
        payment.setStatus(PENDING);
        payment.setTransactionId(null);
        payment.setProviderReference(null);
        payment.setRefundReference(null);
        payment.setPaidAt(null);
        payment.setRefundedAt(null);
        payment.setCallbackAt(null);
        payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig)));
        payment.setPaymentUrl(buildPaymentUrl(order, channelConfig, payment.getExpiresAt()));
        payment.setUpdatedAt(now);
        paymentRepository.update(payment);
        Payment refreshed = paymentRepository.findById(payment.getId());
        logPaymentLifecycle("Payment refreshed", refreshed == null ? payment : refreshed);
        return refreshed;
    }

    private Payment createStripePayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        validateOrderReadyForPayment(order);
        String secretKey = stripeSecretKey();
        if (isBlank(secretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        try {
            Session session = Session.create(
                    buildStripeCheckoutSession(order, channelConfig),
                    stripeRequestOptions(secretKey, "checkout-session-" + order.getId() + "-" + channelConfig.getCode()));
            Payment payment = new Payment();
            payment.setOrderId(order.getId());
            payment.setOrderNo(order.getOrderNo());
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(channelConfig.getCode());
            payment.setStatus(PENDING);
            payment.setTransactionId(session.getId());
            payment.setProviderReference(session.getId());
            payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig, stripeCheckoutExpireMinutes())));
            payment.setPaymentUrl(session.getUrl());
            payment.setCreatedAt(now);
            payment.setUpdatedAt(now);
            paymentRepository.insert(payment);
            logPaymentLifecycle("Payment created via Stripe", payment);
            return payment;
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create Stripe Checkout session: " + e.getMessage());
        }
    }

    private Payment refreshStripePayment(Payment payment, Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        String secretKey = stripeSecretKey();
        if (isBlank(secretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        try {
            Session session = Session.create(
                    buildStripeCheckoutSession(order, channelConfig),
                    stripeRequestOptions(secretKey, "checkout-session-refresh-" + order.getId() + "-" + payment.getId() + "-" + now.toString()));
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(channelConfig.getCode());
            payment.setStatus(PENDING);
            payment.setTransactionId(session.getId());
            payment.setProviderReference(session.getId());
            payment.setRefundReference(null);
            payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig, stripeCheckoutExpireMinutes())));
            payment.setPaymentUrl(session.getUrl());
            payment.setPaidAt(null);
            payment.setRefundedAt(null);
            payment.setCallbackAt(null);
            payment.setUpdatedAt(now);
            paymentRepository.update(payment);
            Payment refreshed = paymentRepository.findById(payment.getId());
            logPaymentLifecycle("Payment refreshed via Stripe", refreshed == null ? payment : refreshed);
            return refreshed;
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create Stripe Checkout session: " + e.getMessage());
        }
    }

    private Payment createGenericApiPayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        validateOrderReadyForPayment(order);
        String createUrl = trimToNull(channelConfig.getCreateUrl());
        if (createUrl == null) {
            throw new IllegalStateException("Create payment URL is not configured for channel " + channelConfig.getCode());
        }
        createUrl = GatewayUrlValidator.requireOutboundHttpUrl(createUrl, paymentGatewayAllowLocal(), "Create payment URL");
        ResponseEntity<String> response = requestGenericApiPayment(
                order,
                channelConfig,
                createUrl,
                paymentCreateIdempotencyKey(order, channelConfig));
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Gateway create payment failed with status " + response.getStatusCodeValue());
        }
        GenericApiPaymentResponse gateway = parseGenericPaymentResponse(response.getBody(), order, channelConfig, now);
        Payment payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setOrderNo(order.getOrderNo());
        payment.setAmount(order.getTotalAmount());
        payment.setChannel(channelConfig.getCode());
        payment.setStatus(PENDING);
        payment.setTransactionId(gateway.transactionId);
        payment.setProviderReference(gateway.providerReference);
        payment.setExpiresAt(gateway.expiresAt);
        payment.setPaymentUrl(gateway.paymentUrl);
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentRepository.insert(payment);
        logPaymentLifecycle("Payment created via generic API", payment);
        return payment;
    }

    private Payment refreshGenericApiPayment(Payment payment, Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        String createUrl = trimToNull(channelConfig.getCreateUrl());
        if (createUrl == null) {
            throw new IllegalStateException("Create payment URL is not configured for channel " + channelConfig.getCode());
        }
        createUrl = GatewayUrlValidator.requireOutboundHttpUrl(createUrl, paymentGatewayAllowLocal(), "Create payment URL");
        ResponseEntity<String> response = requestGenericApiPayment(
                order,
                channelConfig,
                createUrl,
                paymentRefreshIdempotencyKey(order, payment, channelConfig));
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Gateway create payment failed with status " + response.getStatusCodeValue());
        }
        GenericApiPaymentResponse gateway = parseGenericPaymentResponse(response.getBody(), order, channelConfig, now);
        payment.setAmount(order.getTotalAmount());
        payment.setChannel(channelConfig.getCode());
        payment.setStatus(PENDING);
        payment.setTransactionId(gateway.transactionId);
        payment.setProviderReference(gateway.providerReference);
        payment.setRefundReference(null);
        payment.setPaidAt(null);
        payment.setRefundedAt(null);
        payment.setCallbackAt(null);
        payment.setExpiresAt(gateway.expiresAt);
        payment.setPaymentUrl(gateway.paymentUrl);
        payment.setUpdatedAt(now);
        paymentRepository.update(payment);
        Payment refreshed = paymentRepository.findById(payment.getId());
        logPaymentLifecycle("Payment refreshed via generic API", refreshed == null ? payment : refreshed);
        return refreshed;
    }

    private ResponseEntity<String> requestGenericApiPayment(Order order,
                                                            PaymentChannelConfig.Channel channelConfig,
                                                            String createUrl,
                                                            String idempotencyKey) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("orderNo", order.getOrderNo());
        payload.put("channel", channelConfig.getCode());
        payload.put("amount", order.getTotalAmount().stripTrailingZeros().toPlainString());
        payload.put("currency", resolveCurrency(channelConfig));
        payload.put("expiresMinutes", resolveTimeoutMinutes(channelConfig));
        payload.put("merchantId", trimToNull(channelConfig.getMerchantId()));
        payload.put("returnUrl", contextualPaymentSuccessUrl(order));
        payload.put("cancelUrl", contextualPaymentCancelUrl(order));
        payload.put("idempotencyKey", idempotencyKey);
        try {
            return circuitBreakerService.execute("payment-create-" + channelConfig.getCode(), () -> restTemplate.exchange(
                    createUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(payload, buildGatewayHeaders(channelConfig, idempotencyKey)),
                    String.class));
        } catch (RestClientException e) {
            throw new IllegalStateException("Gateway create payment request failed: " + e.getMessage());
        }
    }

    private GenericApiPaymentResponse parseGenericPaymentResponse(String responseBody,
                                                                  Order order,
                                                                  PaymentChannelConfig.Channel channelConfig,
                                                                  LocalDateTime now) {
        if (isBlank(responseBody)) {
            throw new IllegalStateException("Gateway create payment response is empty");
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String status = readText(root, "status");
            if (status != null) {
                String normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
                if (!"PENDING".equals(normalizedStatus) && !"CREATED".equals(normalizedStatus) && !"OK".equals(normalizedStatus)) {
                    throw new IllegalStateException("Gateway create payment rejected with status " + status);
                }
            }
            String paymentUrl = firstNonBlank(
                    readText(root, "paymentUrl"),
                    readText(root, "checkoutUrl"));
            String transactionId = firstNonBlank(
                    readText(root, "transactionId"),
                    readText(root, "paymentId"),
                    readText(root, "id"));
            String providerReference = firstNonBlank(
                    readText(root, "providerReference"),
                    readText(root, "reference"),
                    transactionId);
            if (isBlank(paymentUrl) || isBlank(transactionId)) {
                throw new IllegalStateException("Gateway create payment response is missing paymentUrl or transactionId");
            }
            paymentUrl = validateGatewayPaymentUrl(paymentUrl, channelConfig);
            LocalDateTime expiresAt = parseGatewayExpiresAt(root, now.plusMinutes(resolveTimeoutMinutes(channelConfig)));
            return new GenericApiPaymentResponse(transactionId, providerReference, paymentUrl, expiresAt);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Gateway create payment response is invalid");
        }
    }

    private LocalDateTime parseGatewayExpiresAt(JsonNode root, LocalDateTime fallback) {
        String expiresAtText = firstNonBlank(readText(root, "expiresAt"), readText(root, "expireAt"));
        if (isBlank(expiresAtText)) {
            return fallback;
        }
        try {
            return LocalDateTime.parse(expiresAtText, DateTimeFormatter.ISO_DATE_TIME);
        } catch (Exception e) {
            return fallback;
        }
    }

    private String validateGatewayPaymentUrl(String paymentUrl, PaymentChannelConfig.Channel channelConfig) {
        String normalized = GatewayUrlValidator.requireOutboundHttpUrl(
                paymentUrl,
                paymentGatewayAllowLocal(),
                "Gateway payment URL");
        URI uri = parseHttpUri(normalized, "Gateway payment URL");
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (isProductionMode() && !"https".equals(scheme)) {
            throw new IllegalStateException("Gateway payment URL must use https in production");
        }
        if (!isGatewayPaymentHostAllowed(uri, channelConfig)) {
            throw new IllegalStateException("Gateway payment URL host is not allowed for channel " + channelConfig.getCode());
        }
        return uri.toString();
    }

    private URI parseHttpUri(String value, String label) {
        try {
            return new URI(value);
        } catch (URISyntaxException e) {
            throw new IllegalStateException(label + " is invalid");
        }
    }

    private boolean isGatewayPaymentHostAllowed(URI uri, PaymentChannelConfig.Channel channelConfig) {
        String host = normalizeHost(uri.getHost());
        if (host == null) {
            return false;
        }
        List<String> allowedHosts = gatewayPaymentAllowedHosts(channelConfig);
        if (allowedHosts.isEmpty()) {
            return !isProductionMode();
        }
        return allowedHosts.stream().anyMatch(pattern -> hostMatchesPattern(host, pattern));
    }

    private List<String> gatewayPaymentAllowedHosts(PaymentChannelConfig.Channel channelConfig) {
        List<String> allowed = new ArrayList<>();
        addGatewayPaymentHost(allowed, channelConfig.getCreateUrl());
        addGatewayPaymentHost(allowed, channelConfig.getCheckoutUrl());
        addGatewayPaymentHost(allowed, paymentChannelConfig.getCheckoutBaseUrl());
        Map<String, String> metadata = channelConfig.getMetadata();
        if (metadata != null) {
            addGatewayPaymentHost(allowed, metadata.get("payment-url-hosts"));
            addGatewayPaymentHost(allowed, metadata.get("paymentUrlHosts"));
            addGatewayPaymentHost(allowed, metadata.get("checkout-url-hosts"));
            addGatewayPaymentHost(allowed, metadata.get("checkoutUrlHosts"));
            addGatewayPaymentHost(allowed, metadata.get("allowed-payment-hosts"));
            addGatewayPaymentHost(allowed, metadata.get("allowedPaymentHosts"));
            addGatewayPaymentHost(allowed, metadata.get("allowed-hosts"));
            addGatewayPaymentHost(allowed, metadata.get("allowedHosts"));
        }
        return allowed;
    }

    private void addGatewayPaymentHost(List<String> allowed, String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return;
        }
        for (String token : normalized.split("[,;\\s]+")) {
            String pattern = normalizeHostPattern(token);
            if (pattern != null && !allowed.contains(pattern)) {
                allowed.add(pattern);
            }
        }
    }

    private String normalizeHostPattern(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.contains("://")) {
            try {
                normalized = new URI(normalized).getHost();
            } catch (URISyntaxException e) {
                return null;
            }
        } else {
            int pathIndex = normalized.indexOf('/');
            if (pathIndex >= 0) {
                normalized = normalized.substring(0, pathIndex);
            }
            int queryIndex = normalized.indexOf('?');
            if (queryIndex >= 0) {
                normalized = normalized.substring(0, queryIndex);
            }
            int colonIndex = normalized.indexOf(':');
            if (colonIndex > 0 && normalized.indexOf(':', colonIndex + 1) < 0) {
                normalized = normalized.substring(0, colonIndex);
            }
        }
        return normalizeHost(normalized);
    }

    private String normalizeHost(String host) {
        String normalized = trimToNull(host);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        if (normalized.startsWith("[") && normalized.endsWith("]")) {
            normalized = normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private boolean hostMatchesPattern(String host, String pattern) {
        String normalizedPattern = normalizeHostPattern(pattern);
        if (normalizedPattern == null) {
            return false;
        }
        if (normalizedPattern.startsWith("*.")) {
            String suffix = normalizedPattern.substring(1);
            return host.endsWith(suffix) && host.length() > suffix.length();
        }
        if (normalizedPattern.startsWith(".")) {
            return host.endsWith(normalizedPattern) && host.length() > normalizedPattern.length();
        }
        return host.equals(normalizedPattern);
    }

    private SessionCreateParams buildStripeCheckoutSession(Order order, PaymentChannelConfig.Channel channelConfig) {
        long amountInCents = order.getTotalAmount().multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValue();
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orderId", String.valueOf(order.getId()));
        metadata.put("orderNo", order.getOrderNo());
        return SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(contextualStripeSuccessUrl(order))
                .setCancelUrl(contextualStripeCancelUrl(order))
                .setPaymentIntentData(SessionCreateParams.PaymentIntentData.builder()
                        .putAllMetadata(metadata)
                        .build())
                .addPaymentMethodType(SessionCreateParams.PaymentMethodType.CARD)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency(resolveCurrency(channelConfig).toLowerCase(Locale.ROOT))
                                .setUnitAmount(amountInCents)
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("ShopMX order " + order.getOrderNo())
                                        .build())
                                .build())
                        .build())
                .putAllMetadata(metadata)
                .build();
    }

    private Payment syncProviderPaymentState(Payment payment) {
        String secretKey = stripeSecretKey();
        if (payment == null || isBlank(secretKey)) {
            return null;
        }
        if (!PENDING.equals(payment.getStatus()) && !requiresProviderPaidReconciliation(payment)) {
            return null;
        }
        PaymentChannelConfig.Channel channel = paymentChannelConfig.findConfigured(payment.getChannel()).orElse(null);
        if (channel == null || !channel.isStripeProvider()) {
            return null;
        }
        String sessionId = firstNonBlank(payment.getProviderReference(), payment.getTransactionId());
        if (!sessionId.startsWith("cs_")) {
            return null;
        }
        try {
            Session session = Session.retrieve(sessionId, stripeRequestOptions(secretKey));
            String sessionStatus = session.getStatus() == null ? "" : session.getStatus().toLowerCase(Locale.ROOT);
            String paymentStatus = session.getPaymentStatus() == null ? "" : session.getPaymentStatus().toLowerCase(Locale.ROOT);
            if ("complete".equals(sessionStatus) && "paid".equals(paymentStatus)) {
                validateStripePaidSession(payment, channel, session);
                if (requiresProviderPaidReconciliation(payment)) {
                    return markProviderPaidReconciliationRequired(
                            payment,
                            firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                            session.getId(),
                            LocalDateTime.now(ZoneOffset.UTC));
                }
                LocalDateTime callbackAt = LocalDateTime.now(ZoneOffset.UTC);
                Payment reconcilePayment = claimOrderForProviderPaidSuccessOrReconcile(
                        payment,
                        firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                        session.getId(),
                        callbackAt);
                if (reconcilePayment != null) {
                    return reconcilePayment;
                }
                int updated = paymentRepository.markPaidDetailed(
                        payment.getId(),
                        firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                        session.getId(),
                        callbackAt);
                if (updated == 0) {
                    Payment latest = paymentRepository.findById(payment.getId());
                    if (latest != null && PAID.equals(latest.getStatus())) {
                        logPaymentLifecycle("Stripe sync observed already paid payment", latest);
                        return latest;
                    }
                    throw new IllegalStateException("Stripe payment state update failed");
                }
                Payment syncedPaid = paymentRepository.findById(payment.getId());
                logPaymentLifecycle("Stripe sync marked payment paid", syncedPaid == null ? payment : syncedPaid, PAID);
                return syncedPaid;
            }
            if ("expired".equals(sessionStatus)) {
                expirePayment(payment);
                Payment expired = paymentRepository.findById(payment.getId());
                logPaymentLifecycle("Stripe sync marked payment expired", expired == null ? payment : expired, EXPIRED);
                return expired;
            }
            return null;
        } catch (StripeException e) {
            log.warn("Stripe payment sync failed: paymentId={}, orderId={}, orderNo={}, channel={}",
                    payment.getId(), payment.getOrderId(), payment.getOrderNo(), payment.getChannel(), e);
            return null;
        }
    }

    private PaymentChannelConfig.Channel requireStripePaymentChannel(Payment payment) {
        PaymentChannelConfig.Channel channel = paymentChannelConfig.findConfigured(payment.getChannel()).orElse(null);
        if (channel == null || !channel.isStripeProvider()) {
            throw new IllegalStateException("Payment channel is not configured for Stripe");
        }
        return channel;
    }

    private void validateStripePaidSession(Payment payment, PaymentChannelConfig.Channel channel, Session session) {
        String paymentStatus = session.getPaymentStatus() == null ? "" : session.getPaymentStatus().trim().toLowerCase(Locale.ROOT);
        if (!"paid".equals(paymentStatus)) {
            throw new IllegalStateException("Stripe session is not paid");
        }
        String expectedCurrency = resolveCurrency(channel);
        String actualCurrency = trimToNull(session.getCurrency());
        if (actualCurrency == null || !expectedCurrency.equalsIgnoreCase(actualCurrency)) {
            throw new IllegalArgumentException("Stripe payment currency mismatch");
        }
        Long actualAmount = session.getAmountTotal();
        if (actualAmount == null) {
            throw new IllegalArgumentException("Stripe payment amount is missing");
        }
        long expectedAmount = toStripeMinorUnit(payment.getAmount(), expectedCurrency);
        if (actualAmount.longValue() != expectedAmount) {
            throw new IllegalArgumentException("Stripe payment amount mismatch");
        }
    }

    private long toStripeMinorUnit(BigDecimal amount, String currency) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Payment amount is invalid");
        }
        try {
            return amount.movePointRight(currencyFractionDigits(currency))
                    .setScale(0, RoundingMode.HALF_UP)
                    .longValueExact();
        } catch (ArithmeticException e) {
            throw new IllegalStateException("Payment amount is invalid");
        }
    }

    private int currencyFractionDigits(String currency) {
        try {
            int digits = Currency.getInstance(currency).getDefaultFractionDigits();
            return digits < 0 ? 2 : digits;
        } catch (IllegalArgumentException e) {
            return 2;
        }
    }

    private RequestOptions stripeRequestOptions(String apiKey) {
        return RequestOptions.builder().setApiKey(apiKey).build();
    }

    private RequestOptions stripeRequestOptions(String apiKey, String idempotencyKey) {
        return RequestOptions.builder()
                .setApiKey(apiKey)
                .setIdempotencyKey(idempotencyKey)
                .build();
    }

    private boolean isProviderPaidAlreadyAcknowledged(Payment payment) {
        if (payment == null) {
            return false;
        }
        String status = payment.getStatus();
        return PAID.equals(status) || REFUNDING.equals(status) || REFUNDED.equals(status);
    }

    private boolean requiresProviderPaidReconciliation(Payment payment) {
        if (payment == null) {
            return false;
        }
        String status = payment.getStatus();
        return CANCELLED.equals(status) || EXPIRED.equals(status) || FAILED.equals(status);
    }

    private Payment markProviderPaidReconciliationRequired(Payment payment,
                                                           String transactionId,
                                                           String providerReference,
                                                           LocalDateTime callbackAt) {
        String effectiveTransactionId = trimToNull(firstNonBlank(transactionId, payment.getTransactionId(), providerReference));
        String effectiveProviderReference = trimToNull(firstNonBlank(providerReference, payment.getProviderReference(), effectiveTransactionId));
        int updated = paymentRepository.markReconcileRequired(
                payment.getId(),
                effectiveTransactionId,
                effectiveProviderReference,
                callbackAt);
        if (updated == 0) {
            Payment latest = paymentRepository.findById(payment.getId());
            if (latest != null && (RECONCILE_REQUIRED.equals(latest.getStatus()) || isProviderPaidAlreadyAcknowledged(latest))) {
                logPaymentLifecycle("Provider paid reconciliation observed existing terminal payment", latest);
                return latest;
            }
            throw new IllegalStateException("Payment reconciliation state update failed");
        }
        Payment reconciled = paymentRepository.findById(payment.getId());
        logPaymentLifecycle("Provider paid reconciliation required", reconciled == null ? payment : reconciled);
        return reconciled;
    }

    private Payment claimOrderForProviderPaidSuccessOrReconcile(Payment payment,
                                                                 String transactionId,
                                                                 String providerReference,
                                                                 LocalDateTime callbackAt) {
        try {
            claimOrderForPaymentSuccess(payment.getOrderId());
            return null;
        } catch (IllegalStateException e) {
            log.info("Payment provider-paid callback requires reconciliation: paymentId={}, orderId={}, orderNo={}, channel={}, reason={}",
                    payment.getId(), payment.getOrderId(), payment.getOrderNo(), payment.getChannel(), e.getMessage());
            return markProviderPaidReconciliationRequired(payment, transactionId, providerReference, callbackAt);
        }
    }

    private boolean verifySignature(PaymentCallbackRequest request) {
        String signature = trimToNull(request.getSignature());
        if (signature == null) {
            return false;
        }
        byte[] expected = expectedSignature(request).toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        byte[] actual = signature.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    private void assertMatchingPaidCallback(Payment payment, PaymentCallbackRequest request) {
        String expectedTransactionId = trimToNull(payment.getTransactionId());
        String expectedReference = trimToNull(payment.getProviderReference());
        String requestTransactionId = trimToNull(request.getTransactionId());
        String requestReference = trimToNull(request.getProviderReference());
        if (expectedTransactionId != null && !expectedTransactionId.equals(requestTransactionId)) {
            throw new IllegalArgumentException("Paid payment transactionId mismatch");
        }
        String effectiveRequestReference = firstNonBlank(requestReference, requestTransactionId);
        if (expectedReference != null && !expectedReference.equals(effectiveRequestReference)) {
            throw new IllegalArgumentException("Paid payment providerReference mismatch");
        }
    }

    private void claimOrderForPaymentSuccess(Long orderId) {
        Order order = orderService.getOrderById(orderId);
        if (order == null) {
            throw new IllegalStateException("Order not found");
        }
        if (!"PENDING_PAYMENT".equals(order.getStatus())) {
            throw new IllegalStateException("Order is no longer awaiting payment");
        }
        validateOrderReadyForPayment(order);

        boolean updated;
        try {
            updated = orderService.updateOrderStatus(orderId, "PENDING_SHIPMENT");
        } catch (IllegalStateException e) {
            throw new IllegalStateException("Order is no longer awaiting payment", e);
        }
        if (!updated) {
            throw new IllegalStateException("Order is no longer awaiting payment");
        }
    }

    private void validateOrderReadyForPayment(Order order) {
        if (order == null) {
            throw new IllegalStateException("Order not found");
        }
        if (trimToNull(order.getOrderNo()) == null) {
            throw new IllegalStateException("Order number is missing");
        }
        BigDecimal amount = order.getTotalAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalStateException("Order amount is invalid");
        }
    }

    private boolean isExpired(Payment payment) {
        return PENDING.equals(payment.getStatus())
                && payment.getExpiresAt() != null
                && !payment.getExpiresAt().isAfter(LocalDateTime.now());
    }

    private String normalizeConfiguredChannel(String channel) {
        if (channel == null || channel.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment channel is required");
        }
        return paymentChannelConfig.requireConfigured(channel).getCode();
    }

    private LocalDateTime resolveCallbackAt(PaymentCallbackRequest request) {
        Long callbackTimestamp = request.getCallbackTimestamp();
        if (callbackTimestamp == null) {
            throw new IllegalArgumentException("callbackTimestamp is required");
        }
        try {
            return LocalDateTime.ofEpochSecond(callbackTimestamp, 0, ZoneOffset.UTC);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid callback timestamp");
        }
    }

    private void validateCallbackFreshness(LocalDateTime callbackAt) {
        long callbackMaxSkewSeconds = runtimeConfig.getLong("payment.callback-max-skew-seconds", 300);
        long skew = callbackMaxSkewSeconds > 0 ? callbackMaxSkewSeconds : DEFAULT_CALLBACK_MAX_SKEW_SECONDS;
        long deltaSeconds = Math.abs(Duration.between(callbackAt, LocalDateTime.now(ZoneOffset.UTC)).getSeconds());
        if (deltaSeconds > skew) {
            throw new IllegalArgumentException("Payment callback timestamp is expired");
        }
    }

    private void assertChannelAvailableForCheckout(PaymentChannelConfig.Channel channelConfig) {
        if (!paymentChannelAvailabilityService.isChannelAvailableForCheckout(channelConfig)) {
            throw new IllegalStateException("Payment channel is not configured for checkout");
        }
    }

    private String buildPaymentUrl(Order order, PaymentChannelConfig.Channel channel, LocalDateTime expiresAt) {
        String configuredUrl = firstNonBlank(channel.getCheckoutUrl(), paymentChannelConfig.getCheckoutBaseUrl());
        String baseUrl = isBlank(configuredUrl)
                ? storefrontBaseUrl() + "/payment"
                : configuredUrl.trim().replaceAll("/+$", "");
        return baseUrl + "/" + urlEncode(order.getOrderNo())
                + "?channel=" + urlEncode(channel.getCode())
                + "&amount=" + urlEncode(order.getTotalAmount().stripTrailingZeros().toPlainString())
                + "&currency=" + urlEncode(resolveCurrency(channel))
                + "&expiresAt=" + urlEncode(expiresAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }

    private String extractGuestEmail(String shippingAddress) {
        if (shippingAddress == null || !shippingAddress.startsWith("[Guest]")) {
            return null;
        }
        String[] parts = shippingAddress.split(" / ");
        for (String part : parts) {
            String email = normalizeEmail(part);
            if (email != null) {
                return email;
            }
        }
        return null;
    }

    private String guestEmailForOrder(Order order) {
        if (order == null) {
            return null;
        }
        String contactEmail = normalizeEmail(order.getContactEmail());
        return contactEmail != null ? contactEmail : extractGuestEmail(order.getShippingAddress());
    }

    private String normalizeEmail(String value) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        normalized = normalized.toLowerCase(Locale.ROOT);
        return normalized.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") ? normalized : null;
    }

    private long resolveTimeoutMinutes(PaymentChannelConfig.Channel channel) {
        return resolveTimeoutMinutes(channel, runtimeConfig.getLong("payment.timeout-minutes", 30));
    }

    private long resolveTimeoutMinutes(PaymentChannelConfig.Channel channel, long defaultValue) {
        return channel.getExpiresMinutes() != null && channel.getExpiresMinutes() > 0
                ? channel.getExpiresMinutes()
                : defaultValue;
    }

    private String resolveCurrency(PaymentChannelConfig.Channel channel) {
        return firstNonBlank(channel.getCurrency(), paymentChannelConfig.getDefaultCurrency(), "MXN").toUpperCase(Locale.ROOT);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = trimToNull(value);
            if (trimmed != null) {
                return trimmed;
            }
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private void assertPaymentSimulationEnabled() {
        if (!isPaymentSimulationEnabled()) {
            throw new IllegalStateException("Payment simulation is disabled");
        }
    }

    private void assertProductionCallbackSecretConfigured() {
        if (!isProductionMode()) {
            return;
        }
        String secret = trimToNull(callbackSecret());
        if (secret == null || isWeakCallbackSecret(secret)) {
            throw new IllegalStateException("Payment callback secret is not configured for production");
        }
    }

    public boolean isPaymentSimulationEnabled() {
        String mode = runtimeMode();
        boolean productionMode = "production".equals(mode) || "prod".equals(mode);
        if (productionMode) {
            boolean runtimeAllowsSimulation = runtimeConfig.getBoolean("payment.simulation-allow-production", false);
            if (!runtimeAllowsSimulation || !hostAllowsProductionPaymentSimulation()) {
                return false;
            }
        }
        String paymentSimulationEnabled = runtimeConfig.getString("payment.simulation-enabled", "");
        if (!isBlank(paymentSimulationEnabled)) {
            return Boolean.parseBoolean(paymentSimulationEnabled.trim());
        }
        return "debug".equals(mode) || "dev".equals(mode) || "test".equals(mode);
    }

    private boolean hostAllowsProductionPaymentSimulation() {
        return "true".equalsIgnoreCase(System.getenv("PAYMENT_SIMULATION_ALLOW_PRODUCTION"))
                || Boolean.getBoolean("PAYMENT_SIMULATION_ALLOW_PRODUCTION");
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private HttpHeaders buildGatewayHeaders(PaymentChannelConfig.Channel channel, String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Idempotency-Key", idempotencyKey);
        String authHeaderName = trimToNull(channel.getAuthHeaderName());
        String authHeaderValue = trimToNull(channel.getAuthHeaderValue());
        if (authHeaderName != null && authHeaderValue != null) {
            headers.set(authHeaderName, authHeaderValue);
        }
        return headers;
    }

    private String paymentCreateIdempotencyKey(Order order, PaymentChannelConfig.Channel channel) {
        return "payment-create-" + order.getId() + "-" + channel.getCode();
    }

    private String paymentRefreshIdempotencyKey(Order order, Payment payment, PaymentChannelConfig.Channel channel) {
        return "payment-refresh-" + order.getId() + "-" + payment.getId() + "-" + channel.getCode();
    }

    private String readText(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        if (node == null || node.isNull()) {
            return null;
        }
        return trimToNull(node.asText(null));
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String requiredCallbackTimestamp(Long callbackTimestamp) {
        if (callbackTimestamp == null) {
            throw new IllegalArgumentException("callbackTimestamp is required");
        }
        return String.valueOf(callbackTimestamp);
    }

    private String newTransactionId() {
        return "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
    }

    private boolean isProductionMode() {
        String mode = runtimeMode();
        return "production".equals(mode) || "prod".equals(mode);
    }

    private String callbackSecret() {
        return runtimeConfig.getString("payment.callback-secret", "");
    }

    private boolean isWeakCallbackSecret(String secret) {
        String normalized = secret == null ? "" : secret.trim();
        String lower = normalized.toLowerCase(Locale.ROOT);
        return normalized.length() < 32
                || "dev-payment-secret".equals(lower)
                || lower.startsWith("replace-")
                || lower.contains("replace-with")
                || lower.contains("your-")
                || "secret".equals(lower)
                || "default-secret".equals(lower);
    }

    private boolean paymentGatewayAllowLocal() {
        return runtimeConfig.getBoolean("payment.gateway-allow-local", false);
    }

    private String stripeSecretKey() {
        return runtimeConfig.getString("stripe.secret-key", "");
    }

    private String stripeWebhookSecret() {
        return runtimeConfig.getString("stripe.webhook-secret", "");
    }

    private String storefrontBaseUrl() {
        String configured = trimToNull(runtimeConfig.getString("app.storefront-base-url", DEFAULT_STOREFRONT_BASE_URL));
        return (configured == null ? DEFAULT_STOREFRONT_BASE_URL : configured).replaceAll("/+$", "");
    }

    private String stripeSuccessUrl() {
        return firstNonBlank(
                runtimeConfig.getString("stripe.checkout-success-url", ""),
                storefrontBaseUrl() + "/profile?payment=success");
    }

    private String stripeCancelUrl() {
        return firstNonBlank(
                runtimeConfig.getString("stripe.checkout-cancel-url", ""),
                storefrontBaseUrl() + "/cart?payment=cancelled");
    }

    private String paymentSuccessUrl() {
        return firstNonBlank(
                runtimeConfig.getString("payment.success-url", ""),
                storefrontBaseUrl() + "/profile?payment=success");
    }

    private String paymentCancelUrl() {
        return firstNonBlank(
                runtimeConfig.getString("payment.cancel-url", ""),
                storefrontBaseUrl() + "/cart?payment=cancelled");
    }

    private String contextualStripeSuccessUrl(Order order) {
        return contextualReturnUrl(stripeSuccessUrl(), order, "payment", "success");
    }

    private String contextualStripeCancelUrl(Order order) {
        return contextualReturnUrl(stripeCancelUrl(), order, "payment", "cancelled");
    }

    private String contextualPaymentSuccessUrl(Order order) {
        return contextualReturnUrl(paymentSuccessUrl(), order, "payment", "success");
    }

    private String contextualPaymentCancelUrl(Order order) {
        return contextualReturnUrl(paymentCancelUrl(), order, "payment", "cancelled");
    }

    private String contextualReturnUrl(String configuredUrl, Order order, String statusKey, String statusValue) {
        boolean guestOrder = guestEmailForOrder(order) != null;
        String baseUrl = trimToNull(configuredUrl);
        if (guestOrder) {
            baseUrl = storefrontBaseUrl() + "/track-order";
        }
        if (baseUrl == null) {
            baseUrl = guestOrder
                    ? storefrontBaseUrl() + "/track-order"
                    : storefrontBaseUrl() + "/profile";
        }
        String url = appendQueryParam(baseUrl, "orderNo", order == null ? null : order.getOrderNo());
        return appendQueryParam(url, statusKey, statusValue);
    }

    private String appendQueryParam(String url, String key, String value) {
        String normalizedUrl = trimToNull(url);
        String normalizedKey = trimToNull(key);
        String normalizedValue = trimToNull(value);
        if (normalizedUrl == null || normalizedKey == null || normalizedValue == null) {
            return normalizedUrl == null ? "" : normalizedUrl;
        }
        String separator = normalizedUrl.contains("?") ? "&" : "?";
        return normalizedUrl + separator + urlEncode(normalizedKey) + "=" + urlEncode(normalizedValue);
    }

    private long stripeCheckoutExpireMinutes() {
        return runtimeConfig.getLong("stripe.checkout-expire-minutes", 1440);
    }

    private String runtimeMode() {
        return runtimeConfig.getString("app.runtime-mode", "production").trim().toLowerCase(Locale.ROOT);
    }

    private static final class GenericApiPaymentResponse {
        private final String transactionId;
        private final String providerReference;
        private final String paymentUrl;
        private final LocalDateTime expiresAt;

        private GenericApiPaymentResponse(String transactionId, String providerReference, String paymentUrl, LocalDateTime expiresAt) {
            this.transactionId = transactionId;
            this.providerReference = providerReference;
            this.paymentUrl = paymentUrl;
            this.expiresAt = expiresAt;
        }
    }
}
