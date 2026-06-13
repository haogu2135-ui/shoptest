package com.example.shop.controller;

import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.config.MailAccountProperties;
import com.example.shop.config.PaymentChannelConfig;
import com.example.shop.security.SecurityUtils;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.ConfigCenterService;
import com.example.shop.util.GatewayUrlValidator;
import com.example.shop.util.SensitiveDataMasker;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.net.URI;
import java.net.URISyntaxException;
import java.sql.Connection;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin/system")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSystemController {

    private final Environment environment;
    private final ObjectProvider<DataSource> dataSources;
    private final ObjectProvider<StringRedisTemplate> redisTemplates;
    private final ObjectProvider<ConfigCenterService> configCenterServices;
    private final ObjectProvider<MailAccountProperties> mailAccountProperties;
    private final ObjectProvider<PaymentChannelConfig> paymentChannelConfigs;
    private final AdminRoleService adminRoleService;

    public AdminSystemController(
            Environment environment,
            ObjectProvider<DataSource> dataSources,
            ObjectProvider<StringRedisTemplate> redisTemplates,
            ObjectProvider<ConfigCenterService> configCenterServices,
            ObjectProvider<MailAccountProperties> mailAccountProperties,
            ObjectProvider<PaymentChannelConfig> paymentChannelConfigs,
            AdminRoleService adminRoleService
    ) {
        this.environment = environment;
        this.dataSources = dataSources;
        this.redisTemplates = redisTemplates;
        this.configCenterServices = configCenterServices;
        this.mailAccountProperties = mailAccountProperties;
        this.paymentChannelConfigs = paymentChannelConfigs;
        this.adminRoleService = adminRoleService;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus(Authentication authentication) {
        requireSuperAdminSystemStatusPermission(authentication);
        return publicStatusPayload(buildStatus());
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> getReadiness(Authentication authentication) {
        requireSuperAdminSystemStatusPermission(authentication);
        Map<String, Object> payload = publicStatusPayload(buildStatus());
        boolean ready = Boolean.TRUE.equals(payload.get("ready"));
        return ResponseEntity
                .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(payload);
    }

    private void requireSuperAdminSystemStatusPermission(Authentication authentication) {
        UserDetailsImpl user = SecurityUtils.requireUser(authentication);
        if (!SecurityUtils.isSuperAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Super admin permission required");
        }
        if (adminRoleService.hasPermission(user.getId(), AdminRoleService.SYSTEM_STATUS_PERMISSION)) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing admin action permission");
    }

    private Map<String, Object> publicStatusPayload(Map<String, Object> detailed) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", detailed.get("status"));
        payload.put("healthy", detailed.get("healthy"));
        payload.put("ready", detailed.get("ready"));
        payload.put("checkedAt", detailed.get("checkedAt"));
        payload.put("database", componentHealth(detailed.get("database")));
        payload.put("redis", componentHealth(detailed.get("redis")));
        payload.put("nacos", componentHealth(detailed.get("nacos")));
        payload.put("productionConfig", componentHealth(detailed.get("productionConfig")));
        return payload;
    }

    private Map<String, Object> componentHealth(Object component) {
        Map<String, Object> source = component instanceof Map ? (Map<String, Object>) component : Collections.emptyMap();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", source.getOrDefault("status", "UNKNOWN"));
        payload.put("healthy", source.getOrDefault("healthy", false));
        payload.put("ready", source.getOrDefault("ready", false));
        if (source.containsKey("required")) {
            payload.put("required", source.get("required"));
        }
        if (source.containsKey("checkedAt")) {
            payload.put("checkedAt", source.get("checkedAt"));
        }
        return payload;
    }

    private Map<String, Object> buildStatus() {
        Runtime runtime = Runtime.getRuntime();
        RuntimeMXBean runtimeBean = ManagementFactory.getRuntimeMXBean();
        File root = new File(".").getAbsoluteFile();
        Map<String, Object> database = databasePayload();
        Map<String, Object> redis = redisPayload();
        Map<String, Object> nacos = nacosPayload();
        Map<String, Object> productionConfig = productionConfigPayload();
        boolean ready = Boolean.TRUE.equals(database.get("ready"))
                && Boolean.TRUE.equals(redis.get("ready"))
                && Boolean.TRUE.equals(productionConfig.get("ready"));
        boolean optionalHealthy = Boolean.TRUE.equals(nacos.get("ready"));
        boolean healthy = ready && optionalHealthy;

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", healthy ? "UP" : "DEGRADED");
        payload.put("healthy", healthy);
        payload.put("ready", ready);
        payload.put("checkedAt", Instant.now().toString());
        payload.put("application", applicationPayload());
        payload.put("runtime", runtimePayload(runtime, runtimeBean));
        payload.put("memory", memoryPayload(runtime));
        payload.put("disk", diskPayload(root));
        payload.put("database", database);
        payload.put("redis", redis);
        payload.put("nacos", nacos);
        payload.put("productionConfig", productionConfig);
        return payload;
    }

    private Map<String, Object> applicationPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", property("spring.application.name", "shop-backend"));
        payload.put("runtimeMode", property("app.runtime-mode", "production"));
        payload.put("serverPort", property("server.port", "8081"));
        payload.put("profiles", Arrays.asList(environment.getActiveProfiles()));
        payload.put("time", Instant.now().toString());
        return payload;
    }

    private Map<String, Object> runtimePayload(Runtime runtime, RuntimeMXBean runtimeBean) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("javaVersion", System.getProperty("java.version"));
        payload.put("javaVendor", System.getProperty("java.vendor"));
        payload.put("osName", System.getProperty("os.name"));
        payload.put("osVersion", System.getProperty("os.version"));
        payload.put("processors", runtime.availableProcessors());
        payload.put("uptimeMs", runtimeBean.getUptime());
        payload.put("startTimeMs", runtimeBean.getStartTime());
        return payload;
    }

    private Map<String, Object> memoryPayload(Runtime runtime) {
        long max = runtime.maxMemory();
        long total = runtime.totalMemory();
        long free = runtime.freeMemory();
        long used = total - free;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("maxBytes", max);
        payload.put("totalBytes", total);
        payload.put("freeBytes", free);
        payload.put("usedBytes", used);
        payload.put("usedPercent", max <= 0 ? 0 : Math.round((used * 10000.0) / max) / 100.0);
        return payload;
    }

    private Map<String, Object> diskPayload(File root) {
        long total = root.getTotalSpace();
        long free = root.getFreeSpace();
        long used = total - free;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("path", root.getPath());
        payload.put("totalBytes", total);
        payload.put("freeBytes", free);
        payload.put("usedBytes", used);
        payload.put("usedPercent", total <= 0 ? 0 : Math.round((used * 10000.0) / total) / 100.0);
        return payload;
    }

    private Map<String, Object> databasePayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        long startedAt = System.nanoTime();
        payload.put("url", maskDatasourceUrl(property("spring.datasource.url", "")));
        payload.put("driver", environment.getProperty("spring.datasource.driver-class-name", ""));
        payload.put("required", true);
        payload.put("checkedAt", Instant.now().toString());

        DataSource dataSource = dataSources.getIfAvailable();
        if (dataSource == null) {
            payload.put("status", "UNAVAILABLE");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", "DataSource bean is unavailable");
            return payload;
        }

        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            payload.put("status", valid ? "UP" : "DOWN");
            payload.put("healthy", valid);
            payload.put("ready", valid);
            if (!valid) {
                payload.put("error", "Database connection validation returned false");
            }
        } catch (Exception e) {
            payload.put("status", "DOWN");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", sanitizeError(e));
        } finally {
            payload.put("latencyMs", elapsedMillis(startedAt));
        }
        return payload;
    }

    private Map<String, Object> redisPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        long startedAt = System.nanoTime();
        boolean mailRedisEnabled = environment.getProperty("app.mail.redis-enabled", Boolean.class, true);
        payload.put("host", property("spring.redis.host", ""));
        payload.put("port", property("spring.redis.port", "6379"));
        payload.put("database", property("spring.redis.database", "0"));
        payload.put("required", mailRedisEnabled);
        payload.put("checkedAt", Instant.now().toString());

        if (!mailRedisEnabled) {
            payload.put("status", "DISABLED");
            payload.put("healthy", false);
            payload.put("ready", true);
            payload.put("latencyMs", 0L);
            return payload;
        }

        StringRedisTemplate redisTemplate = redisTemplates.getIfAvailable();
        if (redisTemplate == null) {
            payload.put("status", "UNAVAILABLE");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", "StringRedisTemplate bean is unavailable");
            payload.put("latencyMs", elapsedMillis(startedAt));
            return payload;
        }

        RedisConnectionFactory connectionFactory = redisTemplate.getConnectionFactory();
        if (connectionFactory == null) {
            payload.put("status", "UNAVAILABLE");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", "RedisConnectionFactory is unavailable");
            payload.put("latencyMs", elapsedMillis(startedAt));
            return payload;
        }

        RedisConnection connection = null;
        try {
            connection = connectionFactory.getConnection();
            String pong = connection.ping();
            boolean healthy = pong != null && !pong.isBlank();
            payload.put("status", healthy ? "UP" : "DOWN");
            payload.put("healthy", healthy);
            payload.put("ready", healthy);
            payload.put("ping", healthy ? pong : "");
            if (!healthy) {
                payload.put("error", "Redis PING returned an empty response");
            }
        } catch (Exception e) {
            payload.put("status", "DOWN");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", sanitizeError(e));
        } finally {
            if (connection != null) {
                connection.close();
            }
            payload.put("latencyMs", elapsedMillis(startedAt));
        }
        return payload;
    }

    private Map<String, Object> nacosPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        long startedAt = System.nanoTime();
        boolean discoveryEnabled = environment.getProperty("spring.cloud.nacos.discovery.enabled", Boolean.class, false);
        boolean configEnabled = environment.getProperty("spring.cloud.nacos.config.enabled", Boolean.class, discoveryEnabled);
        payload.put("serverAddr", sanitizeText(property("spring.cloud.nacos.discovery.server-addr", ""), 240));
        payload.put("configEnabled", configEnabled);
        payload.put("discoveryEnabled", discoveryEnabled);
        payload.put("registerEnabled", environment.getProperty("spring.cloud.nacos.discovery.register-enabled", Boolean.class, false));
        payload.put("namespace", environment.getProperty("spring.cloud.nacos.discovery.namespace", ""));
        payload.put("group", environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP"));
        payload.put("checkedAt", Instant.now().toString());
        if (!discoveryEnabled && !configEnabled) {
            payload.put("status", "DISABLED");
            payload.put("healthy", false);
            payload.put("ready", true);
            payload.put("latencyMs", 0L);
            return payload;
        }
        ConfigCenterService configCenterService = configCenterServices.getIfAvailable();
        if (configCenterService == null) {
            payload.put("status", "UNAVAILABLE");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", "ConfigCenterService bean is unavailable");
            payload.put("latencyMs", elapsedMillis(startedAt));
            return payload;
        }
        try {
            ConfigCenterHealthResponse health = configCenterService.health(null, null, null);
            payload.put("status", health.isAvailable() ? "UP" : "DOWN");
            payload.put("healthy", health.isAvailable());
            payload.put("ready", health.isAvailable());
            payload.put("serverStatus", health.getServerStatus());
            payload.put("dataId", health.getDataId());
            payload.put("warnings", sanitizeMessages(health.getWarnings()));
            payload.put("errors", sanitizeMessages(health.getErrors()));
        } catch (Exception e) {
            payload.put("status", "DOWN");
            payload.put("healthy", false);
            payload.put("ready", false);
            payload.put("error", sanitizeError(e));
        } finally {
            payload.put("latencyMs", elapsedMillis(startedAt));
        }
        return payload;
    }

    private Map<String, Object> productionConfigPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        String runtimeMode = property("app.runtime-mode", "production");
        boolean productionMode = isProductionMode(runtimeMode);
        payload.put("runtimeMode", runtimeMode);
        payload.put("required", productionMode);
        payload.put("checkedAt", Instant.now().toString());

        if (!productionMode) {
            payload.put("status", "SKIPPED");
            payload.put("healthy", true);
            payload.put("ready", true);
            payload.put("issues", Collections.emptyList());
            payload.put("warnings", Collections.emptyList());
            return payload;
        }

        List<String> issues = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<String, Object> checks = new LinkedHashMap<>();

        addSecretCheck(checks, issues, "jwtSecret", "app.jwtSecret",
                property("app.jwtSecret", ""), List.of("your-secret-key", "your-secret-key-here"));
        addSecretCheck(checks, issues, "paymentCallbackSecret", "payment.callback-secret",
                property("payment.callback-secret", ""), List.of("dev-payment-secret"));
        checks.put("datastores", datastoreConfigCheck(issues, warnings));
        checks.put("mail", mailConfigCheck(issues));
        checks.put("cors", corsConfigCheck(issues));
        checks.put("adminBootstrap", adminBootstrapCheck(issues));
        checks.put("paymentSimulation", paymentSimulationCheck(issues));
        checks.put("paymentChannels", paymentChannelsCheck(issues, warnings));
        checks.put("logistics", logisticsConfigCheck(issues, warnings));

        boolean ready = issues.isEmpty();
        payload.put("status", ready ? "UP" : "BLOCKED");
        payload.put("healthy", ready);
        payload.put("ready", ready);
        payload.put("checks", checks);
        payload.put("issues", issues);
        payload.put("warnings", warnings);
        return payload;
    }

    private void addSecretCheck(Map<String, Object> checks,
                                List<String> issues,
                                String checkName,
                                String propertyName,
                                String value,
                                List<String> extraPlaceholders) {
        boolean strong = isStrongProductionSecret(value, extraPlaceholders);
        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", strong ? "PASS" : "FAIL");
        check.put("configured", hasText(value));
        check.put("minLength", 32);
        checks.put(checkName, check);
        if (!strong) {
            issues.add(propertyName + " must be set to a non-placeholder value with at least 32 characters");
        }
    }

    private Map<String, Object> datastoreConfigCheck(List<String> issues, List<String> warnings) {
        String dbUrl = property("spring.datasource.url", "");
        String dbPassword = property("spring.datasource.password", "");
        String redisHost = property("spring.redis.host", "");
        String redisPassword = property("spring.redis.password", "");

        boolean dbUrlConfigured = hasText(dbUrl);
        boolean dbPasswordSafe = isStrongRuntimePassword(dbPassword, List.of("shop_password", "root", "password"));
        boolean redisHostConfigured = hasText(redisHost);
        boolean redisPasswordSafe = isStrongRuntimePassword(redisPassword, List.of("shop_redis_password", "redis", "password"));
        boolean jdbcTlsSafe = isProductionJdbcTlsSafe(dbUrl);
        boolean jdbcKeyRetrievalSafe = !containsJdbcFlag(dbUrl, "allowPublicKeyRetrieval", "true");

        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", dbUrlConfigured && dbPasswordSafe && redisHostConfigured && redisPasswordSafe && jdbcTlsSafe && jdbcKeyRetrievalSafe ? "PASS" : "FAIL");
        check.put("dbUrlConfigured", dbUrlConfigured);
        check.put("dbPasswordConfigured", hasText(dbPassword));
        check.put("redisHostConfigured", redisHostConfigured);
        check.put("redisPasswordConfigured", hasText(redisPassword));
        check.put("jdbcTlsSafe", jdbcTlsSafe);
        check.put("jdbcAllowPublicKeyRetrieval", containsJdbcFlag(dbUrl, "allowPublicKeyRetrieval", "true"));

        if (!dbUrlConfigured) {
            issues.add("spring.datasource.url must be configured for production");
        }
        if (!dbPasswordSafe) {
            issues.add("spring.datasource.password must be a non-default production password");
        }
        if (!redisHostConfigured) {
            issues.add("spring.redis.host must be configured for production");
        }
        if (!redisPasswordSafe) {
            issues.add("spring.redis.password must be a non-default production password");
        }
        if (!jdbcTlsSafe) {
            issues.add("spring.datasource.url must not disable TLS for production database connections");
        }
        if (!jdbcKeyRetrievalSafe) {
            issues.add("spring.datasource.url must not enable allowPublicKeyRetrieval in production");
        }
        if (hasText(dbUrl) && dbUrl.toLowerCase(Locale.ROOT).contains("jdbc:mysql://")) {
            warnings.add("Verify the production MySQL account uses least privilege and network access is restricted to backend hosts");
        }
        return check;
    }

    private Map<String, Object> mailConfigCheck(List<String> issues) {
        MailAccountProperties properties = mailAccountProperties.getIfAvailable();
        int configuredAccounts = 0;
        if (properties != null && properties.getAccounts() != null) {
            configuredAccounts = (int) properties.getAccounts().stream()
                    .filter(this::isConfiguredMailAccount)
                    .count();
        }
        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", configuredAccounts > 0 ? "PASS" : "FAIL");
        check.put("configuredAccountCount", configuredAccounts);
        if (configuredAccounts == 0) {
            issues.add("app.mail.accounts must include at least one complete SMTP account");
        }
        return check;
    }

    private Map<String, Object> corsConfigCheck(List<String> issues) {
        String corsRaw = property("app.cors.allowed-origin-patterns", "");
        String websocketRaw = property("app.websocket.allowed-origin-patterns", "");
        String websocketEffectiveRaw = hasText(websocketRaw) ? websocketRaw : corsRaw;
        List<String> corsPatterns = splitPatterns(corsRaw);
        List<String> websocketPatterns = splitPatterns(websocketEffectiveRaw);
        List<String> unsafeCors = unsafeProductionOrigins(corsPatterns);
        List<String> unsafeWebsocket = unsafeProductionOrigins(websocketPatterns);

        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", unsafeCors.isEmpty() && unsafeWebsocket.isEmpty() && !corsPatterns.isEmpty() && !websocketPatterns.isEmpty() ? "PASS" : "FAIL");
        check.put("corsOriginCount", corsPatterns.size());
        check.put("websocketOriginCount", websocketPatterns.size());
        check.put("websocketOriginSource", hasText(websocketRaw) ? "explicit" : "corsFallback");

        if (corsPatterns.isEmpty()) {
            issues.add("app.cors.allowed-origin-patterns must list deployed HTTPS storefront and admin origins");
        }
        if (websocketPatterns.isEmpty()) {
            issues.add("app.websocket.allowed-origin-patterns must list deployed HTTPS storefront and admin origins or inherit them from CORS");
        }
        if (!unsafeCors.isEmpty()) {
            issues.add("app.cors.allowed-origin-patterns contains local, private, wildcard, or non-HTTPS origins");
        }
        if (!unsafeWebsocket.isEmpty()) {
            issues.add("app.websocket.allowed-origin-patterns contains local, private, wildcard, or non-HTTPS origins");
        }
        return check;
    }

    private Map<String, Object> paymentSimulationCheck(List<String> issues) {
        boolean simulationEnabled = environment.getProperty("payment.simulation-enabled", Boolean.class, false);
        boolean simulationAllowProduction = environment.getProperty("payment.simulation-allow-production", Boolean.class, false);
        boolean safe = !simulationEnabled && !simulationAllowProduction;

        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", safe ? "PASS" : "FAIL");
        check.put("simulationEnabled", simulationEnabled);
        check.put("simulationAllowProduction", simulationAllowProduction);

        if (!safe) {
            issues.add("payment simulation must be disabled in production");
        }
        return check;
    }

    private Map<String, Object> adminBootstrapCheck(List<String> issues) {
        String bootstrapToken = property("admin.bootstrap-token", "");
        boolean configured = hasText(bootstrapToken);

        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", configured ? "FAIL" : "PASS");
        check.put("configured", configured);

        if (configured) {
            issues.add("admin.bootstrap-token must be blank in production after admin bootstrap");
        }
        return check;
    }

    private Map<String, Object> paymentChannelsCheck(List<String> issues, List<String> warnings) {
        PaymentChannelConfig channelConfig = paymentChannelConfigs.getIfAvailable();
        Map<String, Object> check = new LinkedHashMap<>();
        if (channelConfig == null) {
            check.put("status", "FAIL");
            check.put("enabledChannelCount", 0);
            check.put("availableCheckoutChannelCount", 0);
            issues.add("payment channel configuration is unavailable");
            return check;
        }
        if (channelConfig.getChannels() == null || channelConfig.getChannels().isEmpty()) {
            check.put("status", "FAIL");
            check.put("enabledChannelCount", 0);
            check.put("availableCheckoutChannelCount", 0);
            issues.add("at least one payment channel must be explicitly configured for production checkout");
            return check;
        }

        List<PaymentChannelConfig.Channel> enabledChannels = channelConfig.enabledChannels();
        int availableChannels = 0;
        for (PaymentChannelConfig.Channel channel : enabledChannels) {
            if (isProductionCheckoutChannelAvailable(channelConfig, channel, issues, warnings)) {
                availableChannels++;
            }
        }

        check.put("status", availableChannels > 0 ? "PASS" : "FAIL");
        check.put("enabledChannelCount", enabledChannels.size());
        check.put("availableCheckoutChannelCount", availableChannels);
        if (availableChannels == 0) {
            issues.add("at least one enabled payment channel must be configured for production checkout");
        }
        return check;
    }

    private Map<String, Object> logisticsConfigCheck(List<String> issues, List<String> warnings) {
        String providerUrl = property("logistics.api-url", "");
        boolean providerConfigured = isPublicHttpsUrl(providerUrl) && !isPlaceholderLogisticsValue(providerUrl);
        boolean providerPresentButUnsafe = hasText(providerUrl) && !providerConfigured;
        boolean kuaidi100Enabled = environment.getProperty("kuaidi100.enabled", Boolean.class, false);
        String kuaidi100Customer = property("kuaidi100.customer", "");
        String kuaidi100Key = property("kuaidi100.key", "");
        boolean kuaidi100Configured = kuaidi100Enabled
                && hasText(kuaidi100Customer)
                && hasText(kuaidi100Key)
                && !isPlaceholderLogisticsValue(kuaidi100Customer)
                && !isPlaceholderLogisticsValue(kuaidi100Key);
        boolean ready = providerConfigured || kuaidi100Configured;

        Map<String, Object> check = new LinkedHashMap<>();
        check.put("status", ready ? "PASS" : "FAIL");
        check.put("providerConfigured", providerConfigured);
        check.put("kuaidi100Enabled", kuaidi100Enabled);
        check.put("kuaidi100Configured", kuaidi100Configured);

        if (providerPresentButUnsafe) {
            warnings.add("logistics.api-url is configured but is not a production public HTTPS URL");
        }
        if (!ready) {
            issues.add("production logistics tracking must configure logistics.api-url or Kuaidi100 credentials");
        }
        return check;
    }

    private boolean isProductionCheckoutChannelAvailable(PaymentChannelConfig channelConfig,
                                                         PaymentChannelConfig.Channel channel,
                                                         List<String> issues,
                                                         List<String> warnings) {
        if (channel == null || !channel.isEnabled()) {
            return false;
        }
        if (channel.isStripeProvider()) {
            String secretKey = property("stripe.secret-key", "");
            String webhookSecret = property("stripe.webhook-secret", "");
            boolean configured = hasText(secretKey) && hasText(webhookSecret);
            if (hasText(secretKey) && !secretKey.trim().startsWith("sk_live_")) {
                warnings.add("stripe.secret-key is configured but does not look like a live key");
            }
            if (hasText(webhookSecret) && !webhookSecret.trim().startsWith("whsec_")) {
                warnings.add("stripe.webhook-secret is configured but does not look like a Stripe webhook secret");
            }
            if (!configured) {
                return false;
            }
            boolean safeSuccessUrl = isPublicHttpsUrl(property("stripe.checkout-success-url", ""));
            boolean safeCancelUrl = isPublicHttpsUrl(property("stripe.checkout-cancel-url", ""));
            if (!safeSuccessUrl || !safeCancelUrl) {
                issues.add("Stripe checkout success and cancel URLs must use deployed HTTPS origins");
                return false;
            }
            return true;
        }
        if (channel.isGenericApiProvider()) {
            String createUrl = channel.getCreateUrl();
            if (!isPublicHttpsUrl(createUrl)) {
                return false;
            }
            if ("GENERIC_API".equals(channel.getRefundMode()) && !isPublicHttpsUrl(channel.getRefundUrl())) {
                issues.add("generic API payment channels using API refunds must include a production HTTPS refund URL");
                return false;
            }
            return true;
        }
        String checkoutUrl = firstNonBlank(channel.getCheckoutUrl(), channelConfig.getCheckoutBaseUrl());
        return isPublicHttpsUrl(checkoutUrl) && !checkoutUrl.contains("pay.example.local");
    }

    private boolean isStrongProductionSecret(String value, List<String> extraPlaceholders) {
        if (!hasText(value)) {
            return false;
        }
        String normalized = value.trim();
        if (normalized.length() < 32) {
            return false;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        List<String> placeholders = new ArrayList<>(List.of(
                "secret",
                "password",
                "changeme",
                "change-me",
                "test-secret",
                "jwt-secret",
                "default-secret"
        ));
        placeholders.addAll(extraPlaceholders.stream()
                .map((item) -> item == null ? "" : item.toLowerCase(Locale.ROOT))
                .collect(Collectors.toList()));
        return placeholders.stream().noneMatch(lower::equals);
    }

    private boolean isStrongRuntimePassword(String value, List<String> extraPlaceholders) {
        if (!hasText(value)) {
            return false;
        }
        String normalized = value.trim();
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (normalized.length() < 12) {
            return false;
        }
        List<String> placeholders = new ArrayList<>(List.of(
                "password",
                "changeme",
                "change-me",
                "replace-me",
                "secret"
        ));
        placeholders.addAll(extraPlaceholders.stream()
                .map((item) -> item == null ? "" : item.toLowerCase(Locale.ROOT))
                .collect(Collectors.toList()));
        return placeholders.stream().noneMatch(lower::equals)
                && !lower.startsWith("replace-")
                && !lower.contains("replace-with")
                && !lower.contains("your-");
    }

    private boolean isProductionJdbcTlsSafe(String jdbcUrl) {
        if (!hasText(jdbcUrl)) {
            return false;
        }
        String normalized = jdbcUrl.toLowerCase(Locale.ROOT);
        return !normalized.contains("usessl=false")
                && !normalized.contains("sslmode=disabled")
                && !normalized.contains("sslmode=disable");
    }

    private boolean containsJdbcFlag(String jdbcUrl, String key, String expectedValue) {
        if (!hasText(jdbcUrl) || !hasText(key)) {
            return false;
        }
        String[] parts = jdbcUrl.split("[?&]");
        for (String part : parts) {
            int equalsIndex = part.indexOf('=');
            if (equalsIndex <= 0) {
                continue;
            }
            String itemKey = part.substring(0, equalsIndex).trim();
            String itemValue = part.substring(equalsIndex + 1).trim();
            if (itemKey.equalsIgnoreCase(key) && itemValue.equalsIgnoreCase(expectedValue)) {
                return true;
            }
        }
        return false;
    }

    private boolean isConfiguredMailAccount(MailAccountProperties.Account account) {
        return account != null
                && hasText(account.getHost())
                && account.getPort() != null
                && account.getPort() > 0
                && hasText(account.getUsername())
                && hasText(account.getPassword())
                && hasText(account.getFrom())
                && !isPlaceholderMailValue(account.getHost())
                && !isPlaceholderMailValue(account.getUsername())
                && !isPlaceholderMailValue(account.getPassword())
                && !isPlaceholderMailValue(account.getFrom());
    }

    private boolean isPlaceholderMailValue(String value) {
        if (!hasText(value)) {
            return true;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("example.com")
                || normalized.startsWith("replace-")
                || normalized.contains("replace-with")
                || normalized.contains("your-")
                || "mail-app-password".equals(normalized)
                || "another-app-password".equals(normalized);
    }

    private boolean isPlaceholderLogisticsValue(String value) {
        if (!hasText(value)) {
            return true;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.contains("example.com")
                || normalized.contains("provider.example")
                || normalized.startsWith("replace-")
                || normalized.contains("replace-with")
                || normalized.contains("your-")
                || normalized.equals("test")
                || normalized.equals("demo");
    }

    private List<String> splitPatterns(String raw) {
        if (!hasText(raw)) {
            return Collections.emptyList();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(this::hasText)
                .distinct()
                .collect(Collectors.toList());
    }

    private List<String> unsafeProductionOrigins(List<String> origins) {
        return origins.stream()
                .filter(this::isUnsafeProductionOrigin)
                .collect(Collectors.toList());
    }

    private boolean isUnsafeProductionOrigin(String origin) {
        if (!hasText(origin)) {
            return true;
        }
        String normalized = origin.trim().toLowerCase(Locale.ROOT);
        if ("*".equals(normalized) || normalized.startsWith("http://") || !normalized.startsWith("https://")) {
            return true;
        }
        return normalized.contains("localhost")
                || normalized.contains("127.0.0.1")
                || normalized.contains("0.0.0.0")
                || normalized.contains("10.*")
                || normalized.contains("10.")
                || normalized.contains("172.*")
                || normalized.matches(".*172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")
                || normalized.contains("192.168.")
                || normalized.contains(".local");
    }

    private boolean isPublicHttpsUrl(String value) {
        if (!hasText(value)) {
            return false;
        }
        try {
            URI uri = new URI(value.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(scheme) || host.isBlank() || uri.getUserInfo() != null) {
                return false;
            }
            return !isLocalOrPrivateHost(host);
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private boolean isLocalOrPrivateHost(String host) {
        return GatewayUrlValidator.isLocalOrPrivateHost(host);
    }

    private boolean isProductionMode(String value) {
        String mode = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return "production".equals(mode) || "prod".equals(mode);
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (hasText(value)) {
                return value.trim();
            }
        }
        return "";
    }

    private long elapsedMillis(long startedAtNanos) {
        return Math.max(0L, (System.nanoTime() - startedAtNanos) / 1_000_000L);
    }

    private String property(String key, String fallback) {
        return environment.getProperty(key, fallback);
    }

    private String maskDatasourceUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String masked = SensitiveDataMasker.mask(value);
        masked = masked.replaceAll("(?i)(jdbc:[^:]+://)([^/@\\s:;]+):([^/@\\s;]+)@", "$1******:******@");
        return sanitizeText(masked, 500);
    }

    private String sanitizeError(Exception e) {
        String message = sanitizeText(e.getMessage(), 240);
        return e.getClass().getSimpleName() + (message.isBlank() ? "" : ": " + message);
    }

    private List<String> sanitizeMessages(List<String> values) {
        if (values == null || values.isEmpty()) {
            return Collections.emptyList();
        }
        return values.stream()
                .map((value) -> sanitizeText(value, 240))
                .filter((value) -> !value.isBlank())
                .collect(Collectors.toList());
    }

    private String sanitizeText(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String normalized = SensitiveDataMasker.mask(value)
                .replaceAll("[\\r\\n\\t]+", " ")
                .trim();
        if (normalized.length() > maxLength) {
            return normalized.substring(0, maxLength);
        }
        return normalized;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
