package com.example.shop.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Data
public class ProductReviewsResponse {
    private List<PublicReviewResponse> reviews;
    private BigDecimal averageRating;
    private long total;
    private int page;
    private int size;
    private int totalPages;
    private boolean hasNext;
    private boolean hasPrevious;

    public ProductReviewsResponse(List<PublicReviewResponse> reviews, BigDecimal averageRating) {
        this(reviews, averageRating, reviews == null ? 0 : reviews.size(), 0, reviews == null ? 1 : Math.max(1, reviews.size()));
    }

    public ProductReviewsResponse(List<PublicReviewResponse> reviews, BigDecimal averageRating, long total, int page, int size) {
        int safeSize = Math.max(1, size);
        int safePage = Math.max(0, page);
        int pages = total <= 0 ? 0 : (int) Math.ceil((double) total / safeSize);
        this.reviews = reviews == null ? List.of() : reviews;
        this.averageRating = normalizeRating(averageRating);
        this.total = Math.max(0, total);
        this.page = safePage;
        this.size = safeSize;
        this.totalPages = pages;
        this.hasNext = safePage + 1 < pages;
        this.hasPrevious = safePage > 0 && pages > 0;
    }

    private static BigDecimal normalizeRating(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(1) : value.setScale(1, RoundingMode.HALF_UP);
    }
}
