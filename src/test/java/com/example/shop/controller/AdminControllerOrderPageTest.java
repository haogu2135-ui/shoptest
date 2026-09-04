package com.example.shop.controller;

import com.example.shop.entity.Order;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerOrderPageTest {
    private final UserService userService = mock(UserService.class);
    private final OrderService orderService = mock(OrderService.class);
    private final OrderItemService orderItemService = mock(OrderItemService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final ProductService productService = mock(ProductService.class);
    private final AdminController controller = new AdminController(
            userService,
            orderService,
            orderItemService,
            mock(BrandService.class),
            mock(CategoryService.class),
            productService,
            mock(ProductQuestionService.class),
            mock(ProductUrlImportService.class),
            mock(ReviewService.class),
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
    void orderPageSummaryIncludesMissingTrackingQuickFilter() {
        when(runtimeConfig.getInt("admin.orders.page-max-size", 20)).thenReturn(100);
        when(orderService.countAdminOrders(null, null, null)).thenReturn(2);
        when(orderService.searchAdminOrders(null, null, null, 1, 20)).thenReturn(List.of(new Order()));
        when(orderService.countAdminOrderSummary(null)).thenReturn(Map.of("MISSING_TRACKING", 3L));

        ResponseEntity<Map<String, Object>> response = controller.getOrdersPage(null, null, null, 1, 20);

        assertEquals(200, response.getStatusCodeValue());
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(body.get("items"), body.get("content"));
        assertEquals(2, body.get("total"));
        assertEquals(2, body.get("totalElements"));
        assertEquals(1, body.get("page"));
        assertEquals(0, body.get("number"));
        assertEquals(20, body.get("size"));
        assertEquals(1, body.get("totalPages"));
        assertEquals(false, body.get("hasNext"));
        Map<?, ?> summary = assertInstanceOf(Map.class, body.get("summary"));
        assertEquals(3L, summary.get("MISSING_TRACKING"));
        verify(orderService, never()).countAdminOrders(null, null, "MISSING_TRACKING");
    }

    @Test
    void dashboardUsesOrderAggregateForRefundingPayments() {
        when(productService.countDashboardProductSummary()).thenReturn(Map.of(
                "totalProducts", 12L,
                "activeProducts", 10L,
                "inactiveProducts", 1L,
                "pendingProducts", 1L,
                "lowStockProducts", 2L
        ));
        when(orderService.getDashboardOrderStats(null, 7, 5)).thenReturn(Map.of(
                "totalOrders", 9L,
                "refundingPayments", 4L
        ));
        when(userService.count()).thenReturn(11L);
        when(orderService.dashboardRevenueStatuses()).thenReturn(List.of("PAID"));
        when(orderItemService.getTopProductsByPaidStatuses(List.of("PAID"), 8)).thenReturn(List.of());
        when(productService.findLowStockProducts(8)).thenReturn(List.of());

        ResponseEntity<Map<String, Object>> response = controller.getDashboard();

        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        assertEquals(200, response.getStatusCodeValue());
        assertEquals(4L, body.get("refundingPayments"));
        assertEquals(12L, body.get("totalProducts"));
        assertEquals(11L, body.get("totalUsers"));
        verify(orderService, never()).countAdminOrderSummary(null);
    }
}
