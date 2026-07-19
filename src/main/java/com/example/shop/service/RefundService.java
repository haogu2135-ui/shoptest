package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;

import com.example.shop.config.HttpClientConfig;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.util.GatewayUrlValidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class RefundService {
    private static final String STATUS_PAID = "PAID";
    private static final String STATUS_RECONCILE_REQUIRED = "RECONCILE_REQUIRED";
    private static final String STATUS_REFUNDED = "REFUNDED";
    private static final String STATUS_REFUNDING = "REFUNDING";

    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private PaymentChannelConfig paymentChannelConfig;
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
    public Payment refundPaidPayment(Order order, String reason) {
        return refundPaidPayment(order, reason, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public Payment refundPaidPayment(Order order, String reason, String manualRefundReference) {
        String normalizedReason = normalizeReason(reason);
        String normalizedManualReference = normalizeManualRefundReference(manualRefundReference);
        Payment payment = findLatestRefundablePayment(order.getId());
        if (payment == null) {
            Payment refunded = paymentRepository.findLatestRefundedByOrderId(order.getId());
            if (refunded != null) {
                return refunded;
            }
            Payment latest = paymentRepository.findLatestByOrderId(order.getId());
            if (latest != null && STATUS_REFUNDING.equals(latest.getStatus())) {
                return completeRefundingPayment(order, latest, normalizedReason, normalizedManualReference, false);
            }
            throw new IllegalStateException("No paid payment found for refund");
        }
        String claimedStatus = refundClaimRevertStatus(payment);
        int claimed = paymentRepository.markRefunding(payment.getId());
        if (claimed == 0) {
            String latestStatus = resolveLatestPaymentStatus(payment.getId());
            if (STATUS_REFUNDED.equals(latestStatus)) {
                return paymentRepository.findById(payment.getId());
            }
            if (STATUS_REFUNDING.equals(latestStatus)) {
                Payment latest = paymentRepository.findById(payment.getId());
                return completeRefundingPayment(order, latest == null ? payment : latest, normalizedReason, normalizedManualReference, false);
            }
            throw new IllegalStateException("Refund state claim failed");
        }
        return completeRefundingPayment(order, payment, normalizedReason, normalizedManualReference, true, claimedStatus);
    }

    private Payment completeRefundingPayment(Order order, Payment payment, String normalizedReason, String normalizedManualReference, boolean newlyClaimed) {
        return completeRefundingPayment(order, payment, normalizedReason, normalizedManualReference, newlyClaimed, STATUS_PAID);
    }

    private Payment completeRefundingPayment(Order order, Payment payment, String normalizedReason, String normalizedManualReference, boolean newlyClaimed, String claimedStatus) {
        PaymentChannelConfig.Channel channel = paymentChannelConfig.findConfigured(payment.getChannel()).orElse(null);
        String refundReference = null;
        try {
            if (shouldRefundViaStripe(payment, channel)) {
                refundReference = refundStripePayment(order, payment);
            } else if (shouldRefundViaGenericApi(channel)) {
                refundReference = refundGenericApiPayment(order, payment, channel, normalizedReason);
            } else {
                refundReference = firstNonBlank(normalizedManualReference, "MANUAL-" + order.getId() + "-" + payment.getId());
            }
        } catch (RuntimeException e) {
            if (newlyClaimed) {
                paymentRepository.revertRefunding(payment.getId(), claimedStatus);
            }
            throw e;
        }
        int updated = paymentRepository.markRefunded(payment.getId(), refundReference);
        if (updated == 0 && !STATUS_REFUNDED.equals(resolveLatestPaymentStatus(payment.getId()))) {
            throw new IllegalStateException("Refund state update failed");
        }
        return paymentRepository.findById(payment.getId());
    }

    private Payment findLatestRefundablePayment(Long orderId) {
        Payment payment = paymentRepository.findLatestPaidByOrderId(orderId);
        if (payment != null) {
            return payment;
        }
        return paymentRepository.findLatestReconcileRequiredByOrderId(orderId);
    }

    private String refundClaimRevertStatus(Payment payment) {
        return STATUS_RECONCILE_REQUIRED.equals(payment.getStatus()) ? STATUS_RECONCILE_REQUIRED : STATUS_PAID;
    }

    private boolean shouldRefundViaStripe(Payment payment, PaymentChannelConfig.Channel channel) {
        if (channel == null) {
            return "STRIPE".equals(payment.getChannel());
        }
        return "STRIPE".equals(channel.getCode())
                || "STRIPE".equalsIgnoreCase(channel.getProvider())
                || "STRIPE".equalsIgnoreCase(channel.getRefundMode());
    }

    private boolean shouldRefundViaGenericApi(PaymentChannelConfig.Channel channel) {
        return channel != null
                && "GENERIC_API".equalsIgnoreCase(channel.getRefundMode())
                && !isBlank(channel.getRefundUrl());
    }

    private String refundStripePayment(Order order, Payment payment) {
        String secretKey = stripeSecretKey();
        if (isBlank(secretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        String paymentIntent = resolveStripePaymentIntent(payment);
        if (isBlank(paymentIntent)) {
            throw new IllegalStateException("Stripe payment intent is missing");
        }
        try {
            Refund refund = Refund.create(RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntent)
                    .build(),
                    stripeRequestOptions(secretKey, "return-refund-" + order.getId() + "-" + payment.getId()));
            return refund.getId();
        } catch (StripeException e) {
            throw stripeProviderUnavailable("Stripe refund failed", e);
        }
    }

    private String resolveStripePaymentIntent(Payment payment) {
        String transactionId = trimToNull(payment.getTransactionId());
        if (transactionId != null && transactionId.startsWith("pi_")) {
            return transactionId;
        }
        String providerReference = trimToNull(payment.getProviderReference());
        String sessionId = firstNonBlank(
                providerReference != null && providerReference.startsWith("cs_") ? providerReference : null,
                transactionId != null && transactionId.startsWith("cs_") ? transactionId : null);
        if (sessionId == null) {
            return null;
        }
        try {
            Session session = Session.retrieve(sessionId, stripeRequestOptions(stripeSecretKey()));
            return trimToNull(session.getPaymentIntent());
        } catch (StripeException e) {
            throw stripeProviderUnavailable("Stripe payment lookup failed", e);
        }
    }

    private String refundGenericApiPayment(Order order, Payment payment, PaymentChannelConfig.Channel channel, String reason) {
        String refundUrl = trimToNull(channel.getRefundUrl());
        if (refundUrl == null) {
            throw new IllegalStateException("Refund URL is not configured for channel " + channel.getCode());
        }
        String safeRefundUrl = GatewayUrlValidator.requireOutboundHttpUrl(refundUrl, runtimeConfig.getBoolean("payment.gateway-allow-local", false), "Refund URL");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("orderNo", order.getOrderNo());
        payload.put("paymentId", payment.getId());
        payload.put("transactionId", payment.getTransactionId());
        payload.put("providerReference", payment.getProviderReference());
        payload.put("channel", payment.getChannel());
        payload.put("amount", normalizeAmount(payment.getAmount()));
        payload.put("currency", resolveCurrency(channel));
        payload.put("reason", firstNonBlank(reason, "RETURN_COMPLETED"));
        payload.put("merchantId", trimToNull(channel.getMerchantId()));
        String idempotencyKey = refundIdempotencyKey(order, payment);
        payload.put("idempotencyKey", idempotencyKey);
        ResponseEntity<String> response;
        try {
            response = circuitBreakerService.execute("payment-refund-" + channel.getCode(), () -> restTemplate.exchange(
                    safeRefundUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(payload, buildHeaders(channel, idempotencyKey)),
                    String.class));
        } catch (RestClientException e) {
            throw new IllegalStateException("Gateway refund request failed: " + e.getMessage());
        }
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Gateway refund request failed with status " + response.getStatusCodeValue());
        }
        return parseRefundReference(response.getBody(), payment, channel);
    }

    private HttpHeaders buildHeaders(PaymentChannelConfig.Channel channel, String idempotencyKey) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String authHeaderName = trimToNull(channel.getAuthHeaderName());
        String authHeaderValue = trimToNull(channel.getAuthHeaderValue());
        if (authHeaderName != null && authHeaderValue != null) {
            headers.set(authHeaderName, authHeaderValue);
        }
        headers.set("Idempotency-Key", idempotencyKey);
        return headers;
    }

    private String parseRefundReference(String responseBody, Payment payment, PaymentChannelConfig.Channel channel) {
        if (isBlank(responseBody)) {
            throw new IllegalStateException("Gateway refund response is empty");
        }
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String status = readText(root, "status");
            if (status != null) {
                String normalized = status.trim().toUpperCase(Locale.ROOT);
                if (!"SUCCESS".equals(normalized) && !"REFUNDED".equals(normalized) && !"OK".equals(normalized)) {
                    throw new IllegalStateException("Gateway refund rejected with status " + status);
                }
            }
            validateGatewayRefundAmount(root, payment, channel);
            String reference = firstNonBlank(
                    readText(root, "refundReference"),
                    readText(root, "refundId"),
                    readText(root, "reference"),
                    readText(root, "id"));
            if (reference == null) {
                throw new IllegalStateException("Gateway refund response is missing refund reference");
            }
            return reference;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("Gateway refund response is invalid");
        }
    }

    private void validateGatewayRefundAmount(JsonNode root, Payment payment, PaymentChannelConfig.Channel channel) {
        String amountText = firstNonBlank(
                readText(root, "amount"),
                readText(root, "refundAmount"),
                readText(root, "refundedAmount"),
                readText(root, "amountRefunded"));
        if (amountText == null) {
            throw new IllegalStateException("Gateway refund response is missing refunded amount");
        }
        BigDecimal refundedAmount;
        try {
            refundedAmount = new BigDecimal(amountText);
        } catch (NumberFormatException e) {
            throw new IllegalStateException("Gateway refund response amount is invalid");
        }
        BigDecimal expectedAmount = payment.getAmount();
        if (expectedAmount == null || refundedAmount.compareTo(expectedAmount) != 0) {
            throw new IllegalStateException("Gateway refund response amount mismatch");
        }
        String expectedCurrency = resolveCurrency(channel);
        String actualCurrency = firstNonBlank(
                readText(root, "currency"),
                readText(root, "refundCurrency"),
                readText(root, "refundedCurrency"));
        if (actualCurrency == null) {
            throw new IllegalStateException("Gateway refund response is missing currency");
        }
        if (!expectedCurrency.equalsIgnoreCase(actualCurrency)) {
            throw new IllegalStateException("Gateway refund response currency mismatch");
        }
    }

    private String resolveLatestPaymentStatus(Long paymentId) {
        Payment latest = paymentRepository.findById(paymentId);
        return latest == null ? null : latest.getStatus();
    }

    private String resolveCurrency(PaymentChannelConfig.Channel channel) {
        String currency = channel.getCurrency();
        if (currency == null || currency.trim().isEmpty()) {
            currency = paymentChannelConfig.getDefaultCurrency();
        }
        return currency == null ? "MXN" : currency.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeAmount(BigDecimal amount) {
        return amount == null ? "0" : amount.stripTrailingZeros().toPlainString();
    }

    private String refundIdempotencyKey(Order order, Payment payment) {
        return "return-refund-" + order.getId() + "-" + payment.getId();
    }

    private String normalizeReason(String reason) {
        String normalized = trimToNull(reason);
        if (normalized == null) {
            return null;
        }
        return normalized.length() > 500 ? normalized.substring(0, 500) : normalized;
    }

    private String normalizeManualRefundReference(String reference) {
        String normalized = trimToNull(reference);
        if (normalized == null) {
            return null;
        }
        if (normalized.length() > 128) {
            throw new IllegalArgumentException("Manual refund reference must be 128 characters or less");
        }
        return normalized;
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = trimToNull(value);
            if (trimmed != null) {
                return trimmed;
            }
        }
        return null;
    }

    private String readText(JsonNode root, String fieldName) {
        JsonNode node = root.get(fieldName);
        if (node == null || node.isNull()) {
            return null;
        }
        String text = node.asText(null);
        return trimToNull(text);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String stripeSecretKey() {
        return runtimeConfig.getString("stripe.secret-key", "");
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
}
