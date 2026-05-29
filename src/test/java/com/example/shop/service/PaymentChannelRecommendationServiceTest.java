package com.example.shop.service;

import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.PaymentChannelResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PaymentChannelRecommendationServiceTest {
    private PaymentChannelRecommendationService service;
    private RuntimeConfigService runtimeConfig;
    private PaymentChannelConfig config;

    @BeforeEach
    void setUp() {
        runtimeConfig = mock(RuntimeConfigService.class);
        when(runtimeConfig.getString(eq(ClientIpResolver.TRUSTED_PROXIES_KEY), anyString()))
                .thenReturn("127.0.0.1");
        config = new PaymentChannelConfig();
        config.setChannels(List.of(
                channel("ALIPAY", "CN", 10),
                channel("MERCADO_PAGO", "MX", 20),
                channel("STRIPE", "GLOBAL", 30)
        ));
        config.getGeo().setCountryHeaderNames(List.of("X-Country"));
        config.getGeo().setFallbackCountry("MX");
        service = new PaymentChannelRecommendationService(
                config,
                mock(CircuitBreakerService.class),
                new ClientIpResolver(runtimeConfig)
        );
    }

    @Test
    void ignoresSpoofedCountryHeaderWhenRequestDoesNotComeFromTrustedProxy() {
        MockHttpServletRequest request = request("203.0.113.20");
        request.addHeader("X-Country", "CN");

        List<PaymentChannelResponse> response = service.buildChannelResponses(config.enabledChannels(), request);

        assertEquals("MERCADO_PAGO", response.get(0).getCode());
        assertTrue(response.get(0).isRecommended());
        assertEquals("MX", response.get(0).getRecommendedCountry());
    }

    @Test
    void usesCountryHeaderWhenRequestComesFromTrustedProxy() {
        MockHttpServletRequest request = request("127.0.0.1");
        request.addHeader("X-Country", "CN");
        request.addHeader("X-Forwarded-For", "198.51.100.20");

        List<PaymentChannelResponse> response = service.buildChannelResponses(config.enabledChannels(), request);

        assertEquals("ALIPAY", response.get(0).getCode());
        assertTrue(response.get(0).isRecommended());
        assertEquals("CN", response.get(0).getRecommendedCountry());
    }

    private PaymentChannelConfig.Channel channel(String code, String market, int sortOrder) {
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode(code);
        channel.setDisplayName(code);
        channel.setMarket(market);
        channel.setCurrency("MXN");
        channel.setProvider("GENERIC_REDIRECT");
        channel.setSortOrder(sortOrder);
        channel.setEnabled(true);
        return channel;
    }

    private MockHttpServletRequest request(String remoteAddress) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/payments/channels");
        request.setRemoteAddr(remoteAddress);
        return request;
    }
}
