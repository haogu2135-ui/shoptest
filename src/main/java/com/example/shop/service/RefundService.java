package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.entity.Order;
import com.example.shop.entity.Payment;
import com.example.shop.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.Refund;
import com.stripe.net.RequestOptions;
import com.stripe.param.RefundCreateParams;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class RefundService {
    private static final String STATUS_REFUNDED = "REFUNDED";

    @Autowired
    private PaymentRepository paymentRepository;
    @Autowired
    private PaymentChannelConfig paymentChannelConfig;

    @Value("${stripe.secret-key:}")
    private String stripeSecretKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void refundPaidPayment(Order order) {
        Payment payment = paymentRepository.findLatestPaidByOrderId(order.getId());
        if (payment == null) {
            return;
        }
        PaymentChannelConfig.Channel channel = paymentChannelConfig.findConfigured(payment.getChannel()).orElse(null);
        String refundReference = null;
        if (shouldRefundViaStripe(payment, channel)) {
            refundReference = refundStripePayment(order, payment);
        } else if (shouldRefundViaGenericApi(channel)) {
            refundReference = refundGenericApiPayment(order, payment, channel);
        }
        int updated = paymentRepository.markRefunded(payment.getId(), refundReference);
        if (updated == 0 && !STATUS_REFUNDED.equals(resolveLatestPaymentStatus(payment.getId()))) {
            throw new IllegalStateException("Refund state update failed");
        }
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
        if (isBlank(stripeSecretKey)) {
            throw new IllegalStateException("Stripe secret key is not configured");
        }
        if (isBlank(payment.getTransactionId())) {
            throw new IllegalStateException("Stripe payment intent is missing");
        }
        try {
            Stripe.apiKey = stripeSecretKey;
            Refund refund = Refund.create(RefundCreateParams.builder()
                    .setPaymentIntent(payment.getTransactionId())
                    .build(),
                    RequestOptions.builder()
                            .setIdempotencyKey("return-refund-" + order.getId() + "-" + payment.getId())
                            .build());
            return refund.getId();
        } catch (StripeException e) {
            throw new IllegalStateException("Stripe refund failed: " + e.getMessage());
        }
    }

    private String refundGenericApiPayment(Order order, Payment payment, PaymentChannelConfig.Channel channel) {
        String refundUrl = trimToNull(channel.getRefundUrl());
        if (refundUrl == null) {
            throw new IllegalStateException("Refund URL is not configured for channel " + channel.getCode());
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("orderId", order.getId());
        payload.put("orderNo", order.getOrderNo());
        payload.put("paymentId", payment.getId());
        payload.put("transactionId", payment.getTransactionId());
        payload.put("providerReference", payment.getProviderReference());
        payload.put("channel", payment.getChannel());
        payload.put("amount", normalizeAmount(payment.getAmount()));
        payload.put("currency", resolveCurrency(channel));
        payload.put("reason", "RETURN_COMPLETED");
        payload.put("merchantId", trimToNull(channel.getMerchantId()));
        ResponseEntity<String> response;
        try {
            response = restTemplate.exchange(
                    refundUrl,
                    HttpMethod.POST,
                    new HttpEntity<>(payload, buildHeaders(channel)),
                    String.class);
        } catch (RestClientException e) {
            throw new IllegalStateException("Gateway refund request failed: " + e.getMessage());
        }
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Gateway refund request failed with status " + response.getStatusCodeValue());
        }
        return parseRefundReference(response.getBody(), payment.getId());
    }

    private HttpHeaders buildHeaders(PaymentChannelConfig.Channel channel) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String authHeaderName = trimToNull(channel.getAuthHeaderName());
        String authHeaderValue = trimToNull(channel.getAuthHeaderValue());
        if (authHeaderName != null && authHeaderValue != null) {
            headers.set(authHeaderName, authHeaderValue);
        }
        return headers;
    }

    private String parseRefundReference(String responseBody, Long paymentId) {
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
}
