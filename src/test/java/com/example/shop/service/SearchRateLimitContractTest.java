package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SearchRateLimitContractTest {

    @Test
    void publicSearchEndpointHasDedicatedRateLimitBucket() throws Exception {
        String rateLimitService = read("src/main/java/com/example/shop/service/RateLimitService.java");
        String applicationProperties = read("src/main/resources/application.properties");
        String configCenterService = read("src/main/java/com/example/shop/service/ConfigCenterService.java");
        String backendEnvExample = read("deploy/backend.env.example");

        assertTrue(rateLimitService.contains("positiveInt(\"traffic.rate-limit.search-per-minute\", 30)"),
                "RateLimitService should load the dedicated search limit");
        assertTrue(rateLimitService.contains("private final int searchPerMinute;"),
                "RateLimitService Config should store the dedicated search limit");
        assertTrue(rateLimitService.contains("this.searchPerMinute = searchPerMinute;"),
                "RateLimitService Config should assign the dedicated search limit");

        String endpointLimitFor = sliceBetween(
                rateLimitService,
                "private EndpointLimit endpointLimitFor(String method, String path, Config config)",
                "\n    private boolean isAdminOrderListPath");
        assertTrue(endpointLimitFor.contains("if (\"GET\".equals(method) && path.equals(\"/search\"))"),
                "GET /search should be recognized as a dedicated endpoint limit");
        assertTrue(endpointLimitFor.contains("return new EndpointLimit(\"GET\", \"search:catalog\", config.searchPerMinute, 60);"),
                "GET /search should use the search:catalog bucket");
        assertTrue(endpointLimitFor.indexOf("path.equals(\"/search\")") < endpointLimitFor.indexOf("if (!\"POST\".equals(method))"),
                "GET /search must be checked before non-POST requests return no endpoint limit");

        assertTrue(applicationProperties.contains(
                "traffic.rate-limit.search-per-minute=${TRAFFIC_RATE_LIMIT_SEARCH_PER_MINUTE:30}"),
                "application.properties should expose the search endpoint limit");
        assertTrue(configCenterService.contains("\"traffic.rate-limit.search-per-minute=30\""),
                "Config Center defaults should expose the search endpoint limit");
        assertTrue(backendEnvExample.contains("TRAFFIC_RATE_LIMIT_SEARCH_PER_MINUTE=30"),
                "Production env example should expose the search endpoint limit");
    }

    private static String read(String path) throws Exception {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }

    private static String sliceBetween(String source, String startMarker, String endMarker) {
        int start = source.indexOf(startMarker);
        assertTrue(start >= 0, "Missing start marker: " + startMarker);
        int end = source.indexOf(endMarker, start + startMarker.length());
        assertTrue(end > start, "Missing end marker after " + startMarker + ": " + endMarker);
        return source.substring(start, end);
    }
}
