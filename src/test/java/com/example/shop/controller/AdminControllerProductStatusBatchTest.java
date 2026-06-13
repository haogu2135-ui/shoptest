package com.example.shop.controller;

import com.example.shop.repository.PaymentRepository;
import com.example.shop.security.UserDetailsImpl;
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
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerProductStatusBatchTest {
    private final ProductService productService = mock(ProductService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
    private final AdminController controller = new AdminController(
            mock(UserService.class),
            mock(OrderService.class),
            mock(OrderItemService.class),
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
            auditLogService,
            adminRoleService,
            mock(PaymentRepository.class),
            runtimeConfig
    );

    @Test
    void batchProductStatusUsesBulkServiceUpdateInsteadOfPerProductFindAndSave() {
        when(runtimeConfig.getInt("admin.products.batch-status-max-size", 100)).thenReturn(100);
        when(adminRoleService.hasPermission(1L, AdminRoleService.PRODUCTS_STATUS_PERMISSION)).thenReturn(true);
        when(productService.updateStatusByIds(List.of(7L, 8L), "INACTIVE")).thenReturn(2);
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<?> response = controller.batchUpdateProductStatus(
                Map.of("productIds", List.of(7, 7, "bad", 8), "status", " inactive "),
                authentication,
                request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals(2, body.get("success"));
        assertEquals(2, body.get("failed"));
        assertEquals(4, body.get("requested"));
        verify(productService).updateStatusByIds(List.of(7L, 8L), "INACTIVE");
        verify(productService, never()).findById(7L);
        verify(productService, never()).findById(8L);
        verify(productService, never()).save(org.mockito.ArgumentMatchers.any());
        verify(auditLogService).record(
                eq("PRODUCT_BATCH_STATUS_UPDATE"),
                eq("FAILURE"),
                same(authentication),
                eq("PRODUCT"),
                eq(null),
                same(request),
                eq("Product batch status updated"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("requested=4"));
        assertTrue(metadata.getValue().contains("success=2"));
        assertTrue(metadata.getValue().contains("failed=2"));
    }

    private Authentication adminAuthentication() {
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
