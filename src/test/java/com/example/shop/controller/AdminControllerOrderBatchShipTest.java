package com.example.shop.controller;

import com.example.shop.dto.AdminOrderBatchShipResponse;
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
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerOrderBatchShipTest {
    private final OrderService orderService = mock(OrderService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
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
            auditLogService,
            mock(AdminRoleService.class),
            mock(PaymentRepository.class),
            runtimeConfig
    );

    @Test
    void batchShipReturnsPerOrderFailureDetailsAndAuditsPartialFailure() {
        when(runtimeConfig.getInt("admin.orders.batch-ship-max-size", 100)).thenReturn(100);
        when(orderService.shipOrder(11L, "PKG-11", "DHL")).thenReturn(true);
        when(orderService.shipOrder(12L, "PKG-12", "DHL")).thenReturn(false);
        when(orderService.shipOrder(13L, "PKG-13", "DHL"))
                .thenThrow(new IllegalStateException("Only pending-shipment orders can be shipped"));
        Authentication authentication = mock(Authentication.class);
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<?> response = controller.batchShipOrders(
                Map.of(
                        "orderIds", List.of(11, 12, "bad", 13),
                        "trackingPrefix", "PKG",
                        "trackingCarrierCode", "DHL"
                ),
                authentication,
                request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        AdminOrderBatchShipResponse body = assertInstanceOf(AdminOrderBatchShipResponse.class, response.getBody());
        assertEquals(4, body.getRequestedCount());
        assertEquals(1, body.getSuccess());
        assertEquals(3, body.getFailed());
        assertEquals(100, body.getMaxBatchSize());
        assertEquals("PKG", body.getTrackingPrefix());
        assertEquals("DHL", body.getTrackingCarrierCode());
        assertEquals(12L, body.getFailures().get(0).getOrderId());
        assertEquals("Order shipment failed", body.getFailures().get(0).getReason());
        assertEquals("bad", body.getFailures().get(1).getInput());
        assertTrue(body.getFailures().get(1).getReason().contains("bad"));
        assertEquals(13L, body.getFailures().get(2).getOrderId());
        assertEquals("Only pending-shipment orders can be shipped", body.getFailures().get(2).getReason());

        verify(auditLogService).record(
                eq("ORDER_BATCH_SHIP"),
                eq("FAILURE"),
                same(authentication),
                eq("ORDER"),
                eq(null),
                same(request),
                eq("Batch ship completed"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("requested=4"));
        assertTrue(metadata.getValue().contains("success=1"));
        assertTrue(metadata.getValue().contains("failed=3"));
        assertTrue(metadata.getValue().contains("failedIds=12,bad,13"));
    }
}
