package com.example.shop.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/admin/registry")
public class AdminRegistryController {

    private final DiscoveryClient discoveryClient;
    private final Environment environment;

    @Value("${spring.application.name:shop-backend}")
    private String applicationName;

    @Value("${spring.cloud.nacos.discovery.enabled:false}")
    private boolean discoveryEnabled;

    @Value("${spring.cloud.nacos.discovery.register-enabled:false}")
    private boolean registerEnabled;

    @Value("${spring.cloud.nacos.discovery.server-addr:}")
    private String nacosServerAddr;

    @Value("${spring.cloud.nacos.discovery.namespace:}")
    private String namespace;

    @Value("${spring.cloud.nacos.discovery.group:DEFAULT_GROUP}")
    private String group;

    @Value("${server.port:8081}")
    private String serverPort;

    @Value("${spring.cloud.nacos.discovery.ip:}")
    private String configuredIp;

    @Value("${spring.cloud.nacos.discovery.port:${server.port}}")
    private String configuredPort;

    @Value("${spring.cloud.nacos.discovery.ephemeral:true}")
    private boolean ephemeral;

    @Value("${spring.cloud.nacos.discovery.weight:1}")
    private String weight;

    public AdminRegistryController(DiscoveryClient discoveryClient, Environment environment) {
        this.discoveryClient = discoveryClient;
        this.environment = environment;
    }

    @GetMapping
    public Map<String, Object> getRegistryStatus() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("applicationName", applicationName);
        response.put("discoveryEnabled", discoveryEnabled);
        response.put("registerEnabled", registerEnabled);
        response.put("nacosServerAddr", nacosServerAddr);
        response.put("namespace", namespace);
        response.put("group", group);
        response.put("serverPort", serverPort);
        response.put("configuredIp", configuredIp);
        response.put("configuredPort", configuredPort);
        response.put("ephemeral", ephemeral);
        response.put("weight", weight);
        response.put("discoveryClientDescription", discoveryClient.description());
        response.put("profiles", List.of(environment.getActiveProfiles()));
        List<String> knownServices = discoveryClient.getServices();
        List<ServiceInstance> currentInstances = discoveryClient.getInstances(applicationName);
        response.put("knownServices", knownServices);
        response.put("serviceSummaries", knownServices.stream()
                .map(this::toServiceSummary)
                .collect(Collectors.toList()));
        response.put("instances", currentInstances.stream()
                .map(this::toInstancePayload)
                .collect(Collectors.toList()));
        response.put("instanceCount", currentInstances.size());
        response.put("healthy", discoveryEnabled && registerEnabled && !currentInstances.isEmpty());
        return response;
    }

    private Map<String, Object> toServiceSummary(String serviceId) {
        List<ServiceInstance> instances = discoveryClient.getInstances(serviceId);
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
}
