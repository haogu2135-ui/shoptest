package com.example.shop.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

import org.junit.jupiter.api.Test;

class ActuatorHealthExposureContractTest {
    private static final Path SECURITY_CONFIG =
            Path.of("src/main/java/com/example/shop/config/SecurityConfig.java");

    @Test
    void anonymousActuatorAccessIsLimitedToAggregateHealthAndInfo() throws Exception {
        String source = Files.readString(SECURITY_CONFIG, StandardCharsets.UTF_8);

        assertTrue(source.contains(".antMatchers(HttpMethod.GET, \"/actuator/health\", \"/actuator/info\").permitAll()"));
        assertFalse(source.contains("\"/actuator/health/**\""));
        assertFalse(source.contains("'/actuator/health/**'"));
        assertFalse(source.contains("EndpointRequest.toAnyEndpoint"));
    }

    @Test
    void healthDetailsDefaultToNever() throws Exception {
        Properties properties = new Properties();
        try (InputStream input = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            properties.load(input);
        }

        assertEquals("${MANAGEMENT_HEALTH_SHOW_DETAILS:never}",
                properties.getProperty("management.endpoint.health.show-details"));
    }
}
