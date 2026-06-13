package com.example.shop.config;

import com.example.shop.service.RuntimeConfigService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class HttpClientConfig {
    public static final int DEFAULT_CONNECT_TIMEOUT_MS = 5000;
    public static final int DEFAULT_READ_TIMEOUT_MS = 30000;

    private static final int MIN_TIMEOUT_MS = 200;

    @Bean
    public RestTemplate restTemplate(RuntimeConfigService runtimeConfig) {
        int connectTimeoutMs = runtimeConfig.getInt("app.http.connect-timeout-ms", DEFAULT_CONNECT_TIMEOUT_MS);
        int readTimeoutMs = runtimeConfig.getInt("app.http.read-timeout-ms", DEFAULT_READ_TIMEOUT_MS);
        return restTemplateWithTimeouts(connectTimeoutMs, readTimeoutMs);
    }

    public static RestTemplate defaultRestTemplate() {
        return restTemplateWithTimeouts(DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_READ_TIMEOUT_MS);
    }

    public static RestTemplate restTemplateWithTimeouts(int connectTimeoutMs, int readTimeoutMs) {
        return new RestTemplate(requestFactory(connectTimeoutMs, readTimeoutMs));
    }

    public static SimpleClientHttpRequestFactory requestFactory(int connectTimeoutMs, int readTimeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(normalizeTimeout(connectTimeoutMs, DEFAULT_CONNECT_TIMEOUT_MS));
        requestFactory.setReadTimeout(normalizeTimeout(readTimeoutMs, DEFAULT_READ_TIMEOUT_MS));
        return requestFactory;
    }

    public static int normalizeTimeout(int value, int fallback) {
        return value >= MIN_TIMEOUT_MS ? value : fallback;
    }
}
