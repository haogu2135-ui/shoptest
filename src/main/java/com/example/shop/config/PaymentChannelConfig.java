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
    private String supportedChannels = "STRIPE,SHOP_PAY,PAYPAL,APPLE_PAY,GOOGLE_PAY,VISA,MX_LOCAL_CARD,SPEI,OXXO,ALIPAY,WECHAT_PAY,UNIONPAY,CODI,MERCADO_PAGO";
    private String checkoutBaseUrl = "https://pay.example.local/checkout";
    private String defaultCurrency = "MXN";
    private List<Channel> channels = new ArrayList<>();

    public List<Channel> enabledChannels() {
        List<Channel> configured = channels.stream()
                .filter(Channel::isEnabled)
                .sorted(Comparator.comparingInt(Channel::getSortOrder).thenComparing(Channel::getCode))
                .collect(Collectors.toList());
        if (!configured.isEmpty()) {
            return configured;
        }
        return defaultChannels().stream()
                .filter(channel -> supportedChannelSet().contains(channel.getCode()))
                .collect(Collectors.toList());
    }

    public Channel requireEnabled(String code) {
        String normalized = normalize(code);
        return findEnabled(normalized)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported payment channel: " + code));
    }

    public Optional<Channel> findEnabled(String code) {
        String normalized = normalize(code);
        return enabledChannels().stream()
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
        private String badgeKey;
        private boolean enabled = true;
        private int sortOrder = 100;
        private Long expiresMinutes;
        private Map<String, String> metadata;

        public String getCode() {
            return code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        }
    }
}
