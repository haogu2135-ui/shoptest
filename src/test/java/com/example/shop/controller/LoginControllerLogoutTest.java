package com.example.shop.controller;

import com.example.shop.security.JwtService;
import com.example.shop.service.ClientIpResolver;
import com.example.shop.service.EmailLoginService;
import com.example.shop.service.IpBlacklistService;
import com.example.shop.service.SecurityAuditLogService;
import com.example.shop.service.TokenBlacklistService;
import com.example.shop.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.AuthenticationManager;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.anyLong;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LoginControllerLogoutTest {
    private JwtService jwtService;
    private SecurityAuditLogService auditLogService;
    private TokenBlacklistService tokenBlacklistService;
    private LoginController controller;

    @BeforeEach
    void setUp() {
        jwtService = mock(JwtService.class);
        auditLogService = mock(SecurityAuditLogService.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        controller = new LoginController(
                mock(AuthenticationManager.class),
                mock(UserService.class),
                jwtService,
                auditLogService,
                mock(EmailLoginService.class),
                mock(IpBlacklistService.class),
                tokenBlacklistService,
                mock(ClientIpResolver.class));
    }

    @Test
    void logoutRevokesProvidedRefreshToken() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/logout");

        ResponseEntity<?> response = controller.logout(Map.of("refreshToken", "  refresh-token \n"), null, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Logged out", ((Map<?, ?>) response.getBody()).get("message"));
        verify(tokenBlacklistService).revokeRefreshToken("refresh-token");
        verify(tokenBlacklistService, never()).blacklistAccessToken(anyString(), anyLong());
        verifyNoInteractions(jwtService);
    }

    @Test
    void logoutBlacklistsCurrentAccessTokenJti() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/logout");
        request.addHeader("Authorization", "Bearer access-token");
        when(jwtService.extractJti("access-token")).thenReturn("jti-1");
        when(jwtService.getExpirationMs("access-token")).thenReturn(60000L);

        ResponseEntity<?> response = controller.logout(null, null, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(tokenBlacklistService).blacklistAccessToken("jti-1", 60000L);
        verify(tokenBlacklistService, never()).revokeRefreshToken(anyString());
    }

    @Test
    void logoutFailsSafelyWhenAccessTokenBlacklistFails() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/logout");
        request.addHeader("Authorization", "Bearer access-token");
        when(jwtService.extractJti("access-token")).thenReturn("jti-1");
        when(jwtService.getExpirationMs("access-token")).thenReturn(60000L);
        doThrow(new IllegalStateException("redis unavailable"))
                .when(tokenBlacklistService).blacklistAccessToken("jti-1", 60000L);

        ResponseEntity<?> response = controller.logout(Map.of("refreshToken", "refresh-token"), null, request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("LOGOUT_TOKEN_REVOKE_FAILED", ((Map<?, ?>) response.getBody()).get("code"));
        verify(tokenBlacklistService, never()).revokeRefreshToken(anyString());
        verify(auditLogService).record(
                eq("LOGOUT"),
                eq("FAILURE"),
                isNull(),
                eq("USER"),
                isNull(),
                same(request),
                eq("Access token blacklist failed"),
                eq("IllegalStateException"));
        verify(auditLogService, never()).record(
                eq("LOGOUT"),
                eq("SUCCESS"),
                isNull(),
                eq("USER"),
                isNull(),
                same(request),
                eq("User logout"),
                isNull());
    }

    @Test
    void logoutFailsSafelyWhenRefreshTokenRevokeFails() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/logout");
        doThrow(new IllegalStateException("redis unavailable"))
                .when(tokenBlacklistService).revokeRefreshToken("refresh-token");

        ResponseEntity<?> response = controller.logout(Map.of("refreshToken", " refresh-token "), null, request);

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("LOGOUT_REFRESH_REVOKE_FAILED", ((Map<?, ?>) response.getBody()).get("code"));
        verify(tokenBlacklistService).revokeRefreshToken("refresh-token");
        verify(tokenBlacklistService, never()).blacklistAccessToken(anyString(), anyLong());
        verifyNoInteractions(jwtService);
        verify(auditLogService).record(
                eq("LOGOUT"),
                eq("FAILURE"),
                isNull(),
                eq("USER"),
                isNull(),
                same(request),
                eq("Refresh token revoke failed"),
                eq("IllegalStateException"));
        verify(auditLogService, never()).record(
                eq("LOGOUT"),
                eq("SUCCESS"),
                isNull(),
                eq("USER"),
                isNull(),
                same(request),
                eq("User logout"),
                isNull());
    }

    @Test
    void logoutSucceedsWithoutBody() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/logout");

        ResponseEntity<?> response = controller.logout(null, null, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(tokenBlacklistService, never()).revokeRefreshToken(anyString());
        verify(tokenBlacklistService, never()).blacklistAccessToken(anyString(), anyLong());
        verifyNoInteractions(jwtService);
    }
}
