package com.example.shop.service;

import com.alibaba.nacos.api.config.ConfigService;
import com.alibaba.nacos.api.exception.NacosException;
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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConfigCenterServiceTest {
    private MockEnvironment environment;
    private ConfigService configService;
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
        configService = mock(ConfigService.class);
        service = new TestConfigCenterService(environment, mock(ObjectProvider.class), configService);
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
    void rejectsProtectedSecurityAndOriginKeysEvenWhenAllowedPrefixesAreOverridden() {
        environment.setProperty("admin.config-center.max-properties", "10");
        environment.setProperty("admin.config-center.allowed-key-prefixes",
                "order.,app.jwt,app.cors.,app.websocket.,security.jwt.,security.cors.,security.session.");
        ConfigCenterPublishRequest request = request(
                "app.jwtSecret=rotated-jwt-secret\n"
                        + "app.cors.allowed-origin-patterns=https://evil.example\n"
                        + "app.websocket.allowed-origin-patterns=https://evil.example\n"
                        + "security.jwt.secret=legacy-secret\n"
                        + "security.cors.allowed-origins=https://evil.example\n"
                        + "security.session.timeout-seconds=0\n"
                        + "order.default-shipping-fee=59.00\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertFalse(response.getErrors().isEmpty());
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("app.jwtSecret")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("app.cors.allowed-origin-patterns")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("app.websocket.allowed-origin-patterns")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("security.jwt.secret")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("security.cors.allowed-origins")));
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("security.session.timeout-seconds")));
        assertFalse(response.isRuntimeApplied());
        assertEquals(null, environment.getProperty("order.default-shipping-fee"));
        assertFalse(response.getAllowedKeyPrefixes().contains("app.cors."));
        assertFalse(response.getAllowedKeyPrefixes().contains("app.websocket."));
        assertFalse(response.getAllowedKeyPrefixes().contains("security.jwt."));
        assertTrue(response.getAllowedKeyPrefixes().contains("order."));
    }

    @Test
    void preservesMaskedSensitivePlaceholderFromCurrentNacosContent() throws Exception {
        when(configService.getConfig("shop-backend.properties", "DEFAULT_GROUP", 3000))
                .thenReturn("payment.callback-secret=super-secret-value-1234567890\n"
                        + "order.default-shipping-fee=39.00\n");
        ConfigCenterPublishRequest request = request("payment.callback-secret=su****90\n");
        request.setContent("payment.callback-secret=su****90\norder.default-shipping-fee=49.00\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertTrue(response.getErrors().isEmpty());
        assertTrue(response.isRuntimeApplied());
        assertEquals("super-secret-value-1234567890", environment.getProperty("payment.callback-secret"));
        assertEquals("49.00", environment.getProperty("order.default-shipping-fee"));
        assertFalse(response.getContent().contains("super-secret-value-1234567890"));
        assertTrue(response.getWarnings().stream().anyMatch(warning -> warning.contains("Nacos 原值")));
    }

    @Test
    void rejectsMaskedSensitivePlaceholderWhenOriginalValueCannotBeRead() throws Exception {
        when(configService.getConfig("shop-backend.properties", "DEFAULT_GROUP", 3000)).thenReturn("");
        ConfigCenterPublishRequest request = request("payment.callback-secret=su****90\n");

        ConfigCenterSnapshotResponse response = service.apply(request);

        assertFalse(response.getErrors().isEmpty());
        assertTrue(response.getErrors().stream().anyMatch(error -> error.contains("脱敏占位符")));
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
    void masksBareKeyAndApiKeyNamesInResponses() {
        ConfigCenterSnapshotResponse response = service.apply(request(
                "kuaidi100.key=raw-kuaidi-key\n"
                        + "logistics.api-key=raw-logistics-key\n"
                        + "order.default-shipping-fee=39.00\n"));

        assertTrue(response.getErrors().isEmpty());
        assertFalse(response.getContent().contains("raw-kuaidi-key"));
        assertFalse(response.getContent().contains("raw-logistics-key"));
        assertFalse(response.getProperties().get("kuaidi100.key").contains("raw-kuaidi-key"));
        assertFalse(response.getProperties().get("logistics.api-key").contains("raw-logistics-key"));
        assertTrue(response.getSensitiveKeys().contains("kuaidi100.key"));
        assertTrue(response.getSensitiveKeys().contains("logistics.api-key"));
    }

    @Test
    void snapshotMasksJwtSmtpAndSmsCredentialsInAllResponseSurfaces() throws Exception {
        environment.setProperty("admin.config-center.max-properties", "10");
        environment.setProperty("app.jwtSecret", "jwt-secret-current-value-1234567890");
        environment.setProperty("app.mail.accounts[0].password", "smtp-password-current-value");
        environment.setProperty("sms.provider.api-key", "sms-api-key-current-value");
        when(configService.getConfig("shop-backend.properties", "DEFAULT_GROUP", 3000))
                .thenReturn("app.jwtSecret=jwt-secret-nacos-value-1234567890\n"
                        + "app.mail.accounts[0].password=smtp-password-nacos-value\n"
                        + "sms.provider.api-key=sms-api-key-nacos-value\n"
                        + "sms.provider.secret=sms-secret-nacos-value\n");

        ConfigCenterSnapshotResponse response = service.snapshot(null, null, null);

        assertFalse(response.getContent().contains("jwt-secret-nacos-value-1234567890"));
        assertFalse(response.getContent().contains("smtp-password-nacos-value"));
        assertFalse(response.getContent().contains("sms-api-key-nacos-value"));
        assertFalse(response.getContent().contains("sms-secret-nacos-value"));
        assertFalse(response.getProperties().get("app.jwtSecret").contains("jwt-secret-nacos-value-1234567890"));
        assertFalse(response.getProperties().get("app.mail.accounts[0].password").contains("smtp-password-nacos-value"));
        assertFalse(response.getProperties().get("sms.provider.api-key").contains("sms-api-key-nacos-value"));
        assertFalse(response.getProperties().get("sms.provider.secret").contains("sms-secret-nacos-value"));
        assertFalse(response.getEffectiveProperties().get("app.jwtSecret").contains("jwt-secret-current-value-1234567890"));
        assertFalse(response.getEffectiveProperties().get("app.mail.accounts[0].password").contains("smtp-password-current-value"));
        assertFalse(response.getEffectiveProperties().get("sms.provider.api-key").contains("sms-api-key-current-value"));
        assertTrue(response.getSensitiveKeys().contains("app.jwtSecret"));
        assertTrue(response.getSensitiveKeys().contains("app.mail.accounts[0].password"));
        assertTrue(response.getSensitiveKeys().contains("sms.provider.api-key"));
        assertTrue(response.getSensitiveKeys().contains("sms.provider.secret"));
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

    @Test
    void cachesNacosConfigServiceByConnectionKey() throws Exception {
        CountingConfigCenterService countingService = new CountingConfigCenterService(environment, mock(ObjectProvider.class));

        ConfigService defaultService = countingService.configService("");
        ConfigService defaultServiceAgain = countingService.configService(null);
        ConfigService isolatedNamespaceService = countingService.configService("isolated");

        assertSame(defaultService, defaultServiceAgain);
        assertEquals(2, countingService.createdCount);
        assertFalse(defaultService == isolatedNamespaceService);
    }

    private ConfigCenterPublishRequest request(String content) {
        ConfigCenterPublishRequest request = new ConfigCenterPublishRequest();
        request.setDataId("shop-backend.properties");
        request.setGroup("DEFAULT_GROUP");
        request.setContent(content);
        request.setApplyRuntime(true);
        return request;
    }

    private static class TestConfigCenterService extends ConfigCenterService {
        private final ConfigService configService;

        TestConfigCenterService(
                MockEnvironment environment,
                ObjectProvider<ConfigurationPropertiesRebinder> rebinderProvider,
                ConfigService configService
        ) {
            super(environment, rebinderProvider);
            this.configService = configService;
        }

        @Override
        protected ConfigService configService(String namespace) throws NacosException {
            return configService;
        }
    }

    private static class CountingConfigCenterService extends ConfigCenterService {
        private int createdCount;

        CountingConfigCenterService(
                MockEnvironment environment,
                ObjectProvider<ConfigurationPropertiesRebinder> rebinderProvider
        ) {
            super(environment, rebinderProvider);
        }

        @Override
        protected ConfigService createConfigService(NacosConfigServiceKey key) {
            createdCount++;
            return mock(ConfigService.class);
        }
    }
}
