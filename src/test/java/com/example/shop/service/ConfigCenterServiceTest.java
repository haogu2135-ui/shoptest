package com.example.shop.service;

import com.example.shop.dto.ConfigCenterPublishRequest;
import com.example.shop.dto.ConfigCenterSnapshotResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.context.properties.ConfigurationPropertiesRebinder;
import org.springframework.mock.env.MockEnvironment;

import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class ConfigCenterServiceTest {
    private MockEnvironment environment;
    private ConfigCenterService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        environment = new MockEnvironment();
        environment.setProperty("spring.application.name", "shop-backend");
        environment.setProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP");
        environment.setProperty("spring.cloud.nacos.discovery.server-addr", "127.0.0.1:8848");
        environment.setProperty("admin.config-center.max-content-bytes", "2048");
        environment.setProperty("admin.config-center.max-properties", "3");
        service = new ConfigCenterService(environment, mock(ObjectProvider.class));
    }

    @Test
    void applyAllowedRuntimePropertiesAndMasksSensitiveValuesInResponse() {
        ConfigCenterPublishRequest request = request(
                "order.default-shipping-fee=49.00\n"
                        + "announcement.active-max-rows=8\n"
                        + "payment.callback-secret=super-secret-value-1234567890\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertTrue(response.getErrors().isEmpty());
        assertTrue(response.isRuntimeApplied());
        assertEquals("49.00", environment.getProperty("order.default-shipping-fee"));
        assertEquals("8", environment.getProperty("announcement.active-max-rows"));
        assertEquals("super-secret-value-1234567890", environment.getProperty("payment.callback-secret"));
        assertFalse(response.getContent().contains("super-secret-value-1234567890"));
        assertFalse(response.getProperties().get("payment.callback-secret").contains("super-secret-value-1234567890"));
        assertTrue(response.getSensitiveKeys().contains("payment.callback-secret"));
        assertTrue(response.getAllowedKeyPrefixes().contains("order."));
        assertTrue(response.getAllowedKeyPrefixes().contains("announcement."));
        assertTrue(response.getAllowedKeyPrefixes().contains("admin.announcements."));
        assertEquals(2048, response.getMaxContentBytes());
        assertEquals(3, response.getMaxProperties());
    }

    @Test
    void rejectsBlockedInfrastructureKeysBeforeRuntimeApply() {
        ConfigCenterPublishRequest request = request(
                "spring.datasource.password=secret\n"
                        + "order.default-shipping-fee=59.00\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertFalse(response.getErrors().isEmpty());
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("spring.datasource.password")));
        assertFalse(response.isRuntimeApplied());
        assertEquals(null, environment.getProperty("order.default-shipping-fee"));
        assertFalse(response.getContent().contains("secret"));
    }

    @Test
    void rejectsMaskedSensitivePlaceholderOnPublishOrApply() {
        ConfigCenterPublishRequest request = request("payment.callback-secret=su****90\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertFalse(response.getErrors().isEmpty());
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("masked placeholder")));
        assertFalse(response.isRuntimeApplied());
    }

    @Test
    void masksNacosServerAddressCredentialsInResponses() {
        environment.setProperty("spring.cloud.nacos.discovery.server-addr",
                "127.0.0.1:8848?token=raw-nacos-token&password=raw-nacos-password");

        ConfigCenterSnapshotResponse response = service.apply(request("order.default-shipping-fee=39.00\n"));

        assertEquals("127.0.0.1:8848?token=******&password=******", response.getNacosServerAddr());
        assertFalse(response.getNacosServerAddr().contains("raw-nacos-token"));
        assertFalse(response.getNacosServerAddr().contains("raw-nacos-password"));
    }

    @Test
    void rejectsOversizedContentAndTooManyProperties() {
        String content = IntStream.range(0, 4)
                .mapToObj(index -> "order.test-" + index + "=" + "x".repeat(700))
                .collect(Collectors.joining("\n"));

        ConfigCenterSnapshotResponse response = service.apply(request(content));

        assertFalse(response.getErrors().isEmpty());
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("too large")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("Too many config properties")));
        assertFalse(response.isRuntimeApplied());
    }

    @Test
    void startupApplyRejectsMaskedSensitivePlaceholder() {
        service.applyNacosRuntimeContentOnStartup("payment.callback-secret=su****90\norder.default-shipping-fee=39.00\n");

        assertEquals(null, environment.getProperty("payment.callback-secret"));
        assertEquals(null, environment.getProperty("order.default-shipping-fee"));
    }

    @Test
    void startupApplyRejectsOversizedConfigContent() {
        environment.setProperty("admin.config-center.max-content-bytes", "1024");
        String content = "order.default-shipping-fee=" + "x".repeat(1200);

        service.applyNacosRuntimeContentOnStartup(content);

        assertEquals(null, environment.getProperty("order.default-shipping-fee"));
    }

    private ConfigCenterPublishRequest request(String content) {
        ConfigCenterPublishRequest request = new ConfigCenterPublishRequest();
        request.setDataId("shop-backend.properties");
        request.setGroup("DEFAULT_GROUP");
        request.setContent(content);
        request.setApplyRuntime(true);
        return request;
    }
}
