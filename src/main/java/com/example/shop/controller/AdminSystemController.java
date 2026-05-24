package com.example.shop.controller;

import com.example.shop.dto.ConfigCenterHealthResponse;
import com.example.shop.service.ConfigCenterService;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.sql.Connection;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin/system")
public class AdminSystemController {

    private final Environment environment;
    private final ObjectProvider<DataSource> dataSources;
    private final ObjectProvider<StringRedisTemplate> redisTemplates;
    private final ObjectProvider<ConfigCenterService> configCenterServices;

    public AdminSystemController(
            Environment environment,
            ObjectProvider<DataSource> dataSources,
            ObjectProvider<StringRedisTemplate> redisTemplates,
            ObjectProvider<ConfigCenterService> configCenterServices
    ) {
        this.environment = environment;
        this.dataSources = dataSources;
        this.redisTemplates = redisTemplates;
        this.configCenterServices = configCenterServices;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        return buildStatus();
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> getReadiness() {
        Map<String, Object> payload = buildStatus();
        boolean ready = Boolean.TRUE.equals(payload.get("ready"));
        return ResponseEntity
                .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(payload);
    }

    private Map<String, Object> buildStatus() {
        Runtime runtime = Runtime.getRuntime();
        RuntimeMXBean runtimeBean = ManagementFactory.getRuntimeMXBean();
        File root = new File(".").getAbsoluteFile();
        Map<String, Object> database = databasePayload();
        Map<String, Object> redis = redisPayload();
        Map<String, Object> nacos = nacosPayload();
        boolean ready = Boolean.TRUE.equals(database.get("ready")) && Boolean.TRUE.equals(redis.get("ready"));
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
        payload.put("serverAddr", property("spring.cloud.nacos.discovery.server-addr", ""));
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
            payload.put("warnings", health.getWarnings());
            payload.put("errors", health.getErrors());
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
        return value.replaceAll("(?i)(password=)[^&;]+", "$1******");
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
