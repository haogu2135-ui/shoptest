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

class DedupServiceContractTest {
    private static final Pattern STALE_FUZZY_DEDUP_MARKERS = Pattern.compile(
            "DedupService|deduplication|fuzzyMatch|fuzzyDuplicate|mergeDuplicate|"
                    + "similarityScore|Levenshtein|JaroWinkler|distinct items incorrectly merged",
            Pattern.CASE_INSENSITIVE);

    @Test
    void productionSourceDoesNotContainStaleFuzzyDedupService() throws IOException {
        List<String> offenders = new ArrayList<>();
        try (Stream<Path> paths = Files.walk(Path.of("src/main/java"))) {
            paths.filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> collectStaleDedupMarkers(path, offenders));
        }

        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/DedupService.java")),
                "The stale DedupService target should not return without explicit confidence thresholds");
        assertFalse(Files.exists(Path.of("src/main/java/com/example/shop/service/impl/DedupServiceImpl.java")),
                "The stale DedupServiceImpl target should not return without explicit confidence thresholds");
        assertTrue(offenders.isEmpty(), () -> "Stale fuzzy dedup/merge markers found in production source:\n"
                + String.join("\n", offenders));
    }

    @Test
    void currentDuplicateHandlingUsesExactConflictGuardsInsteadOfFuzzyMerges() throws IOException {
        String productService = read("src/main/java/com/example/shop/service/impl/ProductServiceImpl.java");
        String productVariantService = read("src/main/java/com/example/shop/service/ProductVariantService.java");
        String wishlistService = read("src/main/java/com/example/shop/service/WishlistService.java");

        assertTrue(productService.contains("validateImportProductNameDoesNotDuplicateExisting"),
                "Product import duplicate checks should stay explicit and exact");
        assertTrue(productService.contains("duplicateImportHeaders"),
                "CSV duplicate column handling should reject duplicate headers instead of merging");
        assertTrue(productVariantService.contains("Duplicate product variant SKU"));
        assertTrue(productVariantService.contains("Duplicate product variant option combination"));
        assertTrue(wishlistService.contains("DuplicateKeyException"),
                "Idempotent duplicate actions should rely on exact database uniqueness conflicts");
    }

    private static void collectStaleDedupMarkers(Path path, List<String> offenders) {
        String source;
        try {
            source = Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read production source " + path, ex);
        }

        String[] lines = source.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            if (STALE_FUZZY_DEDUP_MARKERS.matcher(lines[index]).find()) {
                offenders.add(path + ":" + (index + 1) + ": " + lines[index].trim());
            }
        }
    }

    private static String read(String path) throws IOException {
        return Files.readString(Path.of(path), StandardCharsets.UTF_8);
    }
}
