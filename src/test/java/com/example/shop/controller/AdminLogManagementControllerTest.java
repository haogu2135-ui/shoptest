package com.example.shop.controller;

import com.example.shop.dto.LogDebugRequest;
import com.example.shop.dto.LogManagementStatusResponse;
import com.example.shop.security.UserDetailsImpl;
import com.example.shop.service.AdminRoleService;
import com.example.shop.service.LogManagementService;
import com.example.shop.service.SecurityAuditLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminLogManagementControllerTest {
    private LogManagementService logManagementService;
    private SecurityAuditLogService auditLogService;
    private AdminRoleService adminRoleService;
    private AdminLogManagementController controller;

    @BeforeEach
    void setUp() {
        logManagementService = mock(LogManagementService.class);
        auditLogService = mock(SecurityAuditLogService.class);
        adminRoleService = mock(AdminRoleService.class);
        controller = new AdminLogManagementController(logManagementService, auditLogService, adminRoleService);
        when(adminRoleService.hasPermission(1L, AdminRoleService.LOGS_DEBUG_PERMISSION)).thenReturn(true);
    }

    @Test
    void nonSuperAdminCannotToggleSystemLoggerEvenWithDebugPermission() {
        LogDebugRequest request = debugRequest(true, "org.springframework.security");
        when(logManagementService.isApplicationLogger("org.springframework.security")).thenReturn(false);

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> controller.setDebug(request, adminAuthentication(false), new MockHttpServletRequest())
        );

        assertEquals(HttpStatus.FORBIDDEN, error.getStatus());
        verify(logManagementService, never()).setDebug(true, "org.springframework.security");
    }

    @Test
    void superAdminCanToggleExplicitlyAllowedSystemLogger() {
        LogDebugRequest request = debugRequest(true, "org.springframework.security");
        when(logManagementService.isApplicationLogger("org.springframework.security")).thenReturn(false);
        when(logManagementService.setDebug(true, "org.springframework.security")).thenReturn(status("org.springframework.security"));

        LogManagementStatusResponse response = controller.setDebug(
                request,
                adminAuthentication(true),
                new MockHttpServletRequest());

        assertEquals("org.springframework.security", response.getLoggerName());
        verify(logManagementService).setDebug(true, "org.springframework.security");
    }

    @Test
    void nonSuperAdminCanToggleApplicationLogger() {
        LogDebugRequest request = debugRequest(true, "com.example.shop.service.PaymentService");
        when(logManagementService.isApplicationLogger("com.example.shop.service.PaymentService")).thenReturn(true);
        when(logManagementService.setDebug(true, "com.example.shop.service.PaymentService"))
                .thenReturn(status("com.example.shop.service.PaymentService"));

        LogManagementStatusResponse response = controller.setDebug(
                request,
                adminAuthentication(false),
                new MockHttpServletRequest());

        assertEquals("com.example.shop.service.PaymentService", response.getLoggerName());
        verify(logManagementService).setDebug(true, "com.example.shop.service.PaymentService");
    }

    private LogDebugRequest debugRequest(boolean enabled, String loggerName) {
        LogDebugRequest request = new LogDebugRequest();
        request.setEnabled(enabled);
        request.setLoggerName(loggerName);
        return request;
    }

    private LogManagementStatusResponse status(String loggerName) {
        LogManagementStatusResponse response = new LogManagementStatusResponse();
        response.setLoggerName(loggerName);
        response.setConfiguredLevel("DEBUG");
        response.setEffectiveLevel("DEBUG");
        return response;
    }

    private Authentication adminAuthentication(boolean superAdmin) {
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority("ROLE_ADMIN"));
        if (superAdmin) {
            authorities.add(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"));
        }
        UserDetailsImpl principal = new UserDetailsImpl(
                1L,
                "admin",
                "admin@example.com",
                "ACTIVE",
                "encoded-password",
                authorities);
        return new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
    }
}
