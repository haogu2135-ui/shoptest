package com.example.shop.controller;

import com.example.shop.dto.EmailLoginCodeRequest;
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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LoginControllerPasswordLoginTest {
    private AuthenticationManager authenticationManager;
    private UserService userService;
    private JwtService jwtService;
    private TokenBlacklistService tokenBlacklistService;
    private ClientIpResolver clientIpResolver;
    private EmailLoginService emailLoginService;
    private IpBlacklistService ipBlacklistService;
    private LoginController controller;

    @BeforeEach
    void setUp() {
        authenticationManager = mock(AuthenticationManager.class);
        userService = mock(UserService.class);
        jwtService = mock(JwtService.class);
        tokenBlacklistService = mock(TokenBlacklistService.class);
        clientIpResolver = mock(ClientIpResolver.class);
        emailLoginService = mock(EmailLoginService.class);
        ipBlacklistService = mock(IpBlacklistService.class);
        controller = new LoginController(
                authenticationManager,
                userService,
                jwtService,
                mock(SecurityAuditLogService.class),
                emailLoginService,
                ipBlacklistService,
                tokenBlacklistService,
                clientIpResolver);
    }

    @Test
    void sendEmailCodeDefersWorkToMvcAsyncCallable() throws Exception {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/email-code");
        EmailLoginCodeRequest codeRequest = new EmailLoginCodeRequest();
        codeRequest.setEmail("mia@example.com");
        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.31");

        Callable<ResponseEntity<?>> task = controller.sendEmailCode(codeRequest, servletRequest);

        verify(emailLoginService, never()).sendLoginCode(any(), any());

        ResponseEntity<?> response = task.call();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Verification code sent", body.get("message"));
        verify(emailLoginService).sendLoginCode("mia@example.com", "203.0.113.31");
    }

    @Test
    void passwordResetCodeCallablePreservesRateLimitResponse() throws Exception {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/password-reset-code");
        EmailLoginCodeRequest codeRequest = new EmailLoginCodeRequest();
        codeRequest.setEmail("mia@example.com");
        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.32");
        doThrow(new EmailLoginService.EmailLoginException("RATE_LIMITED", "Please wait before trying again", 17))
                .when(emailLoginService).sendPasswordResetCode("mia@example.com", "203.0.113.32");

        Callable<ResponseEntity<?>> task = controller.sendPasswordResetCode(codeRequest, servletRequest);
        ResponseEntity<?> response = task.call();

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("RATE_LIMITED", body.get("code"));
        assertEquals(17L, body.get("retryAfterSeconds"));
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

    @Test
    void unknownPasswordLoginStillDelegatesToAuthenticationManager() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/login");
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("  Missing@Example.COM  ");
        loginRequest.setPassword("wrong-secret");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.34");
        when(userService.findByUsernameOrPhoneOrEmail("missing@example.com")).thenReturn(null);
        when(authenticationManager.authenticate(any()))
                .thenThrow(new BadCredentialsException("Bad credentials"));

        ResponseEntity<?> response = controller.login(loginRequest, servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Invalid username or password", body.get("error"));
        ArgumentCaptor<Authentication> authenticationRequest = ArgumentCaptor.forClass(Authentication.class);
        verify(authenticationManager).authenticate(authenticationRequest.capture());
        assertEquals("missing@example.com", authenticationRequest.getValue().getPrincipal());
        assertEquals("wrong-secret", authenticationRequest.getValue().getCredentials());
        verify(tokenBlacklistService).recordLoginFailure("203.0.113.34", "missing@example.com");
    }

    @Test
    void lockedExistingAccountPasswordLoginUsesGenericInvalidCredentialsResponse() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/login");
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("mia@example.com");
        loginRequest.setPassword("wrong-secret");
        User account = new User();
        account.setId(7L);
        account.setUsername("mia");
        account.setEmail("mia@example.com");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.35");
        when(userService.findByUsernameOrPhoneOrEmail("mia@example.com")).thenReturn(account);
        when(tokenBlacklistService.isAccountLocked("mia")).thenReturn(true);

        ResponseEntity<?> response = controller.login(loginRequest, servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Invalid username or password", body.get("error"));
        verify(authenticationManager).authenticate(any());
        verify(ipBlacklistService).recordLoginFailure(servletRequest, "Invalid username or password");
        verify(tokenBlacklistService).recordLoginFailure("203.0.113.35", "mia");
    }

    @Test
    void lockedUnknownAccountPasswordLoginUsesSameGenericInvalidCredentialsResponse() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/login");
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("missing@example.com");
        loginRequest.setPassword("wrong-secret");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.36");
        when(userService.findByUsernameOrPhoneOrEmail("missing@example.com")).thenReturn(null);
        when(tokenBlacklistService.isAccountLocked("missing@example.com")).thenReturn(true);

        ResponseEntity<?> response = controller.login(loginRequest, servletRequest);

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertEquals("Invalid username or password", body.get("error"));
        verify(authenticationManager).authenticate(any());
        verify(ipBlacklistService).recordLoginFailure(servletRequest, "Invalid username or password");
        verify(tokenBlacklistService).recordLoginFailure("203.0.113.36", "missing@example.com");
    }

    @Test
    void unexpectedPostAuthenticationFailureIsNotReportedAsServiceUnavailable() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("POST", "/auth/login");
        LoginRequest loginRequest = new LoginRequest();
        loginRequest.setUsername("mia@example.com");
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
        user.setRole("USER");
        user.setStatus("ACTIVE");

        when(clientIpResolver.resolve(servletRequest)).thenReturn("203.0.113.30");
        when(userService.findByUsernameOrPhoneOrEmail("mia@example.com")).thenReturn(user);
        when(authenticationManager.authenticate(any())).thenReturn(authentication);
        when(jwtService.generateToken(principal)).thenThrow(new NullPointerException("jwt signer missing"));

        assertThrows(NullPointerException.class, () -> controller.login(loginRequest, servletRequest));

        verify(tokenBlacklistService, never()).storeRefreshToken(any(), any());
    }
}
