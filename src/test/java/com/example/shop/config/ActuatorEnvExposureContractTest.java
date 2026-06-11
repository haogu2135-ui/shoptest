package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

class ActuatorEnvExposureContractTest {
    @Test
    void actuatorEnvEndpointIsNotExposedByManagementConfiguration() throws Exception {
        Properties properties = new Properties();
        try (InputStream input = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            properties.load(input);
        }

        Set<String> exposedEndpoints = Arrays.stream(properties
                        .getProperty("management.endpoints.web.exposure.include", "")
                        .split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());

        assertTrue(exposedEndpoints.contains("health"));
        assertTrue(exposedEndpoints.contains("info"));
        assertFalse(exposedEndpoints.contains("env"));
        assertFalse(exposedEndpoints.contains("*"));
    }

    @Test
    void securityConfigDoesNotPermitActuatorEnvAnonymously() throws Exception {
        String security = Files.readString(
                Path.of("src/main/java/com/example/shop/config/SecurityConfig.java"),
                StandardCharsets.UTF_8);

        assertFalse(security.contains("/actuator/env"));
        assertFalse(security.contains("\"/env\""));
        assertFalse(security.contains("EndpointRequest.toAnyEndpoint"));
        assertFalse(security.contains("EndpointRequest.to(\"env\")"));
    }
}
