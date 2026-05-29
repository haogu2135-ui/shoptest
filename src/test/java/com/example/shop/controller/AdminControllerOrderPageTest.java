package com.example.shop.controller;

import com.example.shop.entity.Order;
import com.example.shop.repository.PaymentRepository;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.CouponService;
import com.example.shop.service.LogisticsCarrierService;
import com.example.shop.service.NotificationService;
import com.example.shop.service.OrderItemService;
import com.example.shop.service.OrderService;
import com.example.shop.service.PetBirthdayCouponService;
import com.example.shop.service.PetGalleryService;
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

class AdminControllerOrderPageTest {
    private final OrderService orderService = mock(OrderService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final AdminController controller = new AdminController(
            mock(UserService.class),
            orderService,
            mock(OrderItemService.class),
            mock(ProductService.class),
            mock(ProductQuestionService.class),
            mock(ProductUrlImportService.class),
            mock(ReviewService.class),
            mock(CouponService.class),
            mock(NotificationService.class),
            mock(PetBirthdayCouponService.class),
            mock(PetGalleryService.class),
            mock(LogisticsCarrierService.class),
            mock(SecurityAuditLogService.class),
            mock(AdminRoleService.class),
            mock(PaymentRepository.class),
            runtimeConfig
    );

    @Test
    void orderPageSummaryIncludesMissingTrackingQuickFilter() {
        when(runtimeConfig.getInt("admin.orders.page-max-size", 100)).thenReturn(100);
        when(orderService.countAdminOrders(null, null, null)).thenReturn(2);
        when(orderService.searchAdminOrders(null, null, null, 1, 20)).thenReturn(List.of(new Order()));
        when(orderService.countAdminOrders(null, null, "MISSING_TRACKING")).thenReturn(3);

        ResponseEntity<Map<String, Object>> response = controller.getOrdersPage(null, null, null, 1, 20);

        assertEquals(200, response.getStatusCodeValue());
        Map<String, Object> body = assertInstanceOf(Map.class, response.getBody());
        Map<?, ?> summary = assertInstanceOf(Map.class, body.get("summary"));
        assertEquals(3L, summary.get("MISSING_TRACKING"));
        verify(orderService).countAdminOrders(null, null, "MISSING_TRACKING");
    }
}
