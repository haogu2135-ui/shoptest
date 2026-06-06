package com.example.shop.controller;

import com.example.shop.dto.AdminReviewResponse;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.BrandService;
import com.example.shop.service.CategoryService;
import com.example.shop.service.CouponService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.PetGalleryService;
import com.example.shop.service.PaymentService;
import com.example.shop.service.ProductQuestionService;
import com.example.shop.service.ProductService;
import com.example.shop.service.ProductUrlImportService;
import com.example.shop.service.ReviewService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerReviewPageTest {
    private final ReviewService reviewService = mock(ReviewService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final AdminController controller = new AdminController(
            mock(UserService.class),
            mock(OrderService.class),
            mock(OrderItemService.class),
            mock(BrandService.class),
            mock(CategoryService.class),
            mock(ProductService.class),
            mock(ProductQuestionService.class),
            mock(ProductUrlImportService.class),
            reviewService,
            mock(CouponService.class),
            mock(NotificationService.class),
            mock(PetBirthdayCouponService.class),
            mock(PetGalleryService.class),
            mock(PaymentService.class),
            mock(LogisticsCarrierService.class),
            mock(SecurityAuditLogService.class),
            mock(AdminRoleService.class),
            mock(PaymentRepository.class),
            runtimeConfig
    );

    @Test
    void reviewPageUsesBoundedPagedSearch() {
        AdminReviewResponse row = new AdminReviewResponse();
        row.setId(7L);
        when(runtimeConfig.getInt("admin.reviews.page-max-size", 20)).thenReturn(30);
        when(reviewService.countAdminReviews("PENDING", "needle")).thenReturn(35L);
        when(reviewService.searchAdminReviewResponses("PENDING", "needle", 2, 30)).thenReturn(List.of(row));
        when(reviewService.summarizeAdminReviews("PENDING", "needle")).thenReturn(Map.of("PENDING", 35L));

        ResponseEntity<Map<String, Object>> response = controller.getAllReviews("PENDING", "needle", 99, 500);

        assertEquals(200, response.getStatusCodeValue());
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(List.of(row), body.get("items"));
        assertEquals(35L, body.get("total"));
        assertEquals(2, body.get("page"));
        assertEquals(30, body.get("size"));
        assertEquals(2, body.get("totalPages"));
        verify(reviewService).countAdminReviews("PENDING", "needle");
        verify(reviewService).searchAdminReviewResponses("PENDING", "needle", 2, 30);
        verify(reviewService).summarizeAdminReviews("PENDING", "needle");
    }
}
