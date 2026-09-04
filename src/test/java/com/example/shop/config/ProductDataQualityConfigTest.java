package com.example.shop.config;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProductDataQualityConfigTest {
    @Test
    void variantImageRepairsUseOneBatchWrite() throws Exception {
        String source = Files.readString(
                Path.of("src/main/java/com/example/shop/config/ProductDataQualityConfig.java"),
                StandardCharsets.UTF_8);

        assertTrue(source.contains("List<Object[]> updates = new ArrayList<>()"));
        assertTrue(source.contains("jdbcTemplate.batchUpdate"));
        assertTrue(source.contains("updates.add(new Object[]{updatedVariants, row.id})"));
        assertFalse(source.contains("jdbcTemplate.update(\"UPDATE products SET variants = ?, updated_at = COALESCE(updated_at, NOW()) WHERE id = ?\""));
    }
}
