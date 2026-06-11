package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.util.GatewayUrlValidator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentChannelAvailabilityService {
    private static final String DEFAULT_STOREFRONT_BASE_URL = "https://pet.686888666.xyz";
    private final PaymentChannelConfig paymentChannelConfig;
    private final RuntimeConfigService runtimeConfig;

    public PaymentChannelConfig.Channel requireAvailableForCheckout(String channel) {
        PaymentChannelConfig.Channel channelConfig = paymentChannelConfig.requireEnabled(channel);
        if (!isChannelAvailableForCheckout(channelConfig)) {
            throw new IllegalStateException("Payment channel is not configured for checkout");
        }
        return channelConfig;
    }

    public boolean isChannelAvailableForCheckout(PaymentChannelConfig.Channel channelConfig) {
        if (channelConfig == null || !channelConfig.isEnabled()) {
            return false;
        }
        if (!isProductionMode()) {
            return true;
        }
        if (channelConfig.isStripeProvider()) {
            return !isBlank(stripeSecretKey())
                    && !isBlank(stripeWebhookSecret())
                    && isProductionGatewayUrl(stripeSuccessUrl())
                    && isProductionGatewayUrl(stripeCancelUrl());
        }
        if (channelConfig.isGenericApiProvider()) {
            if (!isProductionGatewayUrl(channelConfig.getCreateUrl())) {
                return false;
            }
            return !"GENERIC_API".equals(channelConfig.getRefundMode())
                    || isProductionGatewayUrl(channelConfig.getRefundUrl());
        }
        String configuredUrl = firstNonBlank(channelConfig.getCheckoutUrl(), paymentChannelConfig.getCheckoutBaseUrl());
        return !containsPlaceholderGatewayHost(configuredUrl) && isProductionGatewayUrl(configuredUrl);
    }

    private boolean isProductionMode() {
        String mode = runtimeConfig.getString("app.runtime-mode", "production");
        return "production".equals(mode) || "prod".equals(mode);
    }

    private boolean isProductionGatewayUrl(String value) {
        if (isBlank(value)) {
            return false;
        }
        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            return "https".equals(scheme)
                    && !host.isBlank()
                    && uri.getUserInfo() == null
                    && !GatewayUrlValidator.isLocalOrPrivateHost(host);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private boolean containsPlaceholderGatewayHost(String value) {
        return value != null && value.toLowerCase(Locale.ROOT).contains("pay.example.local");
    }

    private String stripeSecretKey() {
        return runtimeConfig.getString("stripe.secret-key", "");
    }

    private String stripeWebhookSecret() {
        return runtimeConfig.getString("stripe.webhook-secret", "");
    }

    private String storefrontBaseUrl() {
        String configured = runtimeConfig.getString("app.storefront-base-url", DEFAULT_STOREFRONT_BASE_URL);
        String normalized = configured == null ? null : configured.trim().replaceAll("/+$", "");
        return isBlank(normalized) ? DEFAULT_STOREFRONT_BASE_URL : normalized;
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

    private String firstNonBlank(String... values) {
        for (String value : values) {
            String trimmed = value == null ? null : value.trim();
            if (trimmed != null && !trimmed.isEmpty()) {
                return trimmed;
            }
        }
        return "";
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
