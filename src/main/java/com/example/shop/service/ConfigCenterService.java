package com.example.shop.service;

import com.alibaba.nacos.api.NacosFactory;
import com.alibaba.nacos.api.PropertyKeyConst;
import com.alibaba.nacos.api.config.ConfigService;
import com.alibaba.nacos.api.exception.NacosException;
import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.dto.ConfigCenterPublishRequest;
import com.example.shop.dto.ConfigCenterSnapshotResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.context.properties.ConfigurationPropertiesRebinder;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.StringReader;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class ConfigCenterService {
    private static final String PROPERTY_SOURCE_NAME = "adminConfigCenterOverrides";
    private static final Pattern SENSITIVE_KEY_PATTERN = Pattern.compile(
            ".*(password|passwd|pwd|secret|token|credential|private[-.]?key|access[-.]?key|auth[-.]?header).*",
            Pattern.CASE_INSENSITIVE);
    private static final String DEFAULT_CONTENT = String.join("\n",
            "# Shop runtime properties",
            "# 修改后点击发布，会同步到 Nacos 并应用到当前后台运行环境。",
            "order.default-shipping-fee=30.00",
            "order.free-shipping-threshold=899.00",
            "payment.simulation-enabled=false",
            "support.message.max-chars=1000",
            "product.search-cache-ttl-ms=30000",
            "");

    private final ConfigurableEnvironment environment;
    private final ObjectProvider<ConfigurationPropertiesRebinder> rebinderProvider;

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
        response.setNacosServerAddr(nacosServerAddr());
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

    private ConfigCenterSnapshotResponse publishInternal(ConfigCenterPublishRequest request, boolean publishToNacos) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        String resolvedDataId = resolveDataId(request.getDataId());
        String resolvedGroup = resolveGroup(request.getGroup());
        String resolvedNamespace = resolveNamespace(request.getNamespace());
        String content = request.getContent() == null ? "" : request.getContent();
        Map<String, String> parsed = parseProperties(content, errors);
        validateTarget(resolvedDataId, resolvedGroup, warnings, errors);
        validateParsedProperties(parsed, warnings);
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
            appliedKeys = applyRuntime(parsed);
            runtimeApplied = !appliedKeys.isEmpty();
            warnings.add("已更新 Spring Environment；业务配置会通过动态读取在当前后台进程中即时生效。");
        }
        return buildResponse(resolvedDataId, resolvedGroup, resolvedNamespace, content, parsed, appliedKeys, warnings, errors, runtimeApplied, published);
    }

    private ConfigService configService(String namespace) throws NacosException {
        Properties props = new Properties();
        props.put(PropertyKeyConst.SERVER_ADDR, nacosServerAddr());
        putIfPresent(props, PropertyKeyConst.NAMESPACE, namespace);
        putIfPresent(props, PropertyKeyConst.USERNAME, environment.getProperty("spring.cloud.nacos.discovery.username", ""));
        putIfPresent(props, PropertyKeyConst.PASSWORD, environment.getProperty("spring.cloud.nacos.discovery.password", ""));
        return NacosFactory.createConfigService(props);
    }

    private String nacosServerAddr() {
        return environment.getProperty("spring.cloud.nacos.discovery.server-addr", "158.101.11.223:8848");
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

    private void validateParsedProperties(Map<String, String> parsed, List<String> warnings) {
        parsed.forEach((key, value) -> {
            if (key.startsWith("spring.datasource.") || key.startsWith("server.") || key.startsWith("logging.file.")) {
                warnings.add("Key " + key + " is startup/infrastructure config and may need restart to fully take effect.");
            }
            if (value != null && value.length() > 4000) {
                warnings.add("Key " + key + " has a very long value. Confirm it belongs in config center.");
            }
        });
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
        response.setNacosServerAddr(nacosServerAddr());
        response.setContent(content);
        response.setProperties(maskSensitive(parsed));
        response.setEffectiveProperties(maskSensitive(effectiveValues(parsed.keySet())));
        response.setAppliedKeys(appliedKeys);
        response.setSensitiveKeys(parsed.keySet().stream().filter(this::isSensitive).sorted().collect(Collectors.toList()));
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

    private Map<String, String> maskSensitive(Map<String, String> values) {
        Map<String, String> masked = new LinkedHashMap<>();
        values.forEach((key, value) -> masked.put(key, isSensitive(key) ? maskValue(value) : value));
        return masked;
    }

    private boolean isSensitive(String key) {
        return key != null && SENSITIVE_KEY_PATTERN.matcher(key).matches();
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
        String normalized = message.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (normalized.length() > 240) {
            normalized = normalized.substring(0, 240);
        }
        return e.getClass().getSimpleName() + (normalized.isBlank() ? "" : ": " + normalized);
    }
}
