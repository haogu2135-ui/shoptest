package com.example.shop.dto;

public class ProductInventorySummaryResponse {
    private long totalProducts;
    private long outOfStock;
    private long critical;
    private long low;
    private long healthy;
    private long totalUnits;
    private int score;

    public static ProductInventorySummaryResponse of(Long totalProducts,
                                                     Long outOfStock,
                                                     Long critical,
                                                     Long low,
                                                     Long healthy,
                                                     Long totalUnits) {
        ProductInventorySummaryResponse response = new ProductInventorySummaryResponse();
        response.totalProducts = nonNegative(totalProducts);
        response.outOfStock = nonNegative(outOfStock);
        response.critical = nonNegative(critical);
        response.low = nonNegative(low);
        response.healthy = nonNegative(healthy);
        response.totalUnits = nonNegative(totalUnits);
        response.score = response.totalProducts == 0
                ? 100
                : (int) Math.max(0, Math.min(100, Math.round(
                        ((response.healthy + response.low * 0.5d) / response.totalProducts) * 100d)));
        return response;
    }

    private static long nonNegative(Long value) {
        return value == null ? 0L : Math.max(0L, value);
    }

    public long getTotalProducts() {
        return totalProducts;
    }

    public long getOutOfStock() {
        return outOfStock;
    }

    public long getCritical() {
        return critical;
    }

    public long getLow() {
        return low;
    }

    public long getHealthy() {
        return healthy;
    }

    public long getTotalUnits() {
        return totalUnits;
    }

    public int getScore() {
        return score;
    }
}
