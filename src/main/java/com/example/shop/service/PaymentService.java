package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentCallbackRequest;
import com.example.shop.dto.PaymentCreateRequest;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import com.stripe.param.checkout.SessionCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
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
        if (isStripeChannel(channelConfig)) {
            return createStripePayment(order, now, channelConfig);
        }
        Payment payment = new Payment();
        payment.setOrderId(order.getId());
        payment.setOrderNo(order.getOrderNo());
        payment.setAmount(order.getTotalAmount());
        payment.setChannel(channel);
        payment.setStatus(PENDING);
        payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig)));
        payment.setPaymentUrl(buildPaymentUrl(order, channelConfig, payment.getExpiresAt()));
        payment.setCreatedAt(now);
        payment.setUpdatedAt(now);
        paymentRepository.insert(payment);
        return payment;
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
        {
            String transactionId = "TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
            paymentRepository.markPaid(paymentId, transactionId);
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
            return payment;
        }
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setOrderNo(payment.getOrderNo());
        request.setChannel(payment.getChannel());
        request.setTransactionId("TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT));
        request.setStatus("SUCCESS");
        request.setAmount(payment.getAmount());
        request.setSignature(expectedSignature(request));
        return handleCallback(request);
    }

    @Transactional
    public Payment handleCallback(PaymentCallbackRequest request) {
        String channel = normalizeChannel(request.getChannel());
        Payment payment = paymentRepository.findByOrderNoAndChannel(request.getOrderNo(), channel);
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if (!verifySignature(request)) {
            throw new IllegalArgumentException("Invalid payment callback signature");
        }
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
            paymentRepository.markPaid(payment.getId(), request.getTransactionId());
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
        Payment payment = paymentRepository.findByTransactionId(session.getId());
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if ("checkout.session.completed".equals(event.getType())) {
            if (PAID.equals(payment.getStatus())) {
                return payment;
            }
            paymentRepository.markPaid(payment.getId(), session.getPaymentIntent());
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
        String payload = request.getOrderNo() + "|" + normalizeChannel(request.getChannel()) + "|"
                + request.getTransactionId() + "|" + request.getStatus().toUpperCase(Locale.ROOT) + "|"
                + request.getAmount().stripTrailingZeros().toPlainString() + "|" + callbackSecret;
        return sha256(payload);
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
        if (isStripeChannel(channelConfig)) {
            return refreshStripePayment(payment, order, now, channelConfig);
        }
        payment.setAmount(order.getTotalAmount());
        payment.setStatus(PENDING);
        payment.setTransactionId(null);
        payment.setPaidAt(null);
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

    private boolean isExpired(Payment payment) {
        return PENDING.equals(payment.getStatus())
                && payment.getExpiresAt() != null
                && !payment.getExpiresAt().isAfter(LocalDateTime.now());
    }

    private String normalizeChannel(String channel) {
        if (channel == null || channel.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment channel is required");
        }
        return paymentChannelConfig.requireEnabled(channel).getCode();
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
            payment.setExpiresAt(now.plusMinutes(resolveTimeoutMinutes(channelConfig, stripeCheckoutExpireMinutes)));
            payment.setPaymentUrl(session.getUrl());
            payment.setPaidAt(null);
            payment.setUpdatedAt(now);
            paymentRepository.update(payment);
            return paymentRepository.findById(payment.getId());
        } catch (StripeException e) {
            throw new IllegalStateException("Failed to create Stripe Checkout session: " + e.getMessage());
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

    private boolean isStripeChannel(PaymentChannelConfig.Channel channel) {
        return "STRIPE".equals(channel.getCode()) || "STRIPE".equalsIgnoreCase(channel.getProvider());
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
            if (!isBlank(value)) {
                return value;
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
}
