package com.example.shop.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.lang.management.RuntimeMXBean;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/admin/system")
public class AdminSystemController {

    private final Environment environment;

    @Value("${spring.application.name:shop-backend}")
    private String applicationName;

    @Value("${server.port:8081}")
    private String serverPort;

    @Value("${app.runtime-mode:production}")
    private String runtimeMode;

    @Value("${spring.datasource.url:}")
    private String datasourceUrl;

    @Value("${spring.cloud.nacos.discovery.server-addr:}")
    private String nacosServerAddr;

    @Value("${spring.cloud.nacos.discovery.enabled:false}")
    private boolean nacosDiscoveryEnabled;

    @Value("${spring.cloud.nacos.discovery.register-enabled:false}")
    private boolean nacosRegisterEnabled;

    public AdminSystemController(Environment environment) {
        this.environment = environment;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Runtime runtime = Runtime.getRuntime();
        RuntimeMXBean runtimeBean = ManagementFactory.getRuntimeMXBean();
        File root = new File(".").getAbsoluteFile();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("application", applicationPayload());
        payload.put("runtime", runtimePayload(runtime, runtimeBean));
        payload.put("memory", memoryPayload(runtime));
        payload.put("disk", diskPayload(root));
        payload.put("database", databasePayload());
        payload.put("nacos", nacosPayload());
        return payload;
    }

    private Map<String, Object> applicationPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", applicationName);
        payload.put("runtimeMode", runtimeMode);
        payload.put("serverPort", serverPort);
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
        payload.put("url", maskDatasourceUrl(datasourceUrl));
        payload.put("driver", environment.getProperty("spring.datasource.driver-class-name", ""));
        return payload;
    }

    private Map<String, Object> nacosPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("serverAddr", nacosServerAddr);
        payload.put("discoveryEnabled", nacosDiscoveryEnabled);
        payload.put("registerEnabled", nacosRegisterEnabled);
        payload.put("namespace", environment.getProperty("spring.cloud.nacos.discovery.namespace", ""));
        payload.put("group", environment.getProperty("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP"));
        return payload;
    }

    private String maskDatasourceUrl(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.replaceAll("(?i)(password=)[^&;]+", "$1******");
    }
}
