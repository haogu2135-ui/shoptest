package com.example.shop.controller;

import com.example.shop.entity.User;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.RuntimeConfigService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserControllerAdminBootstrapTest {
    private final UserService userService = mock(UserService.class);
    private final RuntimeConfigService runtimeConfig = mock(RuntimeConfigService.class);
    private final IpBlacklistService ipBlacklistService = mock(IpBlacklistService.class);
    private final UserController controller = new UserController(
            userService,
            runtimeConfig,
            mock(SecurityAuditLogService.class),
            mock(EmailLoginService.class),
            mock(ClientIpResolver.class),
            ipBlacklistService);

    @Test
    void createAdminWithConfiguredTokenStillRejectsWhenAdminAlreadyExists() {
        UserController.AdminBootstrapRequest request = validBootstrapRequest();
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/users/create-admin");
        when(runtimeConfig.getString("admin.bootstrap-token", "")).thenReturn("temporary-token");
        doThrow(new IllegalArgumentException("Admin bootstrap is already completed"))
                .when(userService).registerAdmin(any(User.class));

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class,
                () -> controller.createAdmin(request, "temporary-token", servletRequest));

        assertEquals("Admin bootstrap is already completed", exception.getMessage());
        verify(userService).registerAdmin(argThat(admin ->
                "admin".equals(admin.getUsername())
                        && "admin@example.com".equals(admin.getEmail())
                        && "ADMIN".equals(admin.getRole())));
        verify(ipBlacklistService).recordLoginFailure(servletRequest, "admin-bootstrap failed");
    }

    @Test
    void createAdminRejectsMissingBootstrapTokenBeforeRegisteringAdmin() {
        UserController.AdminBootstrapRequest request = validBootstrapRequest();
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/users/create-admin");
        when(runtimeConfig.getString("admin.bootstrap-token", "")).thenReturn("temporary-token");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.createAdmin(request, null, servletRequest));

        assertEquals("Invalid admin bootstrap token", exception.getReason());
        verify(userService, never()).registerAdmin(any(User.class));
        verify(ipBlacklistService).recordLoginFailure(servletRequest, "admin-bootstrap failed");
    }

    @Test
    void createAdminRejectsWhenBootstrapIsNotConfigured() {
        UserController.AdminBootstrapRequest request = validBootstrapRequest();
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/users/create-admin");
        when(runtimeConfig.getString("admin.bootstrap-token", "")).thenReturn("");

        ResponseStatusException exception = assertThrows(ResponseStatusException.class,
                () -> controller.createAdmin(request, "temporary-token", servletRequest));

        assertEquals("Admin bootstrap is not configured", exception.getReason());
        verify(userService, never()).registerAdmin(any(User.class));
        verify(ipBlacklistService).recordLoginFailure(servletRequest, "admin-bootstrap failed");
    }

    private UserController.AdminBootstrapRequest validBootstrapRequest() {
        UserController.AdminBootstrapRequest request = new UserController.AdminBootstrapRequest();
        request.setUsername("admin");
        request.setPassword("StrongPass123");
        request.setEmail("admin@example.com");
        return request;
    }
}
