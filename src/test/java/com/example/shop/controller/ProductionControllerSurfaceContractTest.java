package com.example.shop.controller;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class ProductionControllerSurfaceContractTest {
    private static final Path CONTROLLER_SOURCE_DIR = Path.of("src/main/java/com/example/shop/controller");
    private static final Path SECURITY_CONFIG_SOURCE = Path.of("src/main/java/com/example/shop/config/SecurityConfig.java");

    @Test
    void productionControllerPackageDoesNotShipTestController() throws IOException {
        List<Path> testControllers = javaFiles(CONTROLLER_SOURCE_DIR).stream()
                .filter(path -> path.getFileName().toString().endsWith("TestController.java"))
                .collect(Collectors.toList());

        assertTrue(testControllers.isEmpty(),
                "Production source must not ship TestController classes; use test sources or profile-gated fixtures instead: "
                        + testControllers);
    }

    @Test
    void productionControllerMappingsDoNotExposeBareTestRoutes() throws IOException {
        List<Path> testRouteControllers = javaFiles(CONTROLLER_SOURCE_DIR).stream()
                .filter(path -> containsBareTestRoute(path))
                .collect(Collectors.toList());

        assertTrue(testRouteControllers.isEmpty(),
                "Production controllers must not expose bare /test routes: " + testRouteControllers);
    }

    @Test
    void securityConfigKeepsAuthenticatedFallbackForUnlistedRoutes() throws IOException {
        String source = Files.readString(SECURITY_CONFIG_SOURCE);

        assertTrue(source.contains(".anyRequest().authenticated()"),
                "Unlisted production routes should require authentication by default");
    }

    private List<Path> javaFiles(Path root) throws IOException {
        try (Stream<Path> paths = Files.walk(root)) {
            return paths
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .collect(Collectors.toList());
        }
    }

    private boolean containsBareTestRoute(Path path) {
        try {
            String source = Files.readString(path);
            return source.contains("\"/test\"") || source.contains("\"/test/");
        } catch (IOException e) {
            throw new IllegalStateException("Unable to inspect controller source " + path, e);
        }
    }
}
