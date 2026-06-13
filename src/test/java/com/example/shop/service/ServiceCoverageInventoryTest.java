package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ServiceCoverageInventoryTest {
    private static final Path SERVICE_SOURCE_DIR = Path.of("src/main/java/com/example/shop/service");
    private static final Path SERVICE_TEST_DIR = Path.of("src/test/java/com/example/shop/service");

    @Test
    void everyCurrentServiceHasAMatchingServiceTestContract() throws IOException {
        List<String> services = javaTypeNames(SERVICE_SOURCE_DIR, ".java");
        List<String> tests = javaTypeNames(SERVICE_TEST_DIR, "Test.java").stream()
                .map(name -> name.replaceFirst("Test$", ""))
                .collect(Collectors.toList());
        List<String> uncovered = services.stream()
                .filter(service -> tests.stream().noneMatch(test -> test.equals(service) || test.startsWith(service)))
                .collect(Collectors.toList());

        assertTrue(uncovered.isEmpty(), "Services without matching test contracts: " + uncovered);
    }

    private List<String> javaTypeNames(Path root, String suffix) throws IOException {
        try (Stream<Path> paths = Files.list(root)) {
            return paths
                    .map(path -> path.getFileName().toString())
                    .filter(name -> name.endsWith(suffix))
                    .map(name -> name.substring(0, name.length() - ".java".length()))
                    .sorted()
                    .collect(Collectors.toList());
        }
    }
}
