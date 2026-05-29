package com.example.shop.controller;

import com.example.shop.entity.User;
import com.example.shop.security.JwtService;
import com.example.shop.security.UserDetailsImpl;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LoginControllerRefreshTest {
    private UserService userService;
    private JwtService jwtService;
    private TokenBlacklistService tokenBlacklistService;
    private LoginController controller;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        jwtService = mock(JwtService.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        controller = new LoginController(
                mock(AuthenticationManager.class),
                userService,
                jwtService,
                mock(SecurityAuditLogService.class),
                mock(EmailLoginService.class),
                mock(IpBlacklistService.class),
                tokenBlacklistService,
                mock(ClientIpResolver.class));
    }

    @Test
    void refreshTokenConsumesOldTokenAndIssuesRotatedSession() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/refresh");
        User user = user();

        when(tokenBlacklistService.consumeRefreshToken("refresh-old")).thenReturn("mia");
        when(userService.findByUsernameOrPhoneOrEmail("mia")).thenReturn(user);
        when(jwtService.generateToken(any(UserDetailsImpl.class))).thenReturn("access-new");
        when(tokenBlacklistService.generateRefreshToken()).thenReturn("refresh-new");

        ResponseEntity<?> response = controller.refreshToken(Map.of("refreshToken", "  refresh-old\n"), request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("access-new", body.get("token"));
        assertEquals("refresh-new", body.get("refreshToken"));
        assertEquals(7L, body.get("id"));
        assertEquals("mia", body.get("username"));
        assertEquals("mia@example.com", body.get("email"));
        assertEquals("5550100", body.get("phone"));
        assertEquals("ADMIN", body.get("role"));
        assertEquals("SUPER_ADMIN", body.get("roleCode"));
        verify(tokenBlacklistService).consumeRefreshToken("refresh-old");
        verify(tokenBlacklistService).storeRefreshToken("refresh-new", "mia");
    }

    @Test
    void refreshTokenRejectsInvalidOrConsumedToken() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/auth/refresh");
        when(tokenBlacklistService.consumeRefreshToken("missing-token")).thenReturn(null);

        ResponseEntity<?> response = controller.refreshToken(Map.of("refreshToken", "missing-token"), request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertEquals("Invalid or expired refresh token", ((Map<?, ?>) response.getBody()).get("error"));
        verifyNoInteractions(userService);
        verify(tokenBlacklistService, never()).generateRefreshToken();
    }

    @Test
    void refreshTokenRequiresTokenValue() {
        ResponseEntity<?> response = controller.refreshToken(null, new MockHttpServletRequest("POST", "/auth/refresh"));

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("refreshToken is required", ((Map<?, ?>) response.getBody()).get("error"));
        verifyNoInteractions(tokenBlacklistService);
    }

    private User user() {
        User user = new User();
        user.setId(7L);
        user.setUsername("mia");
        user.setPassword("encoded-password");
        user.setEmail("mia@example.com");
        user.setPhone("5550100");
        user.setRole("ADMIN");
        user.setRoleCode("SUPER_ADMIN");
        user.setStatus("ACTIVE");
        return user;
    }
}
