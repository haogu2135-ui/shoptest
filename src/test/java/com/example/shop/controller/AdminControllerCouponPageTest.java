package com.example.shop.controller;

import com.example.shop.dto.CouponAdminSummaryResponse;
import com.example.shop.entity.Coupon;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerCouponPageTest {
    private final CouponService couponService = mock(CouponService.class);
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
            mock(ReviewService.class),
            couponService,
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
    void couponsDefaultRequestReturnsPagedObjectShape() {
        Coupon coupon = new Coupon();
        coupon.setId(7L);
        CouponAdminSummaryResponse summary = new CouponAdminSummaryResponse();
        summary.setTotalCoupons(1L);
        when(runtimeConfig.getInt("admin.coupons.page-max-size", 50)).thenReturn(100);
        when(couponService.searchAdminCoupons(null, null, null, 0, 50))
                .thenReturn(new PageImpl<>(List.of(coupon), PageRequest.of(0, 50), 1));
        when(couponService.adminSummary(null, null, null)).thenReturn(summary);

        ResponseEntity<?> response = controller.getCoupons(null, null, null, null, null);

        assertEquals(200, response.getStatusCodeValue());
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(List.of(coupon), body.get("items"));
        assertEquals(1L, body.get("total"));
        assertEquals(1, body.get("page"));
        assertEquals(50, body.get("size"));
        assertEquals(1, body.get("totalPages"));
        assertEquals(summary, body.get("summary"));
        verify(couponService).searchAdminCoupons(null, null, null, 0, 50);
        verify(couponService).adminSummary(null, null, null);
        verify(couponService, never()).findAll();
    }

    @Test
    void couponsRejectsOversizedPageByClampingToConfiguredAdminLimit() {
        CouponAdminSummaryResponse summary = new CouponAdminSummaryResponse();
        when(runtimeConfig.getInt("admin.coupons.page-max-size", 50)).thenReturn(100);
        when(couponService.searchAdminCoupons("summer", "ACTIVE", "PUBLIC", 0, 100))
                .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 100), 250));
        when(couponService.adminSummary("summer", "ACTIVE", "PUBLIC")).thenReturn(summary);

        ResponseEntity<?> response = controller.getCoupons("summer", "ACTIVE", "PUBLIC", 1, 5000);

        assertEquals(200, response.getStatusCodeValue());
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(100, body.get("size"));
        assertEquals(3, body.get("totalPages"));
        verify(couponService).searchAdminCoupons("summer", "ACTIVE", "PUBLIC", 0, 100);
        verify(couponService).adminSummary("summer", "ACTIVE", "PUBLIC");
        verify(couponService, never()).findAll();
    }
}
