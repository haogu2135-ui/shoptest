package com.example.shop.controller;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ControllerCoverageInventoryTest {
    private static final Path CONTROLLER_SOURCE_DIR = Path.of("src/main/java/com/example/shop/controller");
    private static final Path CONTROLLER_TEST_DIR = Path.of("src/test/java/com/example/shop/controller");
    private static final Set<String> DEFERRED_CONTROLLER_CONTRACTS = Set.of();

    @Test
    void everyNonDeferredControllerHasAMatchingControllerTestContract() throws IOException {
        List<String> controllers = javaTypeNames(CONTROLLER_SOURCE_DIR, ".java");
        List<String> tests = javaTypeNames(CONTROLLER_TEST_DIR, "Test.java").stream()
                .map(name -> name.replaceFirst("Test$", ""))
                .collect(Collectors.toList());
        List<String> uncovered = controllers.stream()
                .filter(controller -> tests.stream().noneMatch(test -> test.equals(controller) || test.startsWith(controller)))
                .collect(Collectors.toList());

        assertEquals(DEFERRED_CONTROLLER_CONTRACTS, Set.copyOf(uncovered),
                "Only explicitly deferred controller contracts may remain uncovered");
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
