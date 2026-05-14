package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentService {
    private static final String PENDING = "PENDING";
    private static final String PAID = "PAID";
    private static final String FAILED = "FAILED";
    private static final String EXPIRED = "EXPIRED";
    private static final long DEFAULT_CALLBACK_MAX_SKEW_SECONDS = 300L;

    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private OrderService orderService;
    @Autowired
    private PaymentChannelConfig paymentChannelConfig;

    @Value("${payment.timeout-minutes:30}")
    private long timeoutMinutes;

    @Value("${payment.callback-secret:dev-payment-secret}")
    private String callbackSecret;

    @Value("${payment.callback-max-skew-seconds:300}")
    private long callbackMaxSkewSeconds;

    @Value("${payment.success-url:${STRIPE_SUCCESS_URL:http://localhost:3000/profile?payment=success}}")
    private String paymentSuccessUrl;

    @Value("${payment.cancel-url:${STRIPE_CANCEL_URL:http://localhost:3000/cart?payment=cancelled}}")
    private String paymentCancelUrl;

    @Value("${app.runtime-mode:production}")
    private String runtimeMode;

    @Value("${payment.simulation-enabled:}")
    private String paymentSimulationEnabled;

    @Value("${payment.simulation-allow-production:false}")
    private boolean paymentSimulationAllowProduction;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${stripe.webhook-secret:}")
    private String stripeWebhookSecret;

    @Value("${stripe.checkout-success-url:http://localhost:3000/profile?payment=success}")
    private String stripeSuccessUrl;

    @Value("${stripe.checkout-cancel-url:http://localhost:3000/cart?payment=cancelled}")
    private String stripeCancelUrl;

    @Value("${stripe.checkout-expire-minutes:1440}")
    private long stripeCheckoutExpireMinutes;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public Payment createPayment(PaymentCreateRequest request) {
        Order order = orderService.getOrderById(request.getOrderId());
        if (order == null) {
            throw new IllegalArgumentException("Order not found");
        }
        if (!"PENDING_PAYMENT".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending-payment orders can create payment");
        }

        PaymentChannelConfig.Channel channelConfig = paymentChannelConfig.requireEnabled(request.getChannel());
        assertChannelAvailableForCheckout(channelConfig);
        String channel = channelConfig.getCode();
        Payment existingForChannel = paymentRepository.findByOrderIdAndChannel(order.getId(), channel);
        if (existingForChannel != null) {
            if (PAID.equals(existingForChannel.getStatus())) {
                return existingForChannel;
            }
            if (PENDING.equals(existingForChannel.getStatus())) {
                if (isExpired(existingForChannel)) {
                    return refreshPayment(existingForChannel, order, channel);
                }
                return existingForChannel;
            }
            if (FAILED.equals(existingForChannel.getStatus()) || EXPIRED.equals(existingForChannel.getStatus())) {
                return refreshPayment(existingForChannel, order, channel);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        if (channelConfig.isStripeProvider()) {
            return createStripePayment(order, now, channelConfig);
        }
        if (channelConfig.isGenericApiProvider()) {
            return createGenericApiPayment(order, now, channelConfig);
        }
        return createRedirectPayment(order, now, channelConfig);
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
        int updated = paymentRepository.markPaidDetailed(paymentId, transactionId, transactionId, LocalDateTime.now(ZoneOffset.UTC));
        if (updated > 0) {
            orderService.updateOrderStatus(payment.getOrderId(), "PENDING_SHIPMENT");
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
        if (PAID.equals(payment.getStatus())) {
            assertMatchingPaidCallback(payment, request);
            return payment;
        }
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setOrderNo(payment.getOrderNo());
        request.setChannel(payment.getChannel());
        request.setTransactionId(newTransactionId());
        request.setProviderReference("sim-" + payment.getId());
        request.setStatus("SUCCESS");
        request.setAmount(payment.getAmount());
        request.setCallbackTimestamp(Instant.now().getEpochSecond());
        request.setSignature(expectedSignature(request));
        return handleCallback(request);
    }

    @Transactional
    public Payment handleCallback(PaymentCallbackRequest request) {
        String channel = normalizeConfiguredChannel(request.getChannel());
        Payment payment = paymentRepository.findByOrderNoAndChannel(request.getOrderNo(), channel);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if (!verifySignature(request)) {
            throw new IllegalArgumentException("Invalid payment callback signature");
        }
        LocalDateTime callbackAt = resolveCallbackAt(request);
        validateCallbackFreshness(callbackAt);
        if (payment.getAmount().compareTo(request.getAmount()) != 0) {
            throw new IllegalArgumentException("Payment amount mismatch");
        }
        if (PAID.equals(payment.getStatus())) {
            return payment;
        }
        if (EXPIRED.equals(payment.getStatus())) {
            throw new IllegalStateException("Payment has expired");
        }

        String callbackStatus = request.getStatus().toUpperCase(Locale.ROOT);
        if (PAID.equals(callbackStatus) || "SUCCESS".equals(callbackStatus)) {
            if (isExpired(payment)) {
                expirePayment(payment);
                throw new IllegalStateException("Payment has expired");
            }
            int updated = paymentRepository.markPaidDetailed(
                    payment.getId(),
                    request.getTransactionId(),
                    firstNonBlank(request.getProviderReference(), request.getTransactionId()),
                    callbackAt);
            if (updated == 0) {
                Payment latest = paymentRepository.findById(payment.getId());
                if (latest != null && PAID.equals(latest.getStatus())) {
                    return latest;
                }
                throw new IllegalStateException("Payment state update failed");
            }
            orderService.updateOrderStatus(payment.getOrderId(), "PENDING_SHIPMENT");
        } else if (FAILED.equals(callbackStatus)) {
            paymentRepository.markFailed(payment.getId());
        } else {
            throw new IllegalArgumentException("Unsupported payment callback status");
        }
        return paymentRepository.findById(payment.getId());
    }

    @Transactional
    public Payment handleStripeWebhook(String payload, String signatureHeader) {
        if (isBlank(stripeWebhookSecret)) {
            throw new IllegalStateException("Stripe webhook secret is not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, stripeWebhookSecret);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid Stripe webhook signature");
        }
        if (!"checkout.session.completed".equals(event.getType()) && !"checkout.session.expired".equals(event.getType())) {
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
            if (PAID.equals(payment.getStatus())) {
                return payment;
            }
            int updated = paymentRepository.markPaidDetailed(
                    payment.getId(),
                    firstNonBlank(session.getPaymentIntent(), payment.getTransactionId(), session.getId()),
                    session.getId(),
                    LocalDateTime.now(ZoneOffset.UTC));
            if (updated == 0) {
                Payment latest = paymentRepository.findById(payment.getId());
                if (latest != null && PAID.equals(latest.getStatus())) {
                    return latest;
                }
                throw new IllegalStateException("Stripe payment state update failed");
            }
            orderService.updateOrderStatus(payment.getOrderId(), "PENDING_SHIPMENT");
        } else if (PENDING.equals(payment.getStatus())) {
            expirePayment(payment);
        }
        return paymentRepository.findById(payment.getId());
    }

    public List<Payment> findByOrderId(Long orderId) {
        return paymentRepository.findByOrderId(orderId);
    }

    public Payment findById(Long paymentId) {
        return paymentRepository.findById(paymentId);
    }

    @Transactional
    public Payment findLatestByOrderId(Long orderId) {
        Payment payment = paymentRepository.findLatestByOrderId(orderId);
        if (payment != null && isExpired(payment)) {
            expirePayment(payment);
            return paymentRepository.findById(payment.getId());
        }
        return payment;
    }

    public boolean isChannelAvailableForCheckout(PaymentChannelConfig.Channel channelConfig) {
        if (channelConfig == null || !channelConfig.isEnabled()) {
            return false;
        }
        if (!isProductionMode()) {
            return true;
        }
        if (channelConfig.isStripeProvider()) {
            return !isBlank(stripeSecretKey);
        }
        if (channelConfig.isGenericApiProvider()) {
            return !isBlank(channelConfig.getCreateUrl());
        }
        String configuredUrl = firstNonBlank(channelConfig.getCheckoutUrl(), paymentChannelConfig.getCheckoutBaseUrl());
        return !isBlank(configuredUrl) && !configuredUrl.contains("pay.example.local");
    }

    @Scheduled(fixedDelayString = "${payment.expiry-scan-ms:60000}")
    public void expirePendingPayments() {
        for (Payment payment : paymentRepository.findExpiredPending()) {
            try {
                expireSinglePendingPayment(payment.getId());
            } catch (RuntimeException ignored) {
                // Keep scheduler healthy; single-row conflicts should not fail the whole batch.
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
        String payload = request.getOrderNo() + "|" + normalizeConfiguredChannel(request.getChannel()) + "|"
                + request.getTransactionId() + "|" + request.getStatus().toUpperCase(Locale.ROOT) + "|"
                + request.getAmount().stripTrailingZeros().toPlainString() + "|"
                + requiredCallbackTimestamp(request.getCallbackTimestamp()) + "|" + callbackSecret;
        return sha256(payload);
    }

    private Payment createRedirectPayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
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
        return payment;
    }

    private void expirePayment(Payment payment) {
        int updated = paymentRepository.markExpired(payment.getId());
        if (updated > 0) {
            try {
                orderService.cancelOrder(payment.getOrderId());
            } catch (IllegalStateException ignored) {
                // Order may already have moved on due to another idempotent callback.
            }
        }
    }

    private Payment refreshPayment(Payment payment, Order order, String channel) {
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
        return paymentRepository.findById(payment.getId());
    }

    private Payment createStripePayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        if (isBlank(stripeSecretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        try {
            Stripe.apiKey = stripeSecretKey;
            Session session = Session.create(buildStripeCheckoutSession(order, channelConfig));
            Payment payment = new Payment();
            payment.setOrderId(order.getId());
            payment.setOrderNo(order.getOrderNo());
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(channelConfig.getCode());
            payment.setStatus(PENDING);
            payment.setTransactionId(session.getId());
            payment.setProviderReference(session.getId());
            payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig, stripeCheckoutExpireMinutes)));
            payment.setPaymentUrl(session.getUrl());
            payment.setCreatedAt(now);
            payment.setUpdatedAt(now);
            paymentRepository.insert(payment);
            return payment;
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create Stripe Checkout session: " + e.getMessage());
        }
    }

    private Payment refreshStripePayment(Payment payment, Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        if (isBlank(stripeSecretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        try {
            Stripe.apiKey = stripeSecretKey;
            Session session = Session.create(buildStripeCheckoutSession(order, channelConfig));
            payment.setAmount(order.getTotalAmount());
            payment.setChannel(channelConfig.getCode());
            payment.setStatus(PENDING);
            payment.setTransactionId(session.getId());
            payment.setProviderReference(session.getId());
            payment.setRefundReference(null);
            payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig, stripeCheckoutExpireMinutes)));
            payment.setPaymentUrl(session.getUrl());
            payment.setPaidAt(null);
            payment.setRefundedAt(null);
            payment.setCallbackAt(null);
            payment.setUpdatedAt(now);
            paymentRepository.update(payment);
            return paymentRepository.findById(payment.getId());
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create Stripe Checkout session: " + e.getMessage());
        }
    }

    private Payment createGenericApiPayment(Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        String createUrl = trimToNull(channelConfig.getCreateUrl());
        if (createUrl == null) {
            throw new IllegalStateException("Create payment URL is not configured for channel " + channelConfig.getCode());
        }
        ResponseEntity<String> response = requestGenericApiPayment(order, channelConfig, createUrl);
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
        return payment;
    }

    private Payment refreshGenericApiPayment(Payment payment, Order order, LocalDateTime now, PaymentChannelConfig.Channel channelConfig) {
        String createUrl = trimToNull(channelConfig.getCreateUrl());
        if (createUrl == null) {
            throw new IllegalStateException("Create payment URL is not configured for channel " + channelConfig.getCode());
        }
        ResponseEntity<String> response = requestGenericApiPayment(order, channelConfig, createUrl);
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
        return paymentRepository.findById(payment.getId());
    }

    private ResponseEntity<String> requestGenericApiPayment(Order order, PaymentChannelConfig.Channel channelConfig, String createUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("orderNo", order.getOrderNo());
        payload.put("channel", channelConfig.getCode());
        payload.put("amount", order.getTotalAmount().stripTrailingZeros().toPlainString());
        payload.put("currency", resolveCurrency(channelConfig));
        payload.put("expiresMinutes", resolveTimeoutMinutes(channelConfig));
        payload.put("merchantId", trimToNull(channelConfig.getMerchantId()));
        payload.put("returnUrl", paymentSuccessUrl);
        payload.put("cancelUrl", paymentCancelUrl);
        try {
            return restTemplate.exchange(
                    createUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(payload, buildGatewayHeaders(channelConfig)),
                    String.class);
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

    private SessionCreateParams buildStripeCheckoutSession(Order order, PaymentChannelConfig.Channel channelConfig) {
        long amountInCents = order.getTotalAmount().multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValue();
        Map<String, String> metadata = new HashMap<>();
        metadata.put("orderId", String.valueOf(order.getId()));
        metadata.put("orderNo", order.getOrderNo());
        return SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.PAYMENT)
                .setSuccessUrl(stripeSuccessUrl + (stripeSuccessUrl.contains("?") ? "&" : "?") + "orderNo=" + order.getOrderNo())
                .setCancelUrl(stripeCancelUrl + (stripeCancelUrl.contains("?") ? "&" : "?") + "orderNo=" + order.getOrderNo())
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

    private boolean verifySignature(PaymentCallbackRequest request) {
        return expectedSignature(request).equalsIgnoreCase(request.getSignature());
    }

    private void assertMatchingPaidCallback(Payment payment, PaymentCallbackRequest request) {
        String expectedTransactionId = trimToNull(payment.getTransactionId());
        String expectedReference = trimToNull(payment.getProviderReference());
        String requestTransactionId = trimToNull(request.getTransactionId());
        String requestReference = trimToNull(request.getProviderReference());
        if (expectedTransactionId != null && requestTransactionId != null && !expectedTransactionId.equals(requestTransactionId)) {
            throw new IllegalArgumentException("Paid payment transactionId mismatch");
        }
        if (expectedReference != null && requestReference != null && !expectedReference.equals(requestReference)) {
            throw new IllegalArgumentException("Paid payment providerReference mismatch");
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
        long skew = callbackMaxSkewSeconds > 0 ? callbackMaxSkewSeconds : DEFAULT_CALLBACK_MAX_SKEW_SECONDS;
        long deltaSeconds = Math.abs(Duration.between(callbackAt, LocalDateTime.now(ZoneOffset.UTC)).getSeconds());
        if (deltaSeconds > skew) {
            throw new IllegalArgumentException("Payment callback timestamp is expired");
        }
    }

    private void assertChannelAvailableForCheckout(PaymentChannelConfig.Channel channelConfig) {
        if (!isChannelAvailableForCheckout(channelConfig)) {
            throw new IllegalStateException("Payment channel is not configured for checkout");
        }
    }

    private String buildPaymentUrl(Order order, PaymentChannelConfig.Channel channel, LocalDateTime expiresAt) {
        String configuredUrl = firstNonBlank(channel.getCheckoutUrl(), paymentChannelConfig.getCheckoutBaseUrl());
        String baseUrl = isBlank(configuredUrl)
                ? "https://pay.example.local/checkout"
                : configuredUrl.trim().replaceAll("/+$", "");
        return baseUrl + "/" + urlEncode(order.getOrderNo())
                + "?channel=" + urlEncode(channel.getCode())
                + "&amount=" + urlEncode(order.getTotalAmount().stripTrailingZeros().toPlainString())
                + "&currency=" + urlEncode(resolveCurrency(channel))
                + "&expiresAt=" + urlEncode(expiresAt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }

    private long resolveTimeoutMinutes(PaymentChannelConfig.Channel channel) {
        return resolveTimeoutMinutes(channel, timeoutMinutes);
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

    public boolean isPaymentSimulationEnabled() {
        String mode = runtimeMode == null ? "production" : runtimeMode.trim().toLowerCase(Locale.ROOT);
        boolean productionMode = "production".equals(mode) || "prod".equals(mode);
        if (productionMode && !paymentSimulationAllowProduction) {
            return false;
        }
        if (!isBlank(paymentSimulationEnabled)) {
            return Boolean.parseBoolean(paymentSimulationEnabled.trim());
        }
        return "debug".equals(mode) || "dev".equals(mode) || "test".equals(mode);
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

    private HttpHeaders buildGatewayHeaders(PaymentChannelConfig.Channel channel) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String authHeaderName = trimToNull(channel.getAuthHeaderName());
        String authHeaderValue = trimToNull(channel.getAuthHeaderValue());
        if (authHeaderName != null && authHeaderValue != null) {
            headers.set(authHeaderName, authHeaderValue);
        }
        return headers;
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
        String mode = runtimeMode == null ? "production" : runtimeMode.trim().toLowerCase(Locale.ROOT);
        return "production".equals(mode) || "prod".equals(mode);
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
