package com.example.shop.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

class RuleEngineCacheContractTest {
    private static final Pattern STALE_RULE_ENGINE_MARKERS = Pattern.compile(
            "RuleEngineService|ShopRuleEngine|ruleEngineCache|ruleEngineResultCache|computedRuleCache|computedResultCache");

    @Test
    void currentProductionSourceDoesNotContainStaleRuleEngineCache() throws IOException {
        List<String> matches = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectRuleEngineMarkers(path, matches));
        }

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/RuleEngineService.java")),
                "The stale RuleEngineService target should not be reintroduced without bounded TTL cache coverage");
        assertTrue(matches.isEmpty(),
                () -> "Stale rule-engine cache markers found in production source:\n" + String.join("\n", matches));
    }

    private static void collectRuleEngineMarkers(Path path, List<String> matches) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }
        String[] lines = source.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            if (STALE_RULE_ENGINE_MARKERS.matcher(lines[index]).find()) {
                matches.add(path + ":" + (index + 1) + ": " + lines[index].trim());
            }
        }
    }
}
