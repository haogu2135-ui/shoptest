package com.example.shop.dto;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProductInventorySummaryResponseTest {
    @Test
    void computesCatalogWideHealthScoreFromStockBuckets() {
        ProductInventorySummaryResponse response = ProductInventorySummaryResponse.of(20L, 2L, 3L, 5L, 10L, 275L);

        assertEquals(20, response.getTotalProducts());
        assertEquals(2, response.getOutOfStock());
        assertEquals(3, response.getCritical());
        assertEquals(5, response.getLow());
        assertEquals(10, response.getHealthy());
        assertEquals(275, response.getTotalUnits());
        assertEquals(63, response.getScore());
    }

    @Test
    void returnsHealthyEmptyCatalogAndNormalizesNullAggregates() {
        ProductInventorySummaryResponse response = ProductInventorySummaryResponse.of(null, null, null, null, null, null);

        assertEquals(0, response.getTotalProducts());
        assertEquals(0, response.getTotalUnits());
        assertEquals(100, response.getScore());
    }
}
