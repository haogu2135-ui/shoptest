package com.example.shop.controller;

import com.example.shop.dto.PetBirthdayCouponConfigRequest;
import com.example.shop.entity.PetBirthdayCouponConfig;
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
import com.example.shop.security.UserDetailsImpl;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminControllerPetBirthdayCouponAuditTest {
    private final PetBirthdayCouponService petBirthdayCouponService = mock(PetBirthdayCouponService.class);
    private final SecurityAuditLogService auditLogService = mock(SecurityAuditLogService.class);
    private final AdminRoleService adminRoleService = mock(AdminRoleService.class);
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
            mock(CouponService.class),
            mock(NotificationService.class),
            petBirthdayCouponService,
            mock(PetGalleryService.class),
            mock(PaymentService.class),
            mock(LogisticsCarrierService.class),
            auditLogService,
            adminRoleService,
            mock(PaymentRepository.class),
            mock(RuntimeConfigService.class)
    );

    @Test
    void manualBirthdayCouponRunWritesAuditLog() {
        when(petBirthdayCouponService.grantBirthdayCoupons(LocalDate.now())).thenReturn(3);
        when(adminRoleService.hasPermission(1L, AdminRoleService.COUPONS_BIRTHDAY_RUN_PERMISSION)).thenReturn(true);
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<?> response = controller.runPetBirthdayCoupons(authentication, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(3, ((Map<?, ?>) response.getBody()).get("granted"));
        verify(auditLogService).record(
                eq("PET_BIRTHDAY_COUPON_RUN"),
                eq("SUCCESS"),
                same(authentication),
                eq("COUPON"),
                eq(null),
                same(request),
                eq("Pet birthday coupons granted"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("granted=3"));
    }

    @Test
    void birthdayCouponConfigUpdateWritesAuditLog() {
        PetBirthdayCouponConfigRequest requestBody = new PetBirthdayCouponConfigRequest();
        requestBody.setEnabled(true);
        requestBody.setNamePrefix("Birthday");
        requestBody.setCouponType("FULL_REDUCTION");
        requestBody.setReductionAmount(new BigDecimal("10.00"));
        requestBody.setValidDays(30);
        requestBody.setMaxBenefitsPerUser(2);

        PetBirthdayCouponConfig config = new PetBirthdayCouponConfig();
        config.setId(1L);
        config.setEnabled(true);
        config.setNamePrefix("Birthday");
        config.setCouponType("FULL_REDUCTION");
        config.setThresholdAmount(new BigDecimal("50.00"));
        config.setReductionAmount(new BigDecimal("10.00"));
        config.setValidDays(30);
        config.setMaxBenefitsPerUser(2);
        when(petBirthdayCouponService.updateConfig(requestBody)).thenReturn(config);
        when(adminRoleService.hasPermission(1L, AdminRoleService.COUPONS_BIRTHDAY_CONFIG_PERMISSION)).thenReturn(true);
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<?> response = controller.updatePetBirthdayCouponConfig(requestBody, authentication, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(config, response.getBody());
        verify(auditLogService).record(
                eq("PET_BIRTHDAY_COUPON_CONFIG_UPDATE"),
                eq("SUCCESS"),
                same(authentication),
                eq("COUPON_CONFIG"),
                eq(1L),
                same(request),
                eq("Pet birthday coupon configuration updated"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("enabled=true"));
        assertTrue(metadata.getValue().contains("couponType=FULL_REDUCTION"));
        assertTrue(metadata.getValue().contains("validDays=30"));
    }

    @Test
    void birthdayCouponConfigValidationFailureWritesAuditLog() {
        PetBirthdayCouponConfigRequest requestBody = new PetBirthdayCouponConfigRequest();
        requestBody.setCouponType("DISCOUNT");
        requestBody.setValidDays(0);
        when(petBirthdayCouponService.updateConfig(requestBody))
                .thenThrow(new IllegalArgumentException("Valid days must be between 1 and 365"));
        when(adminRoleService.hasPermission(1L, AdminRoleService.COUPONS_BIRTHDAY_CONFIG_PERMISSION)).thenReturn(true);
        Authentication authentication = adminAuthentication();
        MockHttpServletRequest request = new MockHttpServletRequest();
        ArgumentCaptor<String> metadata = ArgumentCaptor.forClass(String.class);

        ResponseEntity<?> response = controller.updatePetBirthdayCouponConfig(requestBody, authentication, request);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        verify(auditLogService).record(
                eq("PET_BIRTHDAY_COUPON_CONFIG_UPDATE"),
                eq("FAILURE"),
                same(authentication),
                eq("COUPON_CONFIG"),
                eq(null),
                same(request),
                eq("Valid days must be between 1 and 365"),
                metadata.capture()
        );
        assertTrue(metadata.getValue().contains("couponType=DISCOUNT"));
        assertTrue(metadata.getValue().contains("validDays=0"));
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
