package com.example.shop.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Data
@Component
@ConfigurationProperties(prefix = "payment")
public class PaymentChannelConfig {
    private static final String PROVIDER_STRIPE = "STRIPE";
    private static final String PROVIDER_GENERIC_REDIRECT = "GENERIC_REDIRECT";
    private static final String PROVIDER_GENERIC_API = "GENERIC_API";

    private String supportedChannels = "STRIPE,SHOP_PAY,PAYPAL,APPLE_PAY,GOOGLE_PAY,VISA,MX_LOCAL_CARD,SPEI,OXXO,ALIPAY,WECHAT_PAY,UNIONPAY,CODI,MERCADO_PAGO";
    private String checkoutBaseUrl = "https://pay.example.local/checkout";
    private String defaultCurrency = "MXN";
    private List<Channel> channels = new ArrayList<>();
    private Geo geo = new Geo();

    public List<Channel> configuredChannels() {
        List<Channel> configured = channels.stream()
                .sorted(Comparator.comparingInt(Channel::getSortOrder).thenComparing(Channel::getCode))
                .collect(Collectors.toList());
        if (!configured.isEmpty()) {
            return configured;
        }
        return defaultChannels().stream()
                .filter(channel -> supportedChannelSet().contains(channel.getCode()))
                .collect(Collectors.toList());
    }

    public List<Channel> enabledChannels() {
        return configuredChannels().stream()
                .filter(Channel::isEnabled)
                .collect(Collectors.toList());
    }

    public Channel requireEnabled(String code) {
        String normalized = normalize(code);
        return findEnabled(normalized)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment channel: " + code));
    }

    public Channel requireConfigured(String code) {
        String normalized = normalize(code);
        return findConfigured(normalized)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment channel: " + code));
    }

    public Optional<Channel> findEnabled(String code) {
        String normalized = normalize(code);
        return enabledChannels().stream()
                .filter(channel -> channel.getCode().equals(normalized))
                .findFirst();
    }

    public Optional<Channel> findConfigured(String code) {
        String normalized = normalize(code);
        return configuredChannels().stream()
                .filter(channel -> channel.getCode().equals(normalized))
                .findFirst();
    }

    private List<String> supportedChannelSet() {
        return List.of(supportedChannels.split(",")).stream()
                .map(this::normalize)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toList());
    }

    private String normalize(String code) {
        return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
    }

    private List<Channel> defaultChannels() {
        return List.of(
                channel("STRIPE", "Stripe / Card", "pages.checkout.paymentStripeDesc", "GLOBAL", "MXN", "STRIPE", "STRIPE", 10),
                channel("MERCADO_PAGO", "Mercado Pago", "pages.checkout.paymentMercadoPagoDesc", "MX", "MXN", "GENERIC_REDIRECT", "MANUAL", 20),
                channel("OXXO", "OXXO Pay", "pages.checkout.paymentOxxoDesc", "MX", "MXN", "GENERIC_REDIRECT", "MANUAL", 30),
                channel("SPEI", "SPEI", "pages.checkout.paymentSpeiDesc", "MX", "MXN", "GENERIC_REDIRECT", "MANUAL", 40),
                channel("CODI", "CoDi", "pages.checkout.paymentCodiDesc", "MX", "MXN", "GENERIC_REDIRECT", "MANUAL", 50),
                channel("MX_LOCAL_CARD", "Tarjeta local", "pages.checkout.paymentLocalCardDesc", "MX", "MXN", "GENERIC_REDIRECT", "MANUAL", 60),
                channel("ALIPAY", "Alipay", "pages.checkout.paymentAlipayDesc", "CN", "CNY", "GENERIC_REDIRECT", "MANUAL", 70),
                channel("WECHAT_PAY", "WeChat Pay", "pages.checkout.paymentWechatDesc", "CN", "CNY", "GENERIC_REDIRECT", "MANUAL", 80),
                channel("UNIONPAY", "UnionPay", "pages.checkout.paymentUnionPayDesc", "CN", "CNY", "GENERIC_REDIRECT", "MANUAL", 90),
                channel("PAYPAL", "PayPal", "pages.checkout.paymentPaypalDesc", "GLOBAL", "MXN", "GENERIC_REDIRECT", "MANUAL", 100),
                channel("APPLE_PAY", "Apple Pay", "pages.checkout.paymentApplePayDesc", "GLOBAL", "MXN", "GENERIC_REDIRECT", "MANUAL", 110),
                channel("GOOGLE_PAY", "Google Pay", "pages.checkout.paymentGooglePayDesc", "GLOBAL", "MXN", "GENERIC_REDIRECT", "MANUAL", 120),
                channel("VISA", "Visa / Mastercard", "pages.checkout.paymentCardDesc", "GLOBAL", "MXN", "GENERIC_REDIRECT", "MANUAL", 130),
                channel("SHOP_PAY", "Shop Pay", "pages.checkout.paymentShopPayDesc", "GLOBAL", "MXN", "GENERIC_REDIRECT", "MANUAL", 140)
        );
    }

    private Channel channel(String code, String displayName, String descriptionKey, String market, String currency, String provider, String refundMode, int sortOrder) {
        Channel channel = new Channel();
        channel.setCode(code);
        channel.setDisplayName(displayName);
        channel.setDescriptionKey(descriptionKey);
        channel.setMarket(market);
        channel.setCurrency(currency);
        channel.setProvider(provider);
        channel.setRefundMode(refundMode);
        channel.setSortOrder(sortOrder);
        channel.setEnabled(true);
        return channel;
    }

    @Data
    public static class Channel {
        private String code;
        private String displayName;
        private String labelKey;
        private String descriptionKey;
        private String market = "GLOBAL";
        private String currency = "MXN";
        private String provider = "GENERIC_REDIRECT";
        private String refundMode = "MANUAL";
        private String checkoutUrl;
        private String createUrl;
        private String refundUrl;
        private String authHeaderName;
        private String authHeaderValue;
        private String merchantId;
        private String badgeKey;
        private boolean enabled = true;
        private int sortOrder = 100;
        private Long expiresMinutes;
        private Map<String, String> metadata;

        public String getCode() {
            return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        }

        public String getProvider() {
            return normalizeUpper(provider, PROVIDER_GENERIC_REDIRECT);
        }

        public String getRefundMode() {
            return normalizeUpper(refundMode, "MANUAL");
        }

        public boolean isStripeProvider() {
            return PROVIDER_STRIPE.equals(getCode()) || PROVIDER_STRIPE.equals(getProvider());
        }

        public boolean isGenericApiProvider() {
            return PROVIDER_GENERIC_API.equals(getProvider());
        }

        public boolean isGenericRedirectProvider() {
            return PROVIDER_GENERIC_REDIRECT.equals(getProvider());
        }

        private String normalizeUpper(String value, String fallback) {
            String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
            return normalized.isEmpty() ? fallback : normalized;
        }
    }

    @Data
    public static class Geo {
        private boolean enabled = true;
        private List<String> countryHeaderNames = new ArrayList<>(List.of(
                "CF-IPCountry",
                "X-Country-Code",
                "X-Geo-Country",
                "X-Country"
        ));
        private String lookupUrl;
        private int lookupTimeoutMs = 1200;
        private String localIpCountry;
        private String fallbackCountry;
    }
}
