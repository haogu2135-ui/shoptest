package com.example.shop.service;

import com.example.shop.config.HttpClientConfig;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
import java.util.concurrent.TimeUnit;

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
    private static final long STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300L;
    private static final long MERCADO_PAGO_WEBHOOK_TOLERANCE_SECONDS = 300L;
    private static final int DEFAULT_EXPIRY_SCAN_BATCH_SIZE = 500;
    private static final int HARD_EXPIRY_SCAN_BATCH_SIZE_LIMIT = 5000;
    private static final int DEFAULT_GATEWAY_HTTP_MAX_ATTEMPTS = 3;
    private static final int HARD_GATEWAY_HTTP_MAX_ATTEMPTS = 5;
    private static final long DEFAULT_GATEWAY_HTTP_RETRY_INITIAL_DELAY_MS = 500L;
    private static final long DEFAULT_GATEWAY_HTTP_RETRY_MAX_DELAY_MS = 5000L;

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

    private RestTemplate restTemplate = HttpClientConfig.defaultRestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public void setRestTemplate(RestTemplate restTemplate) {
        if (restTemplate != null) {
            this.restTemplate = restTemplate;
        }
    }

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
    public Payment handleStripeWebhook(String payload, String signatureHeader) {
        String webhookSecret = stripeWebhookSecret();
        if (isBlank(webhookSecret)) {
            throw new IllegalStateException("Stripe webhook secret is not configured");
        }
        Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, webhookSecret, STRIPE_WEBHOOK_TOLERANCE_SECONDS);
        } catch (Exception e) {
            log.warn("Stripe webhook rejected invalid signature");
            throw new IllegalArgumentException("Invalid Stripe webhook signature", e);
        }
        if (!"checkout.session.completed".equals(event.getType()) && !"checkout.session.expired".equals(event.getType())) {
            log.debug("Stripe webhook ignored unsupported event type: type={}", event.getType());
            return null;
        }
        Object stripeObject = event.getDataObjectDeserializer().getObject().orElse(null);
        if (!(stripeObject instanceof Session)) {
            log.warn("Stripe webhook ignored event with unavailable checkout session payload: eventId={}, type={}",
                    event.getId(), event.getType());
            return null;
        }
        Session session = (Session) stripeObject;
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

    @Transactional(rollbackFor = Exception.class)
    public Payment handleMercadoPagoWebhook(String payload,
                                            String signatureHeader,
                                            String requestIdHeader,
                                            String topicQuery,
                                            String dataIdQuery) {
        String webhookSecret = mercadoPagoWebhookSecret();
        if (isBlank(webhookSecret)) {
            throw new IllegalStateException("Mercado Pago webhook secret is not configured");
        }
        String accessToken = mercadoPagoAccessToken();
        if (isBlank(accessToken)) {
            throw new IllegalStateException("Mercado Pago access token is not configured");
        }

        JsonNode root = null;
        if (!isBlank(payload)) {
            try {
                root = objectMapper.readTree(payload);
            } catch (Exception e) {
                log.warn("Mercado Pago webhook rejected malformed JSON payload");
                throw new IllegalArgumentException("Invalid Mercado Pago webhook payload", e);
            }
        }

        String topic = firstNonBlank(
                topicQuery,
                root == null ? null : readText(root, "type"),
                root == null ? null : readText(root, "topic"),
                root == null ? null : readText(root, "action"));
        String dataId = firstNonBlank(
                dataIdQuery,
                root == null ? null : readNestedText(root, "data", "id"),
                root == null ? null : readText(root, "id"),
                root == null ? null : readText(root, "resource"));
        if (isBlank(dataId) && topic != null && topic.contains("/")) {
            // Some notifications send resource paths such as "payments/123".
            String[] parts = topic.split("/");
            if (parts.length > 0) {
                dataId = firstNonBlank(parts[parts.length - 1]);
            }
        }
        dataId = trimToNull(dataId);
        if (isBlank(dataId)) {
            log.debug("Mercado Pago webhook ignored notification without payment id: topic={}", topic);
            return null;
        }

        String normalizedTopic = String.valueOf(topic == null ? "" : topic).trim().toLowerCase(Locale.ROOT);
        boolean paymentTopic = normalizedTopic.isEmpty()
                || normalizedTopic.contains("payment")
                || "merchant_order".equals(normalizedTopic);
        if (!paymentTopic) {
            log.debug("Mercado Pago webhook ignored unsupported topic: topic={}, dataId={}", topic, dataId);
            return null;
        }

        if (!verifyMercadoPagoSignature(signatureHeader, requestIdHeader, dataId, webhookSecret)) {
            log.warn("Mercado Pago webhook rejected invalid signature: dataId={}", dataId);
            throw new IllegalArgumentException("Invalid Mercado Pago webhook signature");
        }

        JsonNode providerPayment = fetchMercadoPagoPayment(dataId, accessToken);
        if (providerPayment == null || providerPayment.isNull()) {
            log.warn("Mercado Pago webhook ignored unavailable payment payload: dataId={}", dataId);
            return null;
        }

        String status = firstNonBlank(readText(providerPayment, "status"), "").toLowerCase(Locale.ROOT);
        String externalReference = firstNonBlank(
                readText(providerPayment, "external_reference"),
                readText(providerPayment, "externalReference"));
        String providerReference = firstNonBlank(readText(providerPayment, "id"), dataId);
        String transactionId = firstNonBlank(
                readNestedText(providerPayment, "transaction_details", "payment_method_reference_id"),
                readText(providerPayment, "payment_method_id"),
                providerReference);

        Payment payment = null;
        if (!isBlank(externalReference)) {
            payment = paymentRepository.findByOrderNoAndChannel(externalReference, "MERCADO_PAGO");
        }
        if (payment == null) {
            payment = paymentRepository.findByProviderReference(providerReference);
        }
        if (payment == null) {
            payment = paymentRepository.findByTransactionId(providerReference);
        }
        if (payment == null) {
            throw new IllegalArgumentException("Payment not found");
        }
        if (!"MERCADO_PAGO".equalsIgnoreCase(String.valueOf(payment.getChannel()))) {
            throw new IllegalArgumentException("Payment channel is not Mercado Pago");
        }

        if ("approved".equals(status)) {
            validateMercadoPagoPaidPayment(payment, providerPayment);
            if (isProviderPaidAlreadyAcknowledged(payment) || RECONCILE_REQUIRED.equals(payment.getStatus())) {
                return payment;
            }
            if (requiresProviderPaidReconciliation(payment)) {
                return markProviderPaidReconciliationRequired(
                        payment,
                        transactionId,
                        providerReference,
                        LocalDateTime.now(ZoneOffset.UTC));
            }
            if (!PENDING.equals(payment.getStatus())) {
                throw new IllegalStateException("Payment is not pending");
            }
            Payment reconcilePayment = claimOrderForProviderPaidSuccessOrReconcile(
                    payment,
                    transactionId,
                    providerReference,
                    LocalDateTime.now(ZoneOffset.UTC));
            if (reconcilePayment != null) {
                return reconcilePayment;
            }
            int updated = paymentRepository.markPaidDetailed(
                    payment.getId(),
                    transactionId,
                    providerReference,
                    LocalDateTime.now(ZoneOffset.UTC));
            if (updated == 0) {
                Payment latest = paymentRepository.findById(payment.getId());
                if (latest != null && PAID.equals(latest.getStatus())) {
                    logPaymentLifecycle("Mercado Pago webhook observed already paid payment", latest);
                    return latest;
                }
                throw new IllegalStateException("Mercado Pago payment state update failed");
            }
            logPaymentLifecycle("Mercado Pago webhook marked payment paid", payment, PAID);
            return paymentRepository.findById(payment.getId());
        }

        if (("rejected".equals(status) || "cancelled".equals(status) || "canceled".equals(status))
                && PENDING.equals(payment.getStatus())) {
            paymentRepository.markFailed(payment.getId());
            Payment latest = paymentRepository.findById(payment.getId());
            logPaymentLifecycle("Mercado Pago webhook marked payment failed", latest == null ? payment : latest, FAILED);
            return latest;
        }

        log.debug("Mercado Pago webhook acknowledged non-terminal status: paymentId={}, status={}", payment.getId(), status);
        return paymentRepository.findById(payment.getId());
    }

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public List<Payment> findStoredByOrderId(Long orderId) {
        return paymentRepository.findByOrderId(orderId);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<Payment> syncPaymentsByOrderId(Long orderId) {
        List<Payment> payments = paymentRepository.findByOrderId(orderId);
        boolean changedAny = false;
        for (Payment payment : payments) {
            if (payment == null) {
                continue;
            }
            try {
                Payment synced = syncProviderPaymentState(payment);
                if (synced != null) {
                    changedAny = true;
                    continue;
                }
                if (isExpired(payment)) {
                    expirePayment(payment);
                    changedAny = true;
                }
            } catch (RuntimeException ex) {
                log.warn("Order payment batch sync skipped failed payment: orderId={}, paymentId={}",
                        orderId, payment.getId(), ex);
            }
        }
        return changedAny ? paymentRepository.findByOrderId(orderId) : payments;
    }

    @Transactional(rollbackFor = Exception.class, readOnly = true)
    public Payment findStoredLatestByOrderId(Long orderId) {
        return paymentRepository.findLatestByOrderId(orderId);
    }

    @Transactional(rollbackFor = Exception.class)
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

    @Transactional(rollbackFor = Exception.class)
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
        int batchSize = paymentExpiryScanBatchSize();
        Long afterId = null;
        while (true) {
            List<Payment> expiredPayments = paymentRepository.findExpiredPending(afterId, batchSize);
            if (expiredPayments == null || expiredPayments.isEmpty()) {
                return;
            }
            Long nextAfterId = lastPaymentId(afterId, expiredPayments);
            for (Payment payment : expiredPayments) {
                if (payment == null || payment.getId() == null) {
                    continue;
                }
                expirePendingPaymentRow(payment);
            }
            if (expiredPayments.size() < batchSize || nextAfterId == null || nextAfterId.equals(afterId)) {
                return;
            }
            afterId = nextAfterId;
        }
    }

    private void expirePendingPaymentRow(Payment payment) {
        try {
            expireSinglePendingPayment(payment.getId());
        } catch (RuntimeException ex) {
            // Keep scheduler healthy; single-row conflicts should not fail the whole batch.
            log.warn(
                    "Payment expiry scan skipped payment after failure: paymentId={}, orderId={}, orderNo={}",
                    payment.getId(),
                    payment.getOrderId(),
                    payment.getOrderNo(),
                    ex);
        }
    }

    private Long lastPaymentId(Long fallback, List<Payment> payments) {
        Long lastId = fallback;
        for (Payment payment : payments) {
            if (payment != null && payment.getId() != null) {
                lastId = payment.getId();
            }
        }
        return lastId;
    }

    private int paymentExpiryScanBatchSize() {
        int configured = runtimeConfig == null
                ? DEFAULT_EXPIRY_SCAN_BATCH_SIZE
                : runtimeConfig.getInt("payment.expiry-scan-batch-size", DEFAULT_EXPIRY_SCAN_BATCH_SIZE);
        return Math.max(1, Math.min(configured, HARD_EXPIRY_SCAN_BATCH_SIZE_LIMIT));
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

    @Transactional(rollbackFor = Exception.class, propagation = Propagation.REQUIRES_NEW)
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
                + requiredCallbackTimestamp(request.getCallbackTimestamp());
        return hmacSha256Hex(payload, callbackSecret());
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
        long activePendingPayments = paymentRepository.countActivePendingByOrderId(payment.getOrderId());
        if (PENDING.equals(payment.getStatus()) && !isExpired(payment)) {
            activePendingPayments = Math.max(0, activePendingPayments - 1);
        }
        boolean cancelOrder = activePendingPayments <= 0;
        if (cancelOrder) {
            try {
                if (!orderService.cancelOrderForPaymentExpiry(payment.getOrderId())) {
                    return;
                }
            } catch (IllegalStateException ex) {
                // Order may already have moved on due to another idempotent callback.
                log.info(
                        "Payment expiry skipped order cancellation because order state changed: paymentId={}, orderId={}, orderNo={}, reason={}",
                        payment.getId(),
                        payment.getOrderId(),
                        payment.getOrderNo(),
                        ex.getMessage());
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
            throw stripeProviderUnavailable("Failed to create Stripe Checkout session", e);
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
            throw stripeProviderUnavailable("Failed to create Stripe Checkout session", e);
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
        int maxAttempts = paymentGatewayHttpMaxAttempts();
        long initialDelayMs = paymentGatewayRetryInitialDelayMs();
        long maxDelayMs = paymentGatewayRetryMaxDelayMs();
        String circuitName = "payment-create-" + channelConfig.getCode();
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ResponseEntity<String> response = circuitBreakerService.execute(circuitName, () -> restTemplate.exchange(
                        createUrl,
                        HttpMethod.POST,
                        new HttpEntity<>(payload, buildGatewayHeaders(channelConfig, idempotencyKey)),
                        String.class));
                if (!isRetryableGatewayResponse(response) || attempt >= maxAttempts) {
                    return response;
                }
                long retryDelayMs = gatewayRetryDelayMs(attempt, initialDelayMs, maxDelayMs);
                log.warn(
                        "Gateway create payment returned retryable status; retrying: orderId={}, orderNo={}, channel={}, attempt={}, maxAttempts={}, retryDelayMs={}, status={}",
                        order.getId(), order.getOrderNo(), channelConfig.getCode(), attempt, maxAttempts, retryDelayMs,
                        response.getStatusCodeValue());
                sleepBeforeGatewayRetry(retryDelayMs);
            } catch (RestClientException e) {
                if (!isRetryableGatewayException(e) || attempt >= maxAttempts) {
                    throw new IllegalStateException("Gateway create payment request failed: " + gatewayFailureMessage(e), e);
                }
                long retryDelayMs = gatewayRetryDelayMs(attempt, initialDelayMs, maxDelayMs);
                log.warn(
                        "Gateway create payment request failed transiently; retrying: orderId={}, orderNo={}, channel={}, attempt={}, maxAttempts={}, retryDelayMs={}, failure={}",
                        order.getId(), order.getOrderNo(), channelConfig.getCode(), attempt, maxAttempts, retryDelayMs,
                        gatewayFailureMessage(e));
                sleepBeforeGatewayRetry(retryDelayMs);
            }
        }
        throw new IllegalStateException("Gateway create payment request failed: retry attempts exhausted");
    }

    private boolean isRetryableGatewayResponse(ResponseEntity<String> response) {
        return response != null && isRetryableGatewayStatus(response.getStatusCode());
    }

    private boolean isRetryableGatewayException(RestClientException exception) {
        if (exception instanceof HttpStatusCodeException) {
            return isRetryableGatewayStatus(((HttpStatusCodeException) exception).getStatusCode());
        }
        return true;
    }

    private boolean isRetryableGatewayStatus(HttpStatus status) {
        if (status == null) {
            return false;
        }
        int value = status.value();
        return status.is5xxServerError() || value == 408 || value == 425 || value == 429;
    }

    private String gatewayFailureMessage(RestClientException exception) {
        if (exception instanceof HttpStatusCodeException) {
            return "HTTP " + ((HttpStatusCodeException) exception).getRawStatusCode();
        }
        String name = exception == null ? "" : exception.getClass().getSimpleName();
        return isBlank(name) ? "request failed" : name;
    }

    private long gatewayRetryDelayMs(int failedAttempt, long initialDelayMs, long maxDelayMs) {
        if (initialDelayMs <= 0 || maxDelayMs <= 0) {
            return 0L;
        }
        long multiplier = 1L << Math.min(Math.max(0, failedAttempt - 1), 10);
        long delay = initialDelayMs * multiplier;
        return Math.min(delay <= 0 ? maxDelayMs : delay, maxDelayMs);
    }

    private void sleepBeforeGatewayRetry(long retryDelayMs) {
        if (retryDelayMs <= 0) {
            return;
        }
        try {
            TimeUnit.MILLISECONDS.sleep(retryDelayMs);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Gateway create payment retry interrupted", e);
        }
    }

    private int paymentGatewayHttpMaxAttempts() {
        int configured = runtimeConfig == null
                ? DEFAULT_GATEWAY_HTTP_MAX_ATTEMPTS
                : runtimeConfig.getInt("payment.gateway-http-max-attempts", DEFAULT_GATEWAY_HTTP_MAX_ATTEMPTS);
        return Math.max(1, Math.min(configured, HARD_GATEWAY_HTTP_MAX_ATTEMPTS));
    }

    private long paymentGatewayRetryInitialDelayMs() {
        long configured = runtimeConfig == null
                ? DEFAULT_GATEWAY_HTTP_RETRY_INITIAL_DELAY_MS
                : runtimeConfig.getLong("payment.gateway-http-retry-initial-delay-ms", DEFAULT_GATEWAY_HTTP_RETRY_INITIAL_DELAY_MS);
        return Math.max(0L, Math.min(configured, DEFAULT_GATEWAY_HTTP_RETRY_MAX_DELAY_MS));
    }

    private long paymentGatewayRetryMaxDelayMs() {
        long configured = runtimeConfig == null
                ? DEFAULT_GATEWAY_HTTP_RETRY_MAX_DELAY_MS
                : runtimeConfig.getLong("payment.gateway-http-retry-max-delay-ms", DEFAULT_GATEWAY_HTTP_RETRY_MAX_DELAY_MS);
        return Math.max(0L, Math.min(configured, DEFAULT_GATEWAY_HTTP_RETRY_MAX_DELAY_MS));
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
            log.debug("Gateway payment expiresAt value is invalid; using fallback: expiresAt={}", expiresAtText, e);
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
        return stripeRequestOptionsBuilder(apiKey).build();
    }

    private RequestOptions stripeRequestOptions(String apiKey, String idempotencyKey) {
        return stripeRequestOptionsBuilder(apiKey)
                .setIdempotencyKey(idempotencyKey)
                .build();
    }

    private RequestOptions.RequestOptionsBuilder stripeRequestOptionsBuilder(String apiKey) {
        return RequestOptions.builder()
                .setApiKey(apiKey)
                .setConnectTimeout(paymentHttpConnectTimeoutMs())
                .setReadTimeout(paymentHttpReadTimeoutMs());
    }

    private IllegalStateException stripeProviderUnavailable(String operation, StripeException cause) {
        return new IllegalStateException(operation + ". Payment provider is temporarily unavailable", cause);
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
            return false;
        }
        String paymentSimulationEnabled = runtimeConfig.getString("payment.simulation-enabled", "");
        if (!isBlank(paymentSimulationEnabled)) {
            return Boolean.parseBoolean(paymentSimulationEnabled.trim());
        }
        return "debug".equals(mode) || "dev".equals(mode) || "test".equals(mode);
    }

    private String hmacSha256Hex(String value, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HmacSHA256 is not available", e);
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

    private int paymentHttpConnectTimeoutMs() {
        return HttpClientConfig.normalizeTimeout(
                runtimeConfig == null ? 0 : runtimeConfig.getInt("payment.http.connect-timeout-ms", HttpClientConfig.DEFAULT_CONNECT_TIMEOUT_MS),
                HttpClientConfig.DEFAULT_CONNECT_TIMEOUT_MS);
    }

    private int paymentHttpReadTimeoutMs() {
        return HttpClientConfig.normalizeTimeout(
                runtimeConfig == null ? 0 : runtimeConfig.getInt("payment.http.read-timeout-ms", HttpClientConfig.DEFAULT_READ_TIMEOUT_MS),
                HttpClientConfig.DEFAULT_READ_TIMEOUT_MS);
    }

    private String stripeSecretKey() {
        return runtimeConfig.getString("stripe.secret-key", "");
    }


    private boolean verifyMercadoPagoSignature(String signatureHeader, String requestIdHeader, String dataId, String secret) {
        String signature = trimToNull(signatureHeader);
        if (signature == null || isBlank(secret) || isBlank(dataId)) {
            return false;
        }
        String ts = null;
        String v1 = null;
        for (String part : signature.split(",")) {
            String[] kv = part.split("=", 2);
            if (kv.length != 2) {
                continue;
            }
            String key = kv[0].trim().toLowerCase(Locale.ROOT);
            String value = kv[1].trim();
            if ("ts".equals(key)) {
                ts = value;
            } else if ("v1".equals(key)) {
                v1 = value;
            }
        }
        if (isBlank(ts) || isBlank(v1)) {
            return false;
        }
        long timestampSeconds;
        try {
            timestampSeconds = Long.parseLong(ts);
        } catch (NumberFormatException ex) {
            return false;
        }
        long now = Instant.now().getEpochSecond();
        if (Math.abs(now - timestampSeconds) > MERCADO_PAGO_WEBHOOK_TOLERANCE_SECONDS) {
            log.warn("Mercado Pago webhook rejected stale signature timestamp: ts={}, now={}", timestampSeconds, now);
            return false;
        }
        String requestId = firstNonBlank(requestIdHeader, "");
        String manifest = "id:" + dataId + ";request-id:" + requestId + ";ts:" + ts + ";";
        String expected = hmacSha256Hex(manifest, secret);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                v1.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8));
    }

    private JsonNode fetchMercadoPagoPayment(String paymentId, String accessToken) {
        String url = "https://api.mercadopago.com/v1/payments/" + urlEncode(paymentId);
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));
            ResponseEntity<String> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    String.class);
            if (!response.getStatusCode().is2xxSuccessful() || isBlank(response.getBody())) {
                throw new IllegalStateException("Mercado Pago payment lookup failed");
            }
            return objectMapper.readTree(response.getBody());
        } catch (HttpStatusCodeException e) {
            throw new IllegalStateException("Mercado Pago payment lookup failed: HTTP " + e.getRawStatusCode(), e);
        } catch (RestClientException e) {
            throw new IllegalStateException("Mercado Pago payment lookup failed", e);
        } catch (Exception e) {
            throw new IllegalStateException("Mercado Pago payment lookup failed", e);
        }
    }

    private void validateMercadoPagoPaidPayment(Payment payment, JsonNode providerPayment) {
        if (payment == null || providerPayment == null) {
            throw new IllegalArgumentException("Mercado Pago payment payload is required");
        }
        BigDecimal paidAmount = null;
        JsonNode transactionAmount = providerPayment.get("transaction_amount");
        if (transactionAmount != null && !transactionAmount.isNull()) {
            try {
                paidAmount = new BigDecimal(transactionAmount.asText()).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception ignored) {
                paidAmount = null;
            }
        }
        if (paidAmount != null && payment.getAmount() != null) {
            BigDecimal expected = payment.getAmount().setScale(2, RoundingMode.HALF_UP);
            if (paidAmount.compareTo(expected) != 0) {
                throw new IllegalArgumentException("Mercado Pago paid amount mismatch");
            }
        }
        String currency = firstNonBlank(readText(providerPayment, "currency_id"), "MXN").toUpperCase(Locale.ROOT);
        if (!isBlank(currency)) {
            log.debug("Mercado Pago currency observed: {}", currency);
        }
    }

    private String readNestedText(JsonNode root, String parent, String child) {
        if (root == null) {
            return null;
        }
        JsonNode parentNode = root.get(parent);
        if (parentNode == null || parentNode.isNull()) {
            return null;
        }
        return readText(parentNode, child);
    }

    private String mercadoPagoWebhookSecret() {
        return firstNonBlank(
                runtimeConfig.getString("payment.mercado-pago.webhook-secret", ""),
                runtimeConfig.getString("mercadopago.webhook-secret", ""));
    }

    private String mercadoPagoAccessToken() {
        return firstNonBlank(
                runtimeConfig.getString("payment.mercado-pago.access-token", ""),
                runtimeConfig.getString("mercadopago.access-token", ""));
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
                storefrontBaseUrl() + "/profile?payment=cancelled");
    }

    private String paymentSuccessUrl() {
        return firstNonBlank(
                runtimeConfig.getString("payment.success-url", ""),
                storefrontBaseUrl() + "/profile?payment=success");
    }

    private String paymentCancelUrl() {
        return firstNonBlank(
                runtimeConfig.getString("payment.cancel-url", ""),
                storefrontBaseUrl() + "/profile?payment=cancelled");
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
        boolean guestOrder = order != null && (Boolean.TRUE.equals(order.getGuestOrder()) || guestEmailForOrder(order) != null);
        String baseUrl = trimToNull(configuredUrl);
        if (guestOrder) {
            // Guests recover on track-order (profile requires auth).
            baseUrl = storefrontBaseUrl() + "/track-order";
        }
        if (baseUrl == null) {
            baseUrl = guestOrder
                    ? storefrontBaseUrl() + "/track-order"
                    : storefrontBaseUrl() + "/profile";
        }
        String url = appendQueryParam(baseUrl, "orderNo", order == null ? null : order.getOrderNo());
        if (!guestOrder && order != null && order.getId() != null) {
            url = appendQueryParam(url, "orderId", String.valueOf(order.getId()));
        }
        // Guest email enables track-order auto-lookup; FE strips it into local guest context after load.
        if (guestOrder) {
            url = appendQueryParam(url, "guestEmail", guestEmailForOrder(order));
        }
        // Keep tab=orders for registered recovery when profile is the landing page.
        if (!guestOrder && urlContainsPath(url, "/profile")) {
            url = appendQueryParam(url, "tab", "orders");
        }
        return appendQueryParam(url, statusKey, statusValue);
    }

    private boolean urlContainsPath(String url, String pathFragment) {
        String normalized = trimToNull(url);
        String fragment = trimToNull(pathFragment);
        if (normalized == null || fragment == null) {
            return false;
        }
        int queryIndex = normalized.indexOf('?');
        String pathOnly = queryIndex >= 0 ? normalized.substring(0, queryIndex) : normalized;
        return pathOnly.contains(fragment);
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
