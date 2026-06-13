package com.example.shop.controller;

import com.example.shop.config.MailAccountProperties;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ConfigCenterService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminSystemControllerTest {
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);

    @Test
    void reportsHealthyWhenDatabaseAndRedisAreAvailable() throws Exception {
        Environment environment = environment();
        DataSource dataSource = dataSource(true);
        StringRedisTemplate redisTemplate = redisTemplate("PONG");
        AdminSystemController controller = controller(environment, dataSource, redisTemplate, true);

        Map<String, Object> status = controller.getStatus(adminAuthentication());

        assertEquals("UP", status.get("status"));
        assertEquals(true, status.get("healthy"));
        assertEquals(true, ((Map<?, ?>) status.get("database")).get("ready"));
        assertEquals(true, ((Map<?, ?>) status.get("redis")).get("ready"));
        assertEquals("DISABLED", ((Map<?, ?>) status.get("nacos")).get("status"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(status);
    }

    @Test
    void readinessReturnsOkWhenRedisIsDisabledAndDatabaseIsAvailable() throws Exception {
        Environment environment = environment();
        AdminSystemController controller = controller(environment, dataSource(true), null, false);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UP", response.getBody().get("status"));
        assertEquals("DISABLED", ((Map<?, ?>) response.getBody().get("redis")).get("status"));
        assertEquals(true, ((Map<?, ?>) response.getBody().get("redis")).get("ready"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(response.getBody());
    }

    @Test
    void readinessReturnsServiceUnavailableWhenDatabaseFails() throws Exception {
        Environment environment = environment();
        DataSource dataSource = mock(DataSource.class);
        when(dataSource.getConnection()).thenThrow(new SQLException("db\nunreachable password=raw-secret token=raw-token"));
        AdminSystemController controller = controller(environment, dataSource, redisTemplate("PONG"), true);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("DEGRADED", response.getBody().get("status"));
        Map<?, ?> database = (Map<?, ?>) response.getBody().get("database");
        assertEquals(false, database.get("ready"));
        assertEquals("DOWN", database.get("status"));
        assertFalse(database.containsKey("error"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(response.getBody());
    }

    @Test
    void readinessReturnsServiceUnavailableWhenRedisIsRequiredButUnavailable() throws Exception {
        Environment environment = environment();
        AdminSystemController controller = controller(environment, dataSource(true), null, true);

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("DEGRADED", response.getBody().get("status"));
        Map<?, ?> redis = (Map<?, ?>) response.getBody().get("redis");
        assertEquals("UNAVAILABLE", redis.get("status"));
        assertEquals(false, redis.get("ready"));
    }

    @Test
    void systemStatusDoesNotExposeNacosInfrastructureDetails() throws Exception {
        Environment environment = environment();
        when(environment.getProperty("spring.cloud.nacos.discovery.enabled", Boolean.class, false)).thenReturn(true);
        when(environment.getProperty("spring.cloud.nacos.config.enabled", Boolean.class, true)).thenReturn(true);
        when(environment.getProperty("spring.cloud.nacos.discovery.server-addr", ""))
                .thenReturn("127.0.0.1:8848?token=raw-nacos-token");
        ConfigCenterHealthResponse health = new ConfigCenterHealthResponse();
        health.setAvailable(false);
        health.setServerStatus("DOWN");
        health.setDataId("shop.properties");
        health.setWarnings(List.of("using token=raw-warning-token"));
        health.setErrors(List.of("password=raw-password; Authorization: Bearer abcdefghijklmnop"));
        ConfigCenterService configCenterService = mock(ConfigCenterService.class);
        when(configCenterService.health(null, null, null)).thenReturn(health);
        AdminSystemController controller = controller(environment, dataSource(true), redisTemplate("PONG"), true, configCenterService);

        Map<String, Object> status = controller.getStatus(adminAuthentication());

        Map<?, ?> nacos = (Map<?, ?>) status.get("nacos");
        assertEquals("DOWN", nacos.get("status"));
        assertFalse(nacos.containsKey("serverAddr"));
        assertFalse(nacos.containsKey("namespace"));
        assertFalse(nacos.containsKey("group"));
        assertFalse(nacos.containsKey("dataId"));
        assertFalse(nacos.containsKey("warnings"));
        assertFalse(nacos.containsKey("errors"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(status);
    }

    @Test
    void productionReadinessReturnsServiceUnavailableWhenProductionConfigIsWeak() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("http://localhost:*");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                new MailAccountProperties(),
                new PaymentChannelConfig()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("DEGRADED", response.getBody().get("status"));
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("BLOCKED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("warnings"));
        assertFalse(productionConfig.containsKey("checks"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(response.getBody());
    }

    @Test
    void productionReadinessAcceptsStrongProductionConfig() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("jwt-secret-1234567890-production-ready");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("callback-secret-1234567890-production");
        when(environment.getProperty("spring.datasource.url", ""))
                .thenReturn("jdbc:mysql://db.internal:3306/shop?useSSL=true&requireSSL=true");
        when(environment.getProperty("spring.datasource.password", "")).thenReturn("strong-db-password-1234567890");
        when(environment.getProperty("spring.redis.host", "")).thenReturn("redis.internal");
        when(environment.getProperty("spring.redis.password", "")).thenReturn("strong-redis-password-1234567890");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("https://shop.example.com,https://admin.example.com");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("logistics.api-url", "")).thenReturn("https://logistics.shop.test/track");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                mailProperties(),
                productionPaymentChannels()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("UP", response.getBody().get("status"));
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("UP", productionConfig.get("status"));
        assertEquals(true, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("warnings"));
        assertFalse(productionConfig.containsKey("checks"));
        assertPublicStatusPayloadDoesNotExposeInfrastructure(response.getBody());
    }

    @Test
    void productionReadinessBlocksConfiguredAdminBootstrapToken() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("jwt-secret-1234567890-production-ready");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("callback-secret-1234567890-production");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("admin.bootstrap-token", "")).thenReturn("temporary-bootstrap-token");
        when(environment.getProperty("logistics.api-url", "")).thenReturn("https://logistics.shop.test/track");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                mailProperties(),
                productionPaymentChannels()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("BLOCKED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("checks"));
    }

    @Test
    void productionReadinessBlocksPaymentSimulationFlags() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("jwt-secret-1234567890-production-ready");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("callback-secret-1234567890-production");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("payment.simulation-enabled", Boolean.class, false)).thenReturn(true);
        when(environment.getProperty("payment.simulation-allow-production", Boolean.class, false)).thenReturn(true);
        when(environment.getProperty("logistics.api-url", "")).thenReturn("https://logistics.shop.test/track");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                mailProperties(),
                productionPaymentChannels()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("BLOCKED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("checks"));
    }

    @Test
    void productionReadinessBlocksPlaceholderMailAccount() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("jwt-secret-1234567890-production-ready");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("callback-secret-1234567890-production");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("logistics.api-url", "")).thenReturn("https://logistics.shop.test/track");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                placeholderMailProperties(),
                productionPaymentChannels()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("BLOCKED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("checks"));
    }

    @Test
    void productionReadinessBlocksPlaceholderLogisticsProvider() throws Exception {
        Environment environment = environment();
        when(environment.getActiveProfiles()).thenReturn(new String[]{"prod"});
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("production");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("jwt-secret-1234567890-production-ready");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("callback-secret-1234567890-production");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("https://shop.example.com");
        when(environment.getProperty("logistics.api-url", "")).thenReturn("https://provider.example/track");
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                mailProperties(),
                productionPaymentChannels()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("BLOCKED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("ready"));
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("checks"));
    }

    @Test
    void nonProductionReadinessSkipsProductionConfigChecks() throws Exception {
        Environment environment = environment();
        AdminSystemController controller = controller(
                environment,
                dataSource(true),
                redisTemplate("PONG"),
                true,
                null,
                new MailAccountProperties(),
                new PaymentChannelConfig()
        );

        ResponseEntity<Map<String, Object>> response = controller.getReadiness(adminAuthentication());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> productionConfig = (Map<?, ?>) response.getBody().get("productionConfig");
        assertEquals("SKIPPED", productionConfig.get("status"));
        assertEquals(false, productionConfig.get("required"));
        assertEquals(true, productionConfig.get("ready"));
    }

    @Test
    void statusRequiresSuperAdminEvenWithSystemStatusPermission() throws Exception {
        AdminSystemController controller = controller(environment(), dataSource(true), redisTemplate("PONG"), true);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> controller.getStatus(nonSuperAdminAuthentication())
        );

        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        assertTrue(error.getReason().contains("Super admin"));
    }

    @Test
    void statusRequiresSystemStatusPermission() throws Exception {
        AdminSystemController controller = controller(environment(), dataSource(true), redisTemplate("PONG"), true);
        when(adminRoleService.hasPermission(1L, AdminRoleService.SYSTEM_STATUS_PERMISSION)).thenReturn(false);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> controller.getStatus(adminAuthentication())
        );

        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
    }

    private void assertPublicStatusPayloadDoesNotExposeInfrastructure(Map<?, ?> status) {
        assertFalse(status.containsKey("application"));
        assertFalse(status.containsKey("runtime"));
        assertFalse(status.containsKey("memory"));
        assertFalse(status.containsKey("disk"));

        Map<?, ?> database = (Map<?, ?>) status.get("database");
        assertFalse(database.containsKey("url"));
        assertFalse(database.containsKey("driver"));
        assertFalse(database.containsKey("error"));
        assertFalse(database.containsKey("latencyMs"));

        Map<?, ?> redis = (Map<?, ?>) status.get("redis");
        assertFalse(redis.containsKey("host"));
        assertFalse(redis.containsKey("port"));
        assertFalse(redis.containsKey("database"));
        assertFalse(redis.containsKey("ping"));
        assertFalse(redis.containsKey("error"));
        assertFalse(redis.containsKey("latencyMs"));

        Map<?, ?> nacos = (Map<?, ?>) status.get("nacos");
        assertFalse(nacos.containsKey("serverAddr"));
        assertFalse(nacos.containsKey("namespace"));
        assertFalse(nacos.containsKey("group"));
        assertFalse(nacos.containsKey("serverStatus"));
        assertFalse(nacos.containsKey("dataId"));
        assertFalse(nacos.containsKey("warnings"));
        assertFalse(nacos.containsKey("errors"));
        assertFalse(nacos.containsKey("error"));
        assertFalse(nacos.containsKey("latencyMs"));

        Map<?, ?> productionConfig = (Map<?, ?>) status.get("productionConfig");
        assertFalse(productionConfig.containsKey("issues"));
        assertFalse(productionConfig.containsKey("warnings"));
        assertFalse(productionConfig.containsKey("checks"));

        String serialized = String.valueOf(status);
        assertFalse(serialized.contains("jdbc:mysql"));
        assertFalse(serialized.contains("127.0.0.1"));
        assertFalse(serialized.contains("db.internal"));
        assertFalse(serialized.contains("redis.internal"));
        assertFalse(serialized.contains("raw-secret"));
        assertFalse(serialized.contains("raw-token"));
    }

    private Environment environment() {
        Environment environment = mock(Environment.class);
        when(environment.getActiveProfiles()).thenReturn(new String[]{"test"});
        when(environment.getProperty("spring.application.name", "shop-backend")).thenReturn("shop-backend");
        when(environment.getProperty("app.runtime-mode", "production")).thenReturn("test");
        when(environment.getProperty("server.port", "8081")).thenReturn("8081");
        when(environment.getProperty("spring.datasource.url", ""))
                .thenReturn("jdbc:mysql://dbuser:dbpass@localhost:3306/shop?password=secret&token=raw-token&useSSL=false");
        when(environment.getProperty("spring.datasource.driver-class-name", "")).thenReturn("com.mysql.cj.jdbc.Driver");
        when(environment.getProperty("app.mail.redis-enabled", Boolean.class, true)).thenReturn(true);
        when(environment.getProperty("spring.redis.host", "")).thenReturn("127.0.0.1");
        when(environment.getProperty("spring.redis.port", "6379")).thenReturn("6379");
        when(environment.getProperty("spring.redis.database", "0")).thenReturn("0");
        when(environment.getProperty("spring.cloud.nacos.discovery.server-addr", "")).thenReturn("127.0.0.1:8848");
        when(environment.getProperty("spring.cloud.nacos.discovery.enabled", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("spring.cloud.nacos.config.enabled", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("spring.cloud.nacos.discovery.register-enabled", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("spring.cloud.nacos.discovery.namespace", "")).thenReturn("");
        when(environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP")).thenReturn("DEFAULT_GROUP");
        when(environment.getProperty("app.jwtSecret", "")).thenReturn("");
        when(environment.getProperty("payment.callback-secret", "")).thenReturn("");
        when(environment.getProperty("admin.bootstrap-token", "")).thenReturn("");
        when(environment.getProperty("app.cors.allowed-origin-patterns", "")).thenReturn("http://localhost:*");
        when(environment.getProperty("app.websocket.allowed-origin-patterns", "")).thenReturn("");
        when(environment.getProperty("stripe.secret-key", "")).thenReturn("");
        when(environment.getProperty("stripe.webhook-secret", "")).thenReturn("");
        when(environment.getProperty("stripe.checkout-success-url", "")).thenReturn("http://localhost:3000/profile?payment=success");
        when(environment.getProperty("stripe.checkout-cancel-url", "")).thenReturn("http://localhost:3000/cart?payment=cancelled");
        when(environment.getProperty("payment.simulation-enabled", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("payment.simulation-allow-production", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("logistics.api-url", "")).thenReturn("");
        when(environment.getProperty("kuaidi100.enabled", Boolean.class, false)).thenReturn(false);
        when(environment.getProperty("kuaidi100.customer", "")).thenReturn("");
        when(environment.getProperty("kuaidi100.key", "")).thenReturn("");
        return environment;
    }

    private MailAccountProperties mailProperties() {
        MailAccountProperties properties = new MailAccountProperties();
        MailAccountProperties.Account account = new MailAccountProperties.Account();
        account.setHost("smtp.mailhost.test");
        account.setPort(465);
        account.setUsername("no-reply@shop.test");
        account.setPassword("mail-password");
        account.setFrom("no-reply@shop.test");
        account.setSsl(true);
        properties.setAccounts(List.of(account));
        return properties;
    }

    private MailAccountProperties placeholderMailProperties() {
        MailAccountProperties properties = new MailAccountProperties();
        MailAccountProperties.Account account = new MailAccountProperties.Account();
        account.setHost("smtp.example.com");
        account.setPort(465);
        account.setUsername("no-reply@example.com");
        account.setPassword("replace-with-mail-app-password");
        account.setFrom("no-reply@example.com");
        account.setSsl(true);
        properties.setAccounts(List.of(account));
        return properties;
    }

    private PaymentChannelConfig productionPaymentChannels() {
        PaymentChannelConfig config = new PaymentChannelConfig();
        PaymentChannelConfig.Channel channel = new PaymentChannelConfig.Channel();
        channel.setCode("MX_LOCAL_CARD");
        channel.setDisplayName("Card");
        channel.setProvider("GENERIC_REDIRECT");
        channel.setRefundMode("MANUAL");
        channel.setCheckoutUrl("https://payments.example.com/checkout");
        channel.setEnabled(true);
        config.setChannels(List.of(channel));
        return config;
    }

    private DataSource dataSource(boolean valid) throws Exception {
        DataSource dataSource = mock(DataSource.class);
        Connection connection = mock(Connection.class);
        when(connection.isValid(2)).thenReturn(valid);
        when(dataSource.getConnection()).thenReturn(connection);
        return dataSource;
    }

    private StringRedisTemplate redisTemplate(String ping) {
        StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);
        RedisConnectionFactory connectionFactory = mock(RedisConnectionFactory.class);
        RedisConnection connection = mock(RedisConnection.class);
        when(redisTemplate.getConnectionFactory()).thenReturn(connectionFactory);
        when(connectionFactory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn(ping);
        return redisTemplate;
    }

    @SuppressWarnings("unchecked")
    private AdminSystemController controller(
            Environment environment,
            DataSource dataSource,
            StringRedisTemplate redisTemplate,
            boolean mailRedisEnabled
    ) {
        return controller(environment, dataSource, redisTemplate, mailRedisEnabled, null, null, null);
    }

    @SuppressWarnings("unchecked")
    private AdminSystemController controller(
            Environment environment,
            DataSource dataSource,
            StringRedisTemplate redisTemplate,
            boolean mailRedisEnabled,
            ConfigCenterService configCenterService
    ) {
        return controller(environment, dataSource, redisTemplate, mailRedisEnabled, configCenterService, null, null);
    }

    @SuppressWarnings("unchecked")
    private AdminSystemController controller(
            Environment environment,
            DataSource dataSource,
            StringRedisTemplate redisTemplate,
            boolean mailRedisEnabled,
            ConfigCenterService configCenterService,
            MailAccountProperties mailProperties,
            PaymentChannelConfig paymentChannelConfig
    ) {
        ObjectProvider<DataSource> dataSources = mock(ObjectProvider.class);
        ObjectProvider<StringRedisTemplate> redisTemplates = mock(ObjectProvider.class);
        ObjectProvider<ConfigCenterService> configCenterServices = mock(ObjectProvider.class);
        ObjectProvider<MailAccountProperties> mailAccountProperties = mock(ObjectProvider.class);
        ObjectProvider<PaymentChannelConfig> paymentChannelConfigs = mock(ObjectProvider.class);
        when(dataSources.getIfAvailable()).thenReturn(dataSource);
        when(redisTemplates.getIfAvailable()).thenReturn(redisTemplate);
        when(configCenterServices.getIfAvailable()).thenReturn(configCenterService);
        when(mailAccountProperties.getIfAvailable()).thenReturn(mailProperties);
        when(paymentChannelConfigs.getIfAvailable()).thenReturn(paymentChannelConfig);
        when(environment.getProperty("app.mail.redis-enabled", Boolean.class, true)).thenReturn(mailRedisEnabled);
        grantSystemStatusPermission();

        return new AdminSystemController(
                environment,
                dataSources,
                redisTemplates,
                configCenterServices,
                mailAccountProperties,
                paymentChannelConfigs,
                adminRoleService
        );
    }

    private void grantSystemStatusPermission() {
        when(adminRoleService.hasPermission(1L, AdminRoleService.SYSTEM_STATUS_PERMISSION)).thenReturn(true);
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(
                        new SimpleGrantedAuthority("ROLE_ADMIN"),
                        new SimpleGrantedAuthority("ROLE_SUPER_ADMIN")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }

    private Authentication nonSuperAdminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
