package com.example.shop.service;

import lombok.extern.slf4j.Slf4j;
import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.PropertyKeyConst;
import com.alibaba.nacos.api.config.ConfigService;
import com.alibaba.nacos.api.exception.NacosException;
import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.dto.ConfigCenterPublishRequest;
import com.example.shop.dto.ConfigCenterSnapshotResponse;
import com.example.shop.util.SensitiveDataMasker;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.cloud.context.properties.ConfigurationPropertiesRebinder;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Slf4j
public class ConfigCenterService {
    private static final String PROPERTY_SOURCE_NAME = "adminConfigCenterOverrides";
    private static final int DEFAULT_MAX_CONTENT_BYTES = 65536;
    private static final int DEFAULT_MAX_PROPERTIES = 120;
    private static final String DEFAULT_ALLOWED_KEY_PREFIXES = String.join(",",
            "order.",
            "payment.",
            "support.",
            "product.",
            "product-question.",
            "review.",
            "logistics.",
            "kuaidi100.",
            "pet.",
            "pet-gallery.",
            "coupon.",
            "cart.",
            "wishlist.",
            "announcement.",
            "admin.users.",
            "admin.products.",
            "admin.orders.",
            "admin.reviews.",
            "admin.pet-gallery.",
            "admin.brands.",
            "admin.categories.",
            "admin.roles.",
            "admin.logistics-carriers.",
            "admin.coupons.",
            "admin.announcements.",
            "admin.logs.",
            "admin.audit-logs.",
            "alerts.",
            "security.ip-blacklist.",
            "security.login.",
            "traffic.",
            "app.mail.",
            "app.storefront.",
            "logging.level.");
    private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
            ".*(password|passwd|pwd|secret|token|credential|private[-._]?key|access[-._]?key|api[-._]?key|auth[-._]?header|[._-]key$).*",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern PROTECTED_CONFIG_KEY_PATTERN = Pattern.compile(
            "^(spring\\.|server\\.|management\\.|mybatis\\.|logging\\.file\\.|logging\\.pattern\\.|stripe\\.|"
                    + "app\\.jwt|app\\.cors\\.|app\\.websocket\\.|admin\\.bootstrap-token|"
                    + "security\\.jwt\\.|security\\.cors\\.|security\\.session\\.).*",
            Pattern.CASE_INSENSITIVE);
    private static final String DEFAULT_CONTENT = String.join("\n",
            "# Shop runtime properties",
            "# 修改后点击发布，会同步到 Nacos 并应用到当前后台运行环境。",
            "order.default-shipping-fee=30.00",
            "order.free-shipping-threshold=899.00",
            "payment.simulation-enabled=false",
            "payment.simulation-allow-production=false",
            "product-question.public-max-rows=20",
            "review.public-max-rows=20",
            "review.reviewable-order-max-rows=50",
            "support.websocket.max-connections=500",
            "support.websocket.max-connections-per-user=5",
            "support.websocket.max-idle-ms=300000",
            "support.websocket.max-text-message-bytes=16384",
            "support.websocket.max-binary-message-bytes=8192",
            "support.message.max-chars=1000",
            "support.message.rate-bucket-cleanup-ms=300000",
            "product.search-cache-ttl-ms=30000",
            "product.public-default-page-size=24",
            "product.public-max-page-size=100",
            "product.admin-default-page-size=50",
            "product.admin-max-page-size=500",
            "product.featured-max-limit=36",
            "admin.users.page-max-size=100",
            "admin.users.export-max-rows=10000",
            "admin.products.batch-status-max-size=100",
            "admin.orders.page-max-size=100",
            "admin.orders.legacy-list-max-rows=100",
            "admin.orders.export-max-rows=5000",
            "admin.orders.batch-ship-max-size=100",
            "cart.max-quantity-per-line=99",
            "cart.max-lines-per-user=200",
            "cart.batch-delete-max-size=100",
            "cart.selected-specs-max-chars=2000",
            "wishlist.max-items-per-user=500",
            "admin.reviews.page-max-size=100",
            "admin.pet-gallery.page-max-size=100",
            "admin.brands.list-max-rows=500",
            "admin.categories.list-max-rows=500",
            "admin.roles.list-max-rows=200",
            "admin.logistics-carriers.list-max-rows=500",
            "admin.audit-logs.default-range-hours=24",
            "admin.audit-logs.max-range-hours=168",
            "admin.audit-logs.search-max-rows=1000",
            "admin.audit-logs.export-max-rows=5000",
            "traffic.rate-limit.guest-checkout-per-hour=10",
            "traffic.rate-limit.search-per-minute=30",
            "traffic.rate-limit.admin-order-list-per-minute=60",
            "traffic.rate-limit.pet-gallery-like-per-minute=20",
            "security.ip-blacklist.login-failure-threshold=5",
            "security.ip-blacklist.payment-failure-threshold=5",
            "security.ip-blacklist.window-minutes=15",
            "security.ip-blacklist.block-minutes=60",
            "security.ip-blacklist.block-all-paths=false",
            "security.ip-blacklist.path-prefixes=/auth/login,/auth/email-login,/auth/email-code,/auth/password-reset-code,/auth/forgot-password,/auth/register,/auth/refresh,/users/create-admin,/admin,/payment,/payments,/orders/checkout/guest,/orders/track,/orders/guest,/support/guest,/ws/support",
            "security.ip-blacklist.trusted-ips=127.0.0.1,::1,0:0:0:0:0:0:0:1",
            "security.ip-blacklist.admin.batch-release-max-size=100",
            "security.login.account-failure-threshold=10",
            "security.login.account-lockout-minutes=30",
            "");

    private final ConfigurableEnvironment environment;
    private final ObjectProvider<ConfigurationPropertiesRebinder> rebinderProvider;
    private final ConcurrentMap<NacosConfigServiceKey, ConfigService> configServices = new ConcurrentHashMap<>();

    public ConfigCenterService(
            ConfigurableEnvironment environment,
            ObjectProvider<ConfigurationPropertiesRebinder> rebinderProvider
    ) {
        this.environment = environment;
        this.rebinderProvider = rebinderProvider;
    }

    public ConfigCenterSnapshotResponse snapshot(String dataId, String group, String namespace) {
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        String resolvedDataId = resolveDataId(dataId);
        String resolvedGroup = resolveGroup(group);
        String resolvedNamespace = resolveNamespace(namespace);
        String content = "";
        try {
            content = configService(resolvedNamespace).getConfig(resolvedDataId, resolvedGroup, 3000);
        } catch (NacosException e) {
            errors.add("读取 Nacos 配置失败: " + sanitizeError(e));
        }
        if (content == null || content.trim().isEmpty()) {
            content = DEFAULT_CONTENT;
            warnings.add("Nacos 中还没有该 dataId 的内容，已填入默认 properties 模板。");
        }
        Map<String, String> parsed = parseProperties(content, errors);
        return buildResponse(resolvedDataId, resolvedGroup, resolvedNamespace, content, parsed, List.of(), warnings, errors, false, false);
    }

    public ConfigCenterHealthResponse health(String dataId, String group, String namespace) {
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        String resolvedDataId = resolveDataId(dataId);
        String resolvedGroup = resolveGroup(group);
        String resolvedNamespace = resolveNamespace(namespace);
        String serverStatus = "UNKNOWN";
        boolean available = false;
        try {
            ConfigService service = configService(resolvedNamespace);
            serverStatus = service.getServerStatus();
            String content = service.getConfig(resolvedDataId, resolvedGroup, 1500);
            available = "UP".equalsIgnoreCase(serverStatus);
            if (content == null || content.trim().isEmpty()) {
                warnings.add("Nacos is reachable, but this dataId has no content yet.");
            }
        } catch (NacosException e) {
            errors.add("Nacos health check failed: " + sanitizeError(e));
        } catch (RuntimeException e) {
            errors.add("Config center health check failed: " + sanitizeError(e));
        }

        ConfigCenterHealthResponse response = new ConfigCenterHealthResponse();
        response.setDataId(resolvedDataId);
        response.setGroup(resolvedGroup);
        response.setNamespace(resolvedNamespace);
        response.setNacosServerAddr(safeNacosServerAddr());
        response.setAvailable(available && errors.isEmpty());
        response.setServerStatus(serverStatus);
        response.setCheckedAt(Instant.now().toString());
        response.setWarnings(warnings);
        response.setErrors(errors);
        return response;
    }

    public ConfigCenterSnapshotResponse publish(ConfigCenterPublishRequest request) {
        return publishInternal(request, true);
    }

    public ConfigCenterSnapshotResponse apply(ConfigCenterPublishRequest request) {
        return publishInternal(request, false);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void applyDefaultNacosConfigOnStartup() {
        if (!environment.getProperty("admin.config-center.apply-nacos-on-startup", Boolean.class, true)) {
            return;
        }
        String dataId = resolveDataId(null);
        String group = resolveGroup(null);
        String namespace = resolveNamespace(null);
        try {
            String content = configService(namespace).getConfig(dataId, group, 3000);
            if (content == null || content.trim().isEmpty()) {
                return;
            }
            applyNacosRuntimeContentOnStartup(content);
        } catch (NacosException | RuntimeException ignored) {
            // Startup should not fail when Nacos config is unavailable; local properties remain in effect.
        }
    }

    void applyNacosRuntimeContentOnStartup(String content) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String normalizedContent = normalizeContent(content, errors);
        Map<String, String> parsed = parseProperties(normalizedContent, errors);
        validateParsedProperties(parsed, warnings, errors, true);
        if (errors.isEmpty() && !parsed.isEmpty()) {
            applyRuntime(runtimeApplicableProperties(parsed));
        }
    }

    private ConfigCenterSnapshotResponse publishInternal(ConfigCenterPublishRequest request, boolean publishToNacos) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        String resolvedDataId = resolveDataId(request.getDataId());
        String resolvedGroup = resolveGroup(request.getGroup());
        String resolvedNamespace = resolveNamespace(request.getNamespace());
        String content = normalizeContent(request.getContent(), errors);
        Map<String, String> parsed = parseProperties(content, errors);
        if (errors.isEmpty()) {
            String mergedContent = preserveMaskedSensitiveValues(content, parsed, resolvedDataId, resolvedGroup, resolvedNamespace, warnings, errors);
            if (!mergedContent.equals(content)) {
                content = mergedContent;
                parsed = parseProperties(content, errors);
            }
        }
        validateTarget(resolvedDataId, resolvedGroup, warnings, errors);
        validateParsedProperties(parsed, warnings, errors, true);
        if (parsed.isEmpty()) {
            warnings.add("当前 properties 没有解析出有效键值，已阻止发布。");
            return buildResponse(resolvedDataId, resolvedGroup, resolvedNamespace, content, parsed, List.of(), warnings, errors, false, false);
        }
        boolean published = false;
        if (publishToNacos && errors.isEmpty()) {
        try {
            published = configService(resolvedNamespace).publishConfig(resolvedDataId, resolvedGroup, content, "properties");
            if (!published) {
                warnings.add("Nacos 返回发布失败，请检查服务端权限和 dataId/group。");
            }
        } catch (NacosException e) {
            errors.add("发布到 Nacos 失败: " + sanitizeError(e));
        }
        }
        List<String> appliedKeys = List.of();
        boolean runtimeApplied = false;
        if (request.isApplyRuntime() && errors.isEmpty() && (published || !publishToNacos)) {
            appliedKeys = applyRuntime(runtimeApplicableProperties(parsed));
            runtimeApplied = !appliedKeys.isEmpty();
            warnings.add("已更新 Spring Environment；业务配置会通过动态读取在当前后台进程中即时生效。");
        }
        return buildResponse(resolvedDataId, resolvedGroup, resolvedNamespace, content, parsed, appliedKeys, warnings, errors, runtimeApplied, published);
    }

    protected ConfigService configService(String namespace) throws NacosException {
        NacosConfigServiceKey key = new NacosConfigServiceKey(
                nacosServerAddr(),
                trimToNull(namespace),
                trimToNull(environment.getProperty("spring.cloud.nacos.discovery.username", "")),
                trimToNull(environment.getProperty("spring.cloud.nacos.discovery.password", "")));
        try {
            return configServices.computeIfAbsent(key, this::createConfigService);
        } catch (ConfigServiceCreationException e) {
            throw e.getCause();
        }
    }

    protected ConfigService createConfigService(NacosConfigServiceKey key) {
        Properties props = new Properties();
        props.put(PropertyKeyConst.SERVER_ADDR, key.serverAddr);
        putIfPresent(props, PropertyKeyConst.NAMESPACE, key.namespace);
        putIfPresent(props, PropertyKeyConst.USERNAME, key.username);
        putIfPresent(props, PropertyKeyConst.PASSWORD, key.password);
        try {
            return NacosFactory.createConfigService(props);
        } catch (NacosException e) {
            throw new ConfigServiceCreationException(e);
        }
    }

    private String nacosServerAddr() {
        return environment.getProperty("spring.cloud.nacos.discovery.server-addr", "localhost:8848");
    }

    private String safeNacosServerAddr() {
        return sanitizeText(nacosServerAddr(), 240);
    }

    private void putIfPresent(Properties props, String key, String value) {
        if (value != null && !value.trim().isEmpty()) {
            props.put(key, value.trim());
        }
    }

    private String resolveDataId(String dataId) {
        String value = trimToNull(dataId);
        if (value != null) {
            return value;
        }
        String appName = environment.getProperty("spring.application.name", "shop-backend");
        return appName + ".properties";
    }

    private String resolveGroup(String group) {
        String value = trimToNull(group);
        return value != null ? value : environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP");
    }

    private String resolveNamespace(String namespace) {
        String value = trimToNull(namespace);
        return value != null ? value : environment.getProperty("spring.cloud.nacos.discovery.namespace", "");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Map<String, String> parseProperties(String content, List<String> errors) {
        Properties props = new Properties();
        try {
            props.load(new StringReader(content == null ? "" : content));
        } catch (IOException | IllegalArgumentException e) {
            errors.add("properties 格式解析失败: " + sanitizeError(e));
            return Map.of();
        }
        return props.stringPropertyNames().stream()
                .sorted(Comparator.naturalOrder())
                .collect(Collectors.toMap(
                        key -> key,
                        props::getProperty,
                        (left, right) -> right,
                        LinkedHashMap::new));
    }

    private void validateTarget(String dataId, String group, List<String> warnings, List<String> errors) {
        if (!dataId.endsWith(".properties")) {
            warnings.add("Data ID should end with .properties for easier operations.");
        }
        if (dataId.length() > 128 || group.length() > 128) {
            errors.add("Data ID and group must be 128 characters or less.");
        }
        if (dataId.contains("/") || dataId.contains("\\") || group.contains("/") || group.contains("\\")) {
            errors.add("Data ID and group cannot contain path separators.");
        }
    }

    private void validateParsedProperties(Map<String, String> parsed, List<String> warnings, List<String> errors, boolean publishing) {
        if (parsed.size() > maxProperties()) {
            errors.add("Too many config properties. Maximum properties: " + maxProperties());
        }
        parsed.forEach((key, value) -> {
            if (!isAllowedKey(key)) {
                errors.add("Key " + key + " is not allowed in admin config center.");
            }
            if (publishing && isSensitive(key) && looksMasked(value)) {
                errors.add("Sensitive key " + key + " still contains a masked placeholder. Enter the real value or remove the key.");
            }
            if (key.startsWith("spring.datasource.") || key.startsWith("server.") || key.startsWith("logging.file.")) {
                warnings.add("Key " + key + " is startup/infrastructure config and may need restart to fully take effect.");
            }
            if (value != null && value.length() > 4000) {
                warnings.add("Key " + key + " has a very long value. Confirm it belongs in config center.");
            }
        });
    }

    private String normalizeContent(String content, List<String> errors) {
        String normalized = content == null ? "" : content.replace("\r\n", "\n").replace('\r', '\n');
        int bytes = normalized.getBytes(StandardCharsets.UTF_8).length;
        if (bytes > maxContentBytes()) {
            errors.add("Config content is too large. Maximum bytes: " + maxContentBytes());
        }
        return normalized;
    }

    private Map<String, String> runtimeApplicableProperties(Map<String, String> parsed) {
        return parsed.entrySet().stream()
                .filter(entry -> isAllowedKey(entry.getKey()))
                .filter(entry -> !PROTECTED_CONFIG_KEY_PATTERN.matcher(entry.getKey()).matches())
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (left, right) -> right,
                        LinkedHashMap::new));
    }

    private String preserveMaskedSensitiveValues(
            String content,
            Map<String, String> parsed,
            String dataId,
            String group,
            String namespace,
            List<String> warnings,
            List<String> errors
    ) {
        List<String> maskedKeys = parsed.entrySet().stream()
                .filter(entry -> isSensitive(entry.getKey()) && looksMasked(entry.getValue()))
                .map(Map.Entry::getKey)
                .sorted()
                .collect(Collectors.toList());
        if (maskedKeys.isEmpty()) {
            return content;
        }

        String currentContent = "";
        try {
            currentContent = configService(namespace).getConfig(dataId, group, 3000);
        } catch (NacosException e) {
            errors.add("敏感配置仍是脱敏占位符，且读取 Nacos 原值失败: " + sanitizeError(e));
            return content;
        }
        if (currentContent == null || currentContent.trim().isEmpty()) {
            errors.add("敏感配置仍是脱敏占位符，但 Nacos 中没有可保留的原始值。请输入真实值或删除该键。");
            return content;
        }

        List<String> currentErrors = new ArrayList<>();
        Map<String, String> currentParsed = parseProperties(currentContent, currentErrors);
        if (!currentErrors.isEmpty()) {
            errors.add("敏感配置仍是脱敏占位符，且 Nacos 当前内容无法解析，不能安全保留原值。");
            return content;
        }
        Map<String, String> currentLineValues = rawLineValuesByKey(currentContent);
        Map<String, String> replacements = new LinkedHashMap<>();
        for (String key : maskedKeys) {
            String currentValue = currentParsed.get(key);
            String currentLineValue = currentLineValues.get(key);
            if (currentValue == null || looksMasked(currentValue) || currentLineValue == null || looksMasked(currentLineValue)) {
                errors.add("Sensitive key " + key + " still contains a masked placeholder. Enter the real value or remove the key.");
            } else {
                replacements.put(key, currentLineValue);
            }
        }
        if (replacements.isEmpty()) {
            return content;
        }
        warnings.add("已保留 " + replacements.size() + " 个敏感键的 Nacos 原值，避免把脱敏占位符写回配置中心。");
        return replaceMaskedSensitiveLines(content, replacements);
    }

    private Map<String, String> rawLineValuesByKey(String content) {
        Map<String, String> values = new LinkedHashMap<>();
        Arrays.stream((content == null ? "" : content).split("\\n", -1))
                .forEach(line -> {
                    if (line == null || line.trim().isEmpty() || line.trim().startsWith("#") || line.trim().startsWith("!")) {
                        return;
                    }
                    int separator = separatorIndex(line);
                    if (separator < 0) {
                        return;
                    }
                    String key = line.substring(0, separator).trim();
                    values.put(key, separator + 1 >= line.length() ? "" : line.substring(separator + 1).trim());
                });
        return values;
    }

    private String replaceMaskedSensitiveLines(String content, Map<String, String> replacements) {
        return Arrays.stream((content == null ? "" : content).split("\\n", -1))
                .map(line -> replaceMaskedSensitiveLine(line, replacements))
                .collect(Collectors.joining("\n"));
    }

    private String replaceMaskedSensitiveLine(String line, Map<String, String> replacements) {
        if (line == null || line.trim().isEmpty() || line.trim().startsWith("#") || line.trim().startsWith("!")) {
            return line;
        }
        int separator = separatorIndex(line);
        if (separator < 0) {
            return line;
        }
        String key = line.substring(0, separator).trim();
        String replacement = replacements.get(key);
        if (replacement == null) {
            return line;
        }
        String value = separator + 1 >= line.length() ? "" : line.substring(separator + 1).trim();
        if (!looksMasked(value)) {
            return line;
        }
        return line.substring(0, separator + 1) + replacement;
    }

    private List<String> applyRuntime(Map<String, String> parsed) {
        Map<String, Object> values = new LinkedHashMap<>(parsed);
        MapPropertySource propertySource = new MapPropertySource(PROPERTY_SOURCE_NAME, values);
        if (environment.getPropertySources().contains(PROPERTY_SOURCE_NAME)) {
            environment.getPropertySources().replace(PROPERTY_SOURCE_NAME, propertySource);
        } else {
            environment.getPropertySources().addFirst(propertySource);
        }
        ConfigurationPropertiesRebinder rebinder = rebinderProvider.getIfAvailable();
        if (rebinder != null) {
            rebinder.rebind();
        }
        return new ArrayList<>(parsed.keySet());
    }

    private ConfigCenterSnapshotResponse buildResponse(
            String dataId,
            String group,
            String namespace,
            String content,
            Map<String, String> parsed,
            List<String> appliedKeys,
            List<String> warnings,
            List<String> errors,
            boolean runtimeApplied,
            boolean nacosPublished
    ) {
        ConfigCenterSnapshotResponse response = new ConfigCenterSnapshotResponse();
        response.setDataId(dataId);
        response.setGroup(group);
        response.setNamespace(namespace);
        response.setNacosServerAddr(safeNacosServerAddr());
        response.setContent(maskSensitiveContent(content, parsed));
        response.setProperties(maskSensitive(parsed));
        response.setEffectiveProperties(maskSensitive(effectiveValues(parsed.keySet())));
        response.setAppliedKeys(appliedKeys);
        response.setSensitiveKeys(parsed.keySet().stream().filter(this::isSensitive).sorted().collect(Collectors.toList()));
        response.setAllowedKeyPrefixes(new ArrayList<>(allowedKeyPrefixes()));
        response.setMaxContentBytes(maxContentBytes());
        response.setMaxProperties(maxProperties());
        response.setWarnings(warnings);
        response.setErrors(errors);
        response.setRuntimeApplied(runtimeApplied);
        response.setNacosPublished(nacosPublished);
        response.setPropertyCount(parsed.size());
        response.setLastSyncedAt(Instant.now().toString());
        return response;
    }

    private Map<String, String> effectiveValues(Iterable<String> keys) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String key : keys) {
            values.put(key, environment.getProperty(key, ""));
        }
        return values;
    }

    private String maskSensitiveContent(String content, Map<String, String> parsed) {
        if (content == null || content.isEmpty() || parsed.isEmpty()) {
            return content;
        }
        Set<String> sensitiveKeys = parsed.keySet().stream()
                .filter(this::isSensitive)
                .collect(Collectors.toSet());
        if (sensitiveKeys.isEmpty()) {
            return content;
        }
        return Arrays.stream(content.split("\\n", -1))
                .map(line -> maskSensitiveLine(line, sensitiveKeys))
                .collect(Collectors.joining("\n"));
    }

    private String maskSensitiveLine(String line, Set<String> sensitiveKeys) {
        if (line == null || line.trim().isEmpty() || line.trim().startsWith("#") || line.trim().startsWith("!")) {
            return line;
        }
        int separator = separatorIndex(line);
        if (separator < 0) {
            return line;
        }
        String key = line.substring(0, separator).trim();
        if (!sensitiveKeys.contains(key)) {
            return line;
        }
        return line.substring(0, separator + 1) + maskValue(separator + 1 >= line.length() ? "" : line.substring(separator + 1).trim());
    }

    private int separatorIndex(String line) {
        int equalsIndex = line.indexOf('=');
        int colonIndex = line.indexOf(':');
        if (equalsIndex < 0) {
            return colonIndex;
        }
        if (colonIndex < 0) {
            return equalsIndex;
        }
        return Math.min(equalsIndex, colonIndex);
    }

    private Map<String, String> maskSensitive(Map<String, String> values) {
        Map<String, String> masked = new LinkedHashMap<>();
        values.forEach((key, value) -> masked.put(key, isSensitive(key) ? maskValue(value) : value));
        return masked;
    }

    private boolean isSensitive(String key) {
        return key != null && SENSITIVE_KEY_PATTERN.matcher(key).matches();
    }

    private boolean isAllowedKey(String key) {
        if (key == null || key.isBlank() || key.length() > 160 || !key.matches("[A-Za-z0-9_.\\-\\[\\]]+")) {
            return false;
        }
        if (PROTECTED_CONFIG_KEY_PATTERN.matcher(key).matches()) {
            return false;
        }
        return allowedKeyPrefixes().stream().anyMatch(key::startsWith);
    }

    private boolean looksMasked(String value) {
        return value != null && value.contains("****");
    }

    private Set<String> allowedKeyPrefixes() {
        Set<String> prefixes = Arrays.stream(environment.getProperty("admin.config-center.allowed-key-prefixes", DEFAULT_ALLOWED_KEY_PREFIXES).split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .filter(item -> item.matches("[A-Za-z0-9_.\\-]+"))
                .filter(item -> !PROTECTED_CONFIG_KEY_PATTERN.matcher(item).matches())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (!prefixes.isEmpty()) {
            return prefixes;
        }
        return Arrays.stream(DEFAULT_ALLOWED_KEY_PREFIXES.split(","))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private int maxContentBytes() {
        return intProperty("admin.config-center.max-content-bytes", DEFAULT_MAX_CONTENT_BYTES, 1024, 512 * 1024);
    }

    private int maxProperties() {
        return intProperty("admin.config-center.max-properties", DEFAULT_MAX_PROPERTIES, 1, 1000);
    }

    private int intProperty(String key, int defaultValue, int min, int max) {
        String value = environment.getProperty(key);
        if (value == null || value.trim().isEmpty()) {
            return defaultValue;
        }
        try {
            return Math.max(min, Math.min(max, Integer.parseInt(value.trim())));
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private String maskValue(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.length() <= 4) {
            return "****";
        }
        return value.substring(0, 2) + "****" + value.substring(value.length() - 2);
    }

    private String sanitizeError(Exception e) {
        String message = e.getMessage() == null ? "" : e.getMessage();
        String normalized = sanitizeText(message, 240);
        return e.getClass().getSimpleName() + (normalized.isBlank() ? "" : ": " + normalized);
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

    protected static final class NacosConfigServiceKey {
        private final String serverAddr;
        private final String namespace;
        private final String username;
        private final String password;

        private NacosConfigServiceKey(String serverAddr, String namespace, String username, String password) {
            this.serverAddr = serverAddr == null ? "" : serverAddr.trim();
            this.namespace = namespace == null ? "" : namespace.trim();
            this.username = username == null ? "" : username.trim();
            this.password = password == null ? "" : password.trim();
        }

        @Override
        public boolean equals(Object object) {
            if (this == object) {
                return true;
            }
            if (!(object instanceof NacosConfigServiceKey)) {
                return false;
            }
            NacosConfigServiceKey other = (NacosConfigServiceKey) object;
            return serverAddr.equals(other.serverAddr)
                    && namespace.equals(other.namespace)
                    && username.equals(other.username)
                    && password.equals(other.password);
        }

        @Override
        public int hashCode() {
            return Objects.hash(serverAddr, namespace, username, password);
        }
    }

    private static final class ConfigServiceCreationException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        private ConfigServiceCreationException(NacosException cause) {
            super(cause);
        }

        @Override
        public synchronized NacosException getCause() {
            return (NacosException) super.getCause();
        }
    }
}
