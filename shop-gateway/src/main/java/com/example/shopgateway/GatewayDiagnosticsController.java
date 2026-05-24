package com.example.shopgateway;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.cloud.gateway.route.Route;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/gateway/status")
public class GatewayDiagnosticsController {

    private static final Set<String> REQUIRED_ROUTE_IDS = new LinkedHashSet<>(List.of(
        "shop-app",
        "shop-identity",
        "shop-catalog",
        "shop-customer",
        "shop-commerce",
        "shop-order",
        "shop-payment",
        "shop-support",
        "shop-notification",
        "shop-logistics",
        "shop-admin",
        "shop-uploads",
        "shop-support-websocket"
    ));

    private final RouteLocator routeLocator;
    private final Environment environment;
    private final ObjectProvider<DiscoveryClient> discoveryClients;

    @Value("${spring.application.name:shop-gateway}")
    private String applicationName;

    @Value("${server.port:8080}")
    private String serverPort;

    @Value("${spring.cloud.nacos.discovery.enabled:false}")
    private boolean discoveryEnabled;

    @Value("${spring.cloud.nacos.discovery.server-addr:}")
    private String nacosServerAddr;

    @Value("${spring.cloud.nacos.discovery.namespace:}")
    private String namespace;

    @Value("${spring.cloud.nacos.discovery.group:DEFAULT_GROUP}")
    private String group;

    @Value("${spring.cloud.gateway.httpclient.connect-timeout:}")
    private String connectTimeout;

    @Value("${spring.cloud.gateway.httpclient.response-timeout:}")
    private String responseTimeout;

    @Value("${shop.gateway.backend-service-id:shop-backend}")
    private String backendServiceId;

    public GatewayDiagnosticsController(
        RouteLocator routeLocator,
        Environment environment,
        ObjectProvider<DiscoveryClient> discoveryClients
    ) {
        this.routeLocator = routeLocator;
        this.environment = environment;
        this.discoveryClients = discoveryClients;
    }

    @GetMapping
    public Mono<Map<String, Object>> getGatewayStatus() {
        return routeLocator.getRoutes()
            .collectList()
            .map((routes) -> buildPayload(routes, null))
            .onErrorResume((error) -> Mono.just(buildPayload(Collections.emptyList(), error)));
    }

    @GetMapping("/readiness")
    public Mono<ResponseEntity<Map<String, Object>>> getGatewayReadiness() {
        return getGatewayStatus()
            .map((payload) -> {
                boolean ready = Boolean.TRUE.equals(payload.get("healthy"));
                return ResponseEntity
                    .status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                    .body(payload);
            });
    }

    private Map<String, Object> buildPayload(List<Route> routes, Throwable routeError) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        if (routeError != null) {
            errors.add("Failed to read gateway routes: " + sanitizeError(routeError));
        }
        if (!discoveryEnabled) {
            warnings.add("Nacos discovery is disabled; lb:// routes cannot resolve registered services");
        }

        Set<String> routeIds = routes.stream()
            .map(Route::getId)
            .collect(Collectors.toCollection(LinkedHashSet::new));
        List<String> missingRequiredRouteIds = REQUIRED_ROUTE_IDS.stream()
            .filter((routeId) -> !routeIds.contains(routeId))
            .collect(Collectors.toList());
        if (!missingRequiredRouteIds.isEmpty()) {
            warnings.add("Missing required gateway routes: " + String.join(", ", missingRequiredRouteIds));
        }

        DiscoverySnapshot discoverySnapshot = discoverySnapshot(errors, warnings);
        String status = resolveStatus(errors, missingRequiredRouteIds, discoverySnapshot.backendMissing);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("applicationName", applicationName);
        response.put("serverPort", serverPort);
        response.put("profiles", List.of(environment.getActiveProfiles()));
        response.put("status", status);
        response.put("healthy", "UP".equals(status));
        response.put("nacos", nacosPayload());
        response.put("httpClient", httpClientPayload());
        response.put("backendService", discoverySnapshot.payload);
        response.put("routeCount", routes.size());
        response.put("requiredRouteIds", new ArrayList<>(REQUIRED_ROUTE_IDS));
        response.put("missingRequiredRouteIds", missingRequiredRouteIds);
        response.put("routes", routes.stream().map(this::toRoutePayload).collect(Collectors.toList()));
        response.put("warnings", warnings);
        response.put("errors", errors);
        response.put("readiness", readinessPayload(status));
        response.put("diagnostics", diagnosticsPayload());
        return response;
    }

    private String resolveStatus(
        List<String> errors,
        List<String> missingRequiredRouteIds,
        boolean backendMissing
    ) {
        if (!errors.isEmpty() || !missingRequiredRouteIds.isEmpty() || !discoveryEnabled || backendMissing) {
            return "DEGRADED";
        }
        return "UP";
    }

    private Map<String, Object> nacosPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("discoveryEnabled", discoveryEnabled);
        payload.put("serverAddr", nacosServerAddr);
        payload.put("namespace", namespace);
        payload.put("group", group);
        payload.put("expectedBackendServiceId", backendServiceId);
        return payload;
    }

    private Map<String, Object> httpClientPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("connectTimeout", connectTimeout);
        payload.put("responseTimeout", responseTimeout);
        return payload;
    }

    private DiscoverySnapshot discoverySnapshot(List<String> errors, List<String> warnings) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("serviceId", backendServiceId);
        payload.put("discoveryCheckEnabled", discoveryEnabled);
        payload.put("knownServices", Collections.emptyList());
        payload.put("visible", false);
        payload.put("instanceCount", 0);
        payload.put("instances", Collections.emptyList());

        if (!discoveryEnabled) {
            return new DiscoverySnapshot(false, payload);
        }

        DiscoveryClient discoveryClient = discoveryClients.orderedStream().findFirst().orElse(null);
        if (discoveryClient == null) {
            errors.add("DiscoveryClient bean is unavailable");
            return new DiscoverySnapshot(true, payload);
        }

        List<String> knownServices = safeServices(discoveryClient, errors);
        List<ServiceInstance> backendInstances = safeInstances(discoveryClient, backendServiceId, errors);
        boolean backendVisible = !backendInstances.isEmpty();
        if (!backendVisible) {
            warnings.add("Backend service is not visible in discovery results: " + backendServiceId);
        }

        payload.put("knownServices", knownServices);
        payload.put("visible", backendVisible);
        payload.put("instanceCount", backendInstances.size());
        payload.put("instances", backendInstances.stream()
            .map(this::toInstancePayload)
            .collect(Collectors.toList()));
        return new DiscoverySnapshot(!backendVisible, payload);
    }

    private Map<String, Object> toRoutePayload(Route route) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", route.getId());
        payload.put("uri", route.getUri().toString());
        payload.put("order", route.getOrder());
        payload.put("predicate", route.getPredicate().toString());
        payload.put("filterCount", route.getFilters().size());
        payload.put("metadata", route.getMetadata());
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

    private Map<String, Object> diagnosticsPayload() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("gatewayStatusEndpoint", "/gateway/status");
        payload.put("gatewayReadinessEndpoint", "/gateway/status/readiness");
        payload.put("healthEndpoint", "/actuator/health");
        payload.put("gatewayRoutesEndpoint", "/actuator/gateway/routes");
        payload.put("backendRegistryViaGateway", "/gateway/admin/admin/registry");
        payload.put("backendRegistryReadinessViaGateway", "/gateway/admin/admin/registry/readiness");
        payload.put("backendRegistryDirect", "/admin/registry");
        payload.put("backendRegistryReadinessDirect", "/admin/registry/readiness");
        payload.put("expectedBackendServiceId", backendServiceId);
        return payload;
    }

    private Map<String, Object> readinessPayload(String status) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ready", "UP".equals(status));
        payload.put("status", status);
        payload.put("httpStatus", "UP".equals(status) ? HttpStatus.OK.value() : HttpStatus.SERVICE_UNAVAILABLE.value());
        payload.put("checkedAt", Instant.now().toString());
        payload.put("requiresDiscovery", true);
        payload.put("requiresBackendService", true);
        payload.put("requiresRoutes", new ArrayList<>(REQUIRED_ROUTE_IDS));
        return payload;
    }

    private List<String> safeServices(DiscoveryClient discoveryClient, List<String> errors) {
        try {
            return discoveryClient.getServices();
        } catch (RuntimeException e) {
            errors.add("Failed to read discovered services: " + sanitizeError(e));
            return Collections.emptyList();
        }
    }

    private List<ServiceInstance> safeInstances(
        DiscoveryClient discoveryClient,
        String serviceId,
        List<String> errors
    ) {
        try {
            return discoveryClient.getInstances(serviceId);
        } catch (RuntimeException e) {
            errors.add("Failed to read instances for " + serviceId + ": " + sanitizeError(e));
            return Collections.emptyList();
        }
    }

    private String sanitizeError(Throwable error) {
        String message = error.getMessage() == null ? "" : error.getMessage();
        String normalized = message.replaceAll("[\\r\\n\\t]+", " ").trim();
        if (normalized.length() > 240) {
            normalized = normalized.substring(0, 240);
        }
        return error.getClass().getSimpleName() + (normalized.isBlank() ? "" : ": " + normalized);
    }

    private static class DiscoverySnapshot {
        private final boolean backendMissing;
        private final Map<String, Object> payload;

        private DiscoverySnapshot(boolean backendMissing, Map<String, Object> payload) {
            this.backendMissing = backendMissing;
            this.payload = payload;
        }
    }
}
