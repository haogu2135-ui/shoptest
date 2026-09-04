package com.example.shop.service;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class LogisticsCarrierServiceTest {
    private static final Path SOURCE = Path.of("src/main/java/com/example/shop/service/LogisticsCarrierService.java");

    @Test
    void logisticsCarrierServiceKeepsSortedLookupAndBoundedListContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("return findAll(activeOnly, DEFAULT_LEGACY_CARRIER_LIST_LIMIT);"));
        assertTrue(source.contains("Math.min(maxRows, HARD_CARRIER_REFERENCE_LIST_LIMIT)"));
        assertTrue(source.contains("findByStatusOrderBySortOrderAscNameAsc(\"ACTIVE\", page)"));
        assertTrue(source.contains("findAllByOrderBySortOrderAscNameAsc(page)"));
        assertTrue(source.contains("trackingCode == null || trackingCode.isBlank()"));
        assertTrue(source.contains("findByTrackingCodeIgnoreCase(trackingCode.trim())"));
    }

    @Test
    void logisticsCarrierServiceKeepsSaveValidationAndNormalizationContract() throws Exception {
        String source = Files.readString(SOURCE, StandardCharsets.UTF_8);

        assertTrue(source.contains("private static final Set<String> ALLOWED_STATUSES = Set.of(\"ACTIVE\", \"INACTIVE\")"));
        assertTrue(source.contains("if (name.isEmpty())"));
        assertTrue(source.contains("if (trackingCode.isEmpty())"));
        assertTrue(source.contains("findByNameIgnoreCase(name)"));
        assertTrue(source.contains("findByTrackingCodeIgnoreCase(trackingCode)"));
        assertTrue(source.contains("carrier.setStatus(normalizeStatus(carrier.getStatus()));"));
        assertTrue(source.contains("carrier.setSortOrder(0);"));
        assertTrue(source.contains("return \"ACTIVE\";"));
        assertTrue(source.contains("status.trim().toUpperCase(Locale.ROOT)"));
        assertTrue(source.contains("Carrier status must be ACTIVE or INACTIVE"));
    }
}
