package com.example.shop.controller;

import com.example.shop.dto.PublicReviewResponse;
import com.example.shop.dto.ProductReviewsResponse;
import com.example.shop.service.ReviewImageService;
import com.example.shop.service.ReviewService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReviewControllerPaginationTest {
    private final ReviewService reviewService = mock(ReviewService.class);
    private final ReviewController controller = new ReviewController(reviewService, mock(ReviewImageService.class));

    @Test
    void productReviewsReturnBoundedPageMetadata() {
        PublicReviewResponse review = new PublicReviewResponse();
        when(reviewService.getPublicReviewsByProductId(7L, null, 1, 10)).thenReturn(List.of(review));
        when(reviewService.countPublicReviewsByProductId(7L, null)).thenReturn(25L);
        when(reviewService.getAverageRating(7L)).thenReturn(new BigDecimal("4.5"));

        ResponseEntity<ProductReviewsResponse> response = controller.getProductReviews(7L, 1, 10, null);

        ProductReviewsResponse body = response.getBody();
        assertEquals(200, response.getStatusCodeValue());
        assertEquals(1, body.getPage());
        assertEquals(10, body.getSize());
        assertEquals(25, body.getTotal());
        assertEquals(3, body.getTotalPages());
        assertEquals(new BigDecimal("4.5"), body.getAverageRating());
        assertEquals(true, body.isHasNext());
        verify(reviewService).getPublicReviewsByProductId(7L, null, 1, 10);
    }

    @Test
    void productReviewsRejectOversizedPage() {
        assertThrows(ResponseStatusException.class, () -> controller.getProductReviews(7L, 0, 101, null));
    }
}
