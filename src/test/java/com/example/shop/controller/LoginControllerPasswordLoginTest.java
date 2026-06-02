package com.example.shop.controller;

import com.example.shop.dto.LoginRequest;
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
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LoginControllerPasswordLoginTest {
    private AuthenticationManager authenticationManager;
    private UserService userService;
    private JwtService jwtService;
    private TokenBlacklistService tokenBlacklistService;
    private ClientIpResolver clientIpResolver;
    private LoginController controller;

    @BeforeEach
    void setUp() {
        authenticationManager = mock(AuthenticationManager.class);
        userService = mock(UserService.class);
        jwtService = mock(JwtService.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        controller = new LoginController(
                authenticationManager,
                userService,
                jwtService,
                mock(SecurityAuditLogService.class),
                mock(EmailLoginService.class),
                mock(IpBlacklistService.class),
                tokenBlacklistService,
                clientIpResolver);
    }

    @Test
    void passwordLoginByEmailReturnsFullUserProfileAndRefreshToken() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/login");
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("  MIA@Example.COM  ");
        loginRequest.setPassword("secret123");
        UserDetailsImpl principal = new UserDetailsImpl(
                7L,
                "mia",
                "mia@example.com",
                "ACTIVE",
                "encoded-password",
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                principal.getAuthorities());
        User user = new User();
        user.setId(7L);
        user.setUsername("mia");
        user.setEmail("mia@example.com");
        user.setPhone("5550100");
        user.setRole("USER");
        user.setStatus("ACTIVE");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.30");
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(jwtService.generateToken(principal)).thenReturn("access-token");
        when(tokenBlacklistService.generateRefreshToken()).thenReturn("refresh-token");
        when(userService.findByUsernameOrPhoneOrEmail("mia@example.com")).thenReturn(user);
        when(userService.findById(7L)).thenReturn(user);

        ResponseEntity<?> response = controller.login(loginRequest, servletRequest);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("access-token", body.get("token"));
        assertEquals("refresh-token", body.get("refreshToken"));
        assertEquals("mia", body.get("username"));
        assertEquals("mia@example.com", body.get("email"));
        assertEquals("5550100", body.get("phone"));
        assertEquals("USER", body.get("role"));
        verify(userService).findByUsernameOrPhoneOrEmail("mia@example.com");
        verify(userService).findById(7L);
        verify(tokenBlacklistService).storeRefreshToken("refresh-token", "mia");
        ArgumentCaptor<Authentication> authenticationRequest = ArgumentCaptor.forClass(Authentication.class);
        verify(authenticationManager).authenticate(authenticationRequest.capture());
        assertEquals("mia", authenticationRequest.getValue().getPrincipal());
    }
}
