package com.example.shop.controller;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin/registry")
public class AdminRegistryController {

    private final DiscoveryClient discoveryClient;
    private final Environment environment;

    public AdminRegistryController(DiscoveryClient discoveryClient, Environment environment) {
        this.discoveryClient = discoveryClient;
        this.environment = environment;
    }

    @GetMapping
    public Map<String, Object> getRegistryStatus() {
        return buildRegistryStatus();
    }

    @GetMapping("/readiness")
    public ResponseEntity<Map<String, Object>> getRegistryReadiness() {
        Map<String, Object> response = buildRegistryStatus();
        boolean ready = Boolean.TRUE.equals(response.get("healthy"));
        return ResponseEntity
                .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(response);
    }

    private Map<String, Object> buildRegistryStatus() {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        String applicationName = property("spring.application.name", "shop-backend");
        boolean discoveryEnabled = environment.getProperty("spring.cloud.nacos.discovery.enabled", Boolean.class, false);
        boolean registerEnabled = environment.getProperty("spring.cloud.nacos.discovery.register-enabled", Boolean.class, false);
        String group = property("spring.cloud.nacos.discovery.group", "DEFAULT_GROUP");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("applicationName", applicationName);
        response.put("discoveryEnabled", discoveryEnabled);
        response.put("registerEnabled", registerEnabled);
        response.put("registrationExpected", discoveryEnabled && registerEnabled);
        response.put("nacosServerAddr", property("spring.cloud.nacos.discovery.server-addr", ""));
        response.put("namespace", property("spring.cloud.nacos.discovery.namespace", ""));
        response.put("group", group);
        response.put("serverPort", property("server.port", "8081"));
        response.put("configuredIp", property("spring.cloud.nacos.discovery.ip", ""));
        response.put("configuredPort", property("spring.cloud.nacos.discovery.port", property("server.port", "8081")));
        response.put("ephemeral", environment.getProperty("spring.cloud.nacos.discovery.ephemeral", Boolean.class, true));
        response.put("weight", property("spring.cloud.nacos.discovery.weight", "1"));
        response.put("discoveryClientDescription", safeDescription(errors));
        response.put("profiles", List.of(environment.getActiveProfiles()));
        List<String> knownServices = discoveryEnabled ? safeServices(errors) : Collections.emptyList();
        List<ServiceInstance> currentInstances = discoveryEnabled ? safeInstances(applicationName, errors) : Collections.emptyList();
        boolean currentServiceRegistered = !currentInstances.isEmpty();
        if (!discoveryEnabled) {
            warnings.add("Service discovery is disabled");
        } else if (!registerEnabled) {
            warnings.add("Service registration is disabled");
        } else if (!currentServiceRegistered) {
            warnings.add("Current service is not visible in discovery results");
        }
        String status = resolveStatus(errors, currentServiceRegistered, discoveryEnabled, registerEnabled);
        response.put("knownServices", knownServices);
        response.put("serviceSummaries", knownServices.stream()
                .map((serviceId) -> toServiceSummary(serviceId, errors))
                .collect(Collectors.toList()));
        response.put("instances", currentInstances.stream()
                .map(this::toInstancePayload)
                .collect(Collectors.toList()));
        response.put("instanceCount", currentInstances.size());
        response.put("currentServiceRegistered", currentServiceRegistered);
        response.put("status", status);
        response.put("healthy", "UP".equals(status));
        response.put("warnings", warnings);
        response.put("errors", errors);
        response.put("readiness", readinessPayload(status));
        response.put("diagnostics", diagnosticsPayload(applicationName, group));
        return response;
    }

    private String resolveStatus(List<String> errors, boolean currentServiceRegistered, boolean discoveryEnabled, boolean registerEnabled) {
        if (!discoveryEnabled) {
            return "DISABLED";
        }
        if (!errors.isEmpty()) {
            return "DEGRADED";
        }
        if (!registerEnabled) {
            return "DISCOVERY_ONLY";
        }
        return currentServiceRegistered ? "UP" : "UNREGISTERED";
    }

    private String safeDescription(List<String> errors) {
        try {
            return discoveryClient.description();
        } catch (RuntimeException e) {
            errors.add("Failed to read discovery client description: " + sanitizeError(e));
            return "unavailable";
        }
    }

    private List<String> safeServices(List<String> errors) {
        try {
            return discoveryClient.getServices();
        } catch (RuntimeException e) {
            errors.add("Failed to read discovered services: " + sanitizeError(e));
            return Collections.emptyList();
        }
    }

    private List<ServiceInstance> safeInstances(String serviceId, List<String> errors) {
        try {
            return discoveryClient.getInstances(serviceId);
        } catch (RuntimeException e) {
            errors.add("Failed to read instances for " + serviceId + ": " + sanitizeError(e));
            return Collections.emptyList();
        }
    }

    private Map<String, Object> toServiceSummary(String serviceId, List<String> errors) {
        List<ServiceInstance> instances = safeInstances(serviceId, errors);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("serviceId", serviceId);
        payload.put("instanceCount", instances.size());
        payload.put("instances", instances.stream().map(this::toInstancePayload).collect(Collectors.toList()));
        return payload;
    }

    private Map<String, Object> toInstancePayload(ServiceInstance instance) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("serviceId", instance.getServiceId());
        payload.put("host", instance.getHost());
        payload.put("port", instance.getPort());
        payload.put("secure", instance.isSecure());
        payload.put("uri", instance.getUri().toString());
        payload.put("metadata", instance.getMetadata());
        return payload;
    }

    private Map<String, Object> diagnosticsPayload(String applicationName, String group) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("healthEndpoint", "/actuator/health");
        payload.put("registryReadinessEndpoint", "/admin/registry/readiness");
        payload.put("infoEndpoint", "/actuator/info");
        payload.put("gatewayAdminPath", "/gateway/admin/admin/registry");
        payload.put("gatewayReadinessPath", "/gateway/admin/admin/registry/readiness");
        payload.put("expectedServiceName", applicationName);
        payload.put("expectedNacosGroup", group);
        payload.put("expectedNacosNamespace", property("spring.cloud.nacos.discovery.namespace", ""));
        return payload;
    }

    private String property(String key, String fallback) {
        return environment.getProperty(key, fallback);
    }

    private Map<String, Object> readinessPayload(String status) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ready", "UP".equals(status));
        payload.put("status", status);
        payload.put("httpStatus", "UP".equals(status) ? HttpStatus.OK.value() : HttpStatus.SERVICE_UNAVAILABLE.value());
        payload.put("checkedAt", Instant.now().toString());
        payload.put("requiresDiscovery", true);
        payload.put("requiresRegistration", true);
        return payload;
    }

    private String sanitizeError(RuntimeException e) {
        String message = e.getMessage() == null ? "" : e.getMessage();
        String normalized = message.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (normalized.length() > 240) {
            normalized = normalized.substring(0, 240);
        }
        return e.getClass().getSimpleName() + (normalized.isBlank() ? "" : ": " + normalized);
    }
}
